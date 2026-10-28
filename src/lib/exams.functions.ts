import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EXAM_SPEC } from "./ai/exam-spec";
import { audit, requireTeam } from "./team.server";
import { validateExamScope } from "./exam-scope";
import { questionDraftSchema, uniqueQuestions, validateSemester } from "./exam-ingestion";

const qZ = questionDraftSchema;

const metaZ = z.object({
  title: z.string().trim().min(1).max(200),
  subject_id: z.string().uuid(),
  unit_id: z.string().uuid().nullable().default(null),
  exam_year: z.string().max(20).default(""),
  session: z.enum(["normal", "rattrapage"]).default("normal"),
  emd_number: z.string().max(20).default(""),
  has_corrige: z.boolean().default(false),
  semester: z.enum(["", "S1", "S2"]).default(""),
});

/** Create or update an exam set's metadata (Past EMD or AI-generated). */
export const saveExamSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => metaZ.extend({ id: z.string().uuid().optional(), kind: z.enum(["past_emd", "ai_generated"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId);
    const { id, ...vals } = data;
    const [{ data: subject, error: subjectError }, { data: unit, error: unitError }] = await Promise.all([
      context.supabase.from("subjects").select("id,name,department,academic_year").eq("id", vals.subject_id).single(),
      vals.unit_id ? context.supabase.from("units").select("id,name,subject_id").eq("id", vals.unit_id).single() : Promise.resolve({ data: null, error: null }),
    ]);
    if (subjectError || unitError) throw new Error("Choose a valid curriculum subject and module.");
    validateExamScope(subject, unit, vals);
    if (subject) validateSemester(subject.academic_year, vals.semester);
    if (id) {
      const { error } = await context.supabase.from("exam_sets").update(vals).eq("id", id);
      if (error) throw new Error(error.message);
      await audit(context.supabase, t, "updated_exam", "exam_set", id, vals.title);
      return { id };
    }
    const { data: row, error } = await context.supabase.from("exam_sets").insert({ ...vals, created_by: t.userId }).select("id").single();
    if (error || !row) throw new Error(error?.message ?? "Save failed");
    await audit(context.supabase, t, "created_exam", "exam_set", row.id, vals.title, { kind: vals.kind });
    return { id: row.id };
  });

/** Replace all questions of a set with the reviewed list. */
export const saveExamQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ setId: z.string().uuid(), questions: z.array(qZ).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId);
    const sb = context.supabase;
    const { data: set } = await sb.from("exam_sets").select("title,status,subject_id,unit_id,kind").eq("id", data.setId).single();
    if (!set) throw new Error("Exam not found");
    // Lessons may only come from the exam's own subject (any of its modules).
    const wanted = [...new Set(data.questions.flatMap((q) => q.lesson_ids))];
    if (wanted.length) {
      const { data: les, error } = await sb.from("lessons").select("id, units!inner(subject_id)").in("id", wanted);
      if (error) throw new Error(error.message);
      const ok = new Set((les ?? []).filter((l) => (l.units as unknown as { subject_id: string }).subject_id === set.subject_id).map((l) => l.id));
      if (wanted.some((id) => !ok.has(id))) throw new Error("A linked lesson does not belong to this exam's subject.");
    }
    if (set.kind === "past_emd" && data.questions.some((q) => q.answer_source === "generated")) throw new Error("Past EMDs require an official correction, not an AI-generated key.");
    const rows = uniqueQuestions(data.questions).map((q, i) => ({
      set_id: data.setId, position: i, stem: q.stem, options: q.options,
      answers: [...new Set(q.answers.filter((a) => a < q.options.length))].sort(),
      explanation: q.explanation, format: q.format, verified: q.verified,
      lesson_ids: [...new Set(q.lesson_ids)],
      option_comments: q.option_comments, trap_phrase: q.trap_phrase, trap_explanation: q.trap_explanation,
      answer_source: q.answer_source, review_note: q.review_note, source_pages: q.source_pages,
    }));
    const { error: replaceError } = await sb.rpc("replace_exam_questions", { p_set_id: data.setId, p_questions: rows });
    if (replaceError) throw new Error(replaceError.message);
    // Any edit sends a published exam back to review until re-approved.
    const status = rows.length ? "in_review" : "uploaded";
    await audit(sb, t, "saved_exam_questions", "exam_set", data.setId, set.title, { count: rows.length });
    return { count: rows.length, status };
  });

