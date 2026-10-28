import { z } from "zod";

export const TRAP_PHRASES = ["رد بالك تتخدع", "رد بالك تطيح في الفخ", "هنا وين يغلطو الطلبة", "غلطة تافهة بزاااف حذاري", "ركز مليح متتخدعش"] as const;
export const MAX_EXAM_FILE = 50 * 1024 * 1024;
export const questionDraftSchema = z.object({
  stem: z.string().trim().min(1).max(4000),
  options: z.array(z.string().trim().min(1).max(1000)).min(2).max(5),
  answers: z.array(z.number().int().min(0).max(4)).max(5),
  explanation: z.string().max(6000).default(""),
  format: z.enum(["", "QCS", "QCM_MULTI", "QCM_REGRP", "CAS_CLIN"]).default(""),
  verified: z.boolean().default(false),
  lesson_ids: z.array(z.string().uuid()).max(20).default([]),
  option_comments: z.array(z.string().max(1500)).max(5).default([]),
  trap_phrase: z.enum(["", ...TRAP_PHRASES]).default(""),
  trap_explanation: z.string().max(2000).default(""),
  answer_source: z.enum(["official", "missing", "generated"]).default("missing"),
  review_note: z.string().max(2000).default(""),
  source_pages: z.array(z.number().int().positive()).max(300).default([]),
}).superRefine((q, ctx) => {
  if (q.answers.some((a) => a >= q.options.length)) ctx.addIssue({ code: "custom", message: "Answer outside options" });
  if (q.format === "QCS" && q.answers.length > 1) ctx.addIssue({ code: "custom", message: "QCS requires one answer" });
  if (q.verified && (!q.answers.length || q.answer_source === "missing" || q.review_note)) ctx.addIssue({ code: "custom", message: "Resolve the answer key and review warning before verification" });
});
export type ExamDraftQuestion = z.infer<typeof questionDraftSchema>;
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
  return questionDraftSchema.parse({ ...original,
    explanation: suggestion.explanation ?? original.explanation,
    option_comments: original.options.map((_, i) => suggestion.option_comments?.[i] ?? ""),
    lesson_ids: (suggestion.lesson_ids ?? []).filter((id) => allowedLessons.has(id)),
    trap_phrase: suggestion.trap_phrase ?? "", trap_explanation: suggestion.trap_explanation ?? "",
    review_note: [original.review_note, suggestion.review_note].filter(Boolean).join("\n").slice(0, 2000), verified: false,
  });
}
export function parseExamJson(text: string): { papers: (Partial<PaperDraft> & { questions: ExamDraftQuestion[] })[] } {
  const d = JSON.parse(text);
  const papers = Array.isArray(d) ? [{ questions: d }] : Array.isArray(d.papers) ? d.papers : [d];
  if (!papers.length || papers.length > 100) throw new Error("Invalid JSON exam archive");
  return { papers: papers.map((p: Record<string, unknown>) => {
    if (!Array.isArray(p["questions"])) throw new Error("JSON must contain a questions array (or papers with questions arrays).");
    const questions = p["questions"].map((q: Record<string, unknown>) => questionDraftSchema.parse({ ...q, verified: false,
      answer_source: Array.isArray(q["answers"]) && q["answers"].length ? "official" : "missing" }));
    return { ...p, questions };
  }) };
}