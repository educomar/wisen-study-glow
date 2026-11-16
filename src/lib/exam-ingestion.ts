import { z } from "zod";
export type SourceJson = string | number | boolean | null | SourceJson[] | { [key: string]: SourceJson };
const sourceJsonSchema: z.ZodType<SourceJson> = z.lazy(() => z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(sourceJsonSchema), z.record(sourceJsonSchema)]));
export const sourceRecordSchema = z.record(sourceJsonSchema);

export const TRAP_PHRASES = ["رد بالك تتخدع", "رد بالك تطيح في الفخ", "هنا وين يغلطو الطلبة", "غلطة تافهة بزاااف حذاري", "ركز مليح متتخدعش"] as const;
export const MAX_EXAM_FILE = 50 * 1024 * 1024;
export const questionDraftSchema = z.object({
  stem: z.string().max(4000),
  options: z.array(z.string().min(1).max(1000)).min(2).max(5),
  answers: z.array(z.number().int().min(0).max(4)).max(5),
  explanation: z.string().max(6000).default(""),
  format: z.enum(["", "QCS", "QCM_MULTI", "QCM_REGRP", "CAS_CLIN"]).default(""),
  verified: z.boolean().default(false),
  lesson_ids: z.array(z.string().uuid()).max(20).default([]),
  option_comments: z.array(z.string().max(12000)).max(5).default([]),
  trap_phrase: z.enum(["", ...TRAP_PHRASES]).default(""),
  trap_explanation: z.string().max(2000).default(""),
  answer_source: z.enum(["official", "missing", "generated"]).default("missing"),
  review_note: z.string().max(2000).default(""),
  source_pages: z.array(z.number().int().positive()).max(300).default([]),
  source_data: sourceRecordSchema.optional(),
  answer_variants: z.array(z.array(z.number().int().min(0).max(4)).min(1).max(5)).max(10).optional(),
}).superRefine((q, ctx) => {
  if (!q.stem && !q.source_data) ctx.addIssue({ code: "custom", message: "Question text is required" });
  if (q.source_data?.["QuestionText"] !== undefined) {
    const source = q.source_data;
    const options = source["Options"] as Record<string, string>;
    const letters = Object.keys(options).sort();
    const official = answerVariants(source["OfficialAnswer"], q.options.length);
    const variants = official.length ? official : answerVariants(source["AIAnswer"], q.options.length);
    const comments = source["OptionExplanations"] as Record<string, { Explanation?: string }> | undefined;
    if (q.stem !== source["QuestionText"] || JSON.stringify(q.options) !== JSON.stringify(letters.map((l) => options[l])) || JSON.stringify(q.answers) !== JSON.stringify(variants[0] ?? []) || JSON.stringify(q.answer_variants) !== JSON.stringify(variants) || JSON.stringify(q.option_comments) !== JSON.stringify(letters.map((l) => comments?.[l]?.Explanation ?? ""))) {
      ctx.addIssue({ code: "custom", message: "Imported source text, comments and correction must remain unchanged." });
    }
  }
  if (q.answers.some((a) => a >= q.options.length)) ctx.addIssue({ code: "custom", message: "Answer outside options" });
  if (q.answer_variants?.some((v) => v.some((a) => a >= q.options.length))) ctx.addIssue({ code: "custom", message: "Alternative answer outside options" });
  if (q.format === "QCS" && q.answers.length > 1) ctx.addIssue({ code: "custom", message: "QCS requires one answer" });
});
export type ExamDraftQuestion = z.infer<typeof questionDraftSchema>;
/** Bulk acknowledgement changes only verification, never source content or warnings. */
export function markAllQuestionsVerified(questions: ExamDraftQuestion[]): ExamDraftQuestion[] {
  return questions.map((q) => ({ ...q, verified: true }));
}
export type ExtractedPage = { number: number; text: string; ocr?: boolean; confidence?: number };
export const paperSchema = z.object({
  title: z.string().max(200), subject_id: z.string().uuid().nullable(), unit_id: z.string().uuid().nullable().default(null),
  exam_year: z.string().max(20).default(""), semester: z.enum(["", "S1", "S2"]).default(""),
  session: z.enum(["normal", "rattrapage"]).default("normal"), emd_number: z.string().max(20).default(""),
  start_page: z.number().int().positive(), end_page: z.number().int().positive(),
  review_note: z.string().max(2000).default(""),
});
export type PaperDraft = z.infer<typeof paperSchema>;
export function validateSemester(year: number, semester: string) {
  if (year !== 1 && semester) throw new Error("This curriculum is annual; do not select S1/S2.");
}
export function questionFingerprint(q: Pick<ExamDraftQuestion, "stem" | "options">) {
  return [q.stem, ...q.options].map((s) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()).join("\n");
}
export function uniqueQuestions(qs: ExamDraftQuestion[]) {
  const seen = new Set<string>();
  return qs.filter((q) => { const key = questionFingerprint(q); if (seen.has(key)) return false; seen.add(key); return true; });
}
/** Enrichment cannot change the imported question, its official key, or the source evidence. */
export function applyEnrichment(original: ExamDraftQuestion, suggestion: Partial<ExamDraftQuestion>, allowedLessons: Set<string>) {
  // Structured imports already contain reviewed source prose. Only lesson IDs may be enriched.
  if (original.source_data) return questionDraftSchema.parse({ ...original,
    lesson_ids: [...new Set([...original.lesson_ids, ...(suggestion.lesson_ids ?? [])])].filter((id) => allowedLessons.has(id)), verified: false,
  });
  return questionDraftSchema.parse({ ...original,
    explanation: suggestion.explanation ?? original.explanation,
    option_comments: original.options.map((_, i) => suggestion.option_comments?.[i] ?? ""),
    lesson_ids: (suggestion.lesson_ids ?? []).filter((id) => allowedLessons.has(id)),
    trap_phrase: suggestion.trap_phrase ?? "", trap_explanation: suggestion.trap_explanation ?? "",
    review_note: [original.review_note, suggestion.review_note].filter(Boolean).join("\n").slice(0, 2000), verified: false,
  });
}
export type JsonPaper = Partial<PaperDraft> & { questions: ExamDraftQuestion[]; source_metadata?: Record<string, SourceJson> };
export function answerVariants(value: unknown, optionCount: number): number[][] {
  if (typeof value !== "string" || !value.trim() || /^not available$/i.test(value.trim())) return [];
  return value.split("/").map((part) => {
    const letters = part.toUpperCase().replace(/[\s,;+]/g, "");
    if (!/^[ABCDE]+$/.test(letters)) throw new Error(`Unsupported correction: ${value}`);
    const indices = [...new Set([...letters].map((letter) => "ABCDE".indexOf(letter)))];
    if (indices.some((i) => i >= optionCount)) throw new Error(`Correction outside options: ${value}`);
    return indices;
  });
}
export function parseExamJson(text: string): { papers: JsonPaper[] } {
  const d = JSON.parse(text);
  if (d && !Array.isArray(d) && Array.isArray(d.Subjects)) {
    const { Subjects: _subjects, ...archive } = d;
    if (!d.Subjects.length || d.Subjects.length > 100) throw new Error("Invalid JSON exam archive");
    return { papers: d.Subjects.map((p: Record<string, unknown>) => {
      if (!Array.isArray(p["Questions"]) || !p["Questions"].length || p["Questions"].length > 200) throw new Error("Each exam must contain 1–200 questions.");
      const questions = p["Questions"].map((q: Record<string, unknown>) => {
        const optionsObject = z.record(z.string()).parse(q["Options"]);
        const letters = Object.keys(optionsObject).sort();
        if (letters.join("") !== "ABCDE".slice(0, letters.length)) throw new Error("Options must use consecutive A–E labels.");
        const options = letters.map((letter) => optionsObject[letter] ?? "");
        const official = answerVariants(q["OfficialAnswer"], options.length);
        const variants = official.length ? official : answerVariants(q["AIAnswer"], options.length);
        const comments = q["OptionExplanations"] as Record<string, { Explanation?: unknown }> | undefined;
        return questionDraftSchema.parse({ stem: q["QuestionText"], options, answers: variants[0] ?? [], answer_variants: variants,
          format: "QCM_MULTI", answer_source: official.length ? "official" : variants.length ? "generated" : "missing",
          option_comments: letters.map((letter) => typeof comments?.[letter]?.Explanation === "string" ? comments[letter]?.Explanation : ""),
          source_data: q, verified: false,
        });
      });
      const { Questions: _questions, ...metadata } = p;
      return { title: `${String(p["Subject"] ?? "Exam")} ${String(p["Year"] ?? "")}`.trim(), exam_year: String(p["Year"] ?? ""),
        questions, source_metadata: { ...archive, ...metadata } };
    }) };
  }
  const papers = Array.isArray(d) ? [{ questions: d }] : Array.isArray(d.papers) ? d.papers : [d];
  if (!papers.length || papers.length > 100) throw new Error("Invalid JSON exam archive");
  return { papers: papers.map((p: Record<string, unknown>) => {
    if (!Array.isArray(p["questions"])) throw new Error("JSON must contain a questions array (or papers with questions arrays).");
    const questions = p["questions"].map((q: Record<string, unknown>) => questionDraftSchema.parse({ ...q, verified: false,
      answer_source: Array.isArray(q["answers"]) && q["answers"].length ? "official" : "missing" }));
    return { ...p, questions };
  }) };
}