/** Move through review: in_review → verified → published (or back). Publishing requires all questions verified with a key. */
export const setExamStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["uploaded", "in_review", "verified", "published"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId);
    const sb = context.supabase;
    if (data.status === "verified" || data.status === "published") {
      const { data: qs } = await sb.from("exam_set_questions").select("verified,answers,answer_source,review_note").eq("set_id", data.id);
      if (!qs?.length) throw new Error("Add questions before approving this exam.");
      if (qs.some((q) => !q.verified || !(q.answers as number[]).length || q.answer_source === "missing" || q.review_note)) throw new Error("Every question must be verified with a correction and no unresolved review warning.");
    }
    const { data: row, error } = await sb.from("exam_sets").update({ status: data.status }).eq("id", data.id).select("title").single();
    if (error || !row) throw new Error(error?.message ?? "Update failed");
    await audit(sb, t, `exam_${data.status}`, "exam_set", data.id, row.title);
    return { ok: true };
  });

export const deleteExamSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId);
    const { data: row } = await context.supabase.from("exam_sets").delete().eq("id", data.id).select("title").single();
    await audit(context.supabase, t, "deleted_exam", "exam_set", data.id, row?.title ?? "");
    return { ok: true };
  });

/** Wisen AI drafts an exam once, centrally; it stays in review until an admin approves it. */
export const generateAiExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ setId: z.string().uuid(), count: z.number().int().min(3).max(40), material: z.string().max(60000).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    await requireTeam(context.supabase, context.userId);
    const sb = context.supabase;
    const { data: set } = await sb.from("exam_sets").select("subject_id,unit_id,title").eq("id", data.setId).single();
    if (!set) throw new Error("Exam not found");
    const { data: subj } = await sb.from("subjects").select("name,department,academic_year").eq("id", set.subject_id).single();
    const { data: units } = await sb.from("units").select("id,name").eq("subject_id", set.subject_id);
    const unitIds = (units ?? []).filter((u) => !set.unit_id || u.id === set.unit_id).map((u) => u.id);
    const { data: lessons } = unitIds.length ? await sb.from("lessons").select("name").in("unit_id", unitIds) : { data: [] };
    const scope = `${subj?.name ?? ""} (${subj?.department ?? ""}, Year ${subj?.academic_year ?? ""})${set.unit_id ? ` — unit ${(units ?? []).find((u) => u.id === set.unit_id)?.name}` : ""}. Lessons: ${(lessons ?? []).map((l) => l.name).join("; ")}`;
    const { wisenComplete, parseJson } = await import("./ai/gateway.server");
    const system = `You are Wisen AI, drafting an official-style EMD for the Faculty of Medicine, Université Ferhat Abbas Sétif 1. Write ${data.count} medically accurate questions in French covering the scope evenly. ${data.material ? "Base every question strictly on the provided material." : "Use established medical knowledge for this curriculum scope only."}
${EXAM_SPEC}
Return JSON only: {"questions":[{"stem":"...","options":["A","B","C","D","E"],"answers":[0-based indices],"explanation":"...","format":"QCS|QCM_MULTI|QCM_REGRP|CAS_CLIN"}]}`;
    const r = await wisenComplete([{ role: "system", content: system }, { role: "user", content: `SCOPE: ${scope}${data.material ? `\n\nMATERIAL:\n${data.material}` : ""}` }], { json: true });
    if (!r.ok) throw new Error(r.error === "credits" ? "Wisen AI is out of credits right now." : r.error === "busy" ? "Wisen AI is busy — try again in a minute." : "Wisen AI couldn't generate this exam.");
    const parsed = parseJson<{ questions?: { stem?: string; options?: string[]; answers?: number[]; explanation?: string; format?: string }[] }>(r.text);
    const qs = (parsed?.questions ?? []).flatMap((q) => {
      const options = (q.options ?? []).map((o) => String(o).trim()).filter(Boolean).slice(0, 5);
      const answers = [...new Set((q.answers ?? []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < options.length))];
      if (!q.stem || options.length < 2) return [];
      return [{ stem: String(q.stem).trim(), options, answers, explanation: String(q.explanation ?? ""), format: String(q.format ?? "").slice(0, 20), verified: false }];
    });
    if (!qs.length) throw new Error("Wisen AI returned no usable questions. Try again.");
    return qs;
  });
