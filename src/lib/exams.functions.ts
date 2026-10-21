import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EXAM_SPEC } from "./ai/exam-spec";
import { audit, requireTeam } from "./team.server";

const qZ = z.object({
  stem: z.string().trim().min(1).max(4000),
  options: z.array(z.string().trim().min(1).max(1000)).min(2).max(5),
  answers: z.array(z.number().int().min(0).max(4)).max(5),
  explanation: z.string().max(6000).default(""),
  format: z.string().max(20).default(""),
  verified: z.boolean().default(false),
});

const metaZ = z.object({
  title: z.string().trim().min(1).max(200),
  subject_id: z.string().uuid(),
  unit_id: z.string().uuid().nullable().default(null),
  exam_year: z.string().max(20).default(""),
  session: z.enum(["normal", "rattrapage"]).default("normal"),
  emd_number: z.string().max(20).default(""),
  has_corrige: z.boolean().default(false),
});

/** Create or update an exam set's metadata (Past EMD or AI-generated). */
export const saveExamSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => metaZ.extend({ id: z.string().uuid().optional(), kind: z.enum(["past_emd", "ai_generated"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId);
    const { id, ...vals } = data;
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
    const { data: set } = await sb.from("exam_sets").select("title,status").eq("id", data.setId).single();
    if (!set) throw new Error("Exam not found");
    const rows = data.questions.map((q, i) => ({
      set_id: data.setId, position: i, stem: q.stem, options: q.options,
      answers: [...new Set(q.answers.filter((a) => a < q.options.length))].sort(),
      explanation: q.explanation, format: q.format, verified: q.verified,
    }));
    await sb.from("exam_set_questions").delete().eq("set_id", data.setId);
    if (rows.length) { const { error } = await sb.from("exam_set_questions").insert(rows); if (error) throw new Error(error.message); }
    // Any edit sends a published exam back to review until re-approved.
    const status = rows.length ? (set.status === "uploaded" || set.status === "published" ? "in_review" : set.status) : "uploaded";
    await sb.from("exam_sets").update({ status }).eq("id", data.setId);
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
      const { data: qs } = await sb.from("exam_set_questions").select("verified,answers").eq("set_id", data.id);
      if (!qs?.length) throw new Error("Add questions before approving this exam.");
      if (qs.some((q) => !q.verified || !(q.answers as number[]).length)) throw new Error("Every question must be verified and have a correct answer.");
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
