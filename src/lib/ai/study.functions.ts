import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { parseJson, wisenComplete } from "./gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const material = z.array(z.object({ name: z.string().max(200), text: z.string().max(60000) })).min(1).max(12);

const LANG = "Write in the main language of the material (French or English). Keep standard medical terminology.";
const NOTATION = "Use LaTeX ($...$) for maths and mhchem ($\\ce{...}$) for chemistry where useful.";
const STRICT = "Use ONLY facts stated in the provided material. Never invent facts, numbers, teachers or exam rules. Be medically accurate.";

const qSchema = z.object({
  mode: z.enum(["qbank", "exam"]),
  qtype: z.enum(["SCQ", "MCQ"]),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  count: z.number().int().min(1).max(30),
  subject: z.string().max(120), unit: z.string().max(120), lesson: z.string().max(200),
  material,
  pastEmds: z.array(z.object({ name: z.string().max(200), text: z.string().max(30000) })).max(6).default([]),
});

type RawQ = { stem?: string; options?: string[]; answers?: number[]; explanation?: string; source?: string };

export const generateQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => qSchema.parse(d))
  .handler(async ({ data, context }) => {
    const total = data.material.reduce((n, m) => n + m.text.length, 0);
    const per = Math.max(2000, Math.floor(90000 / data.material.length));
    const mat = data.material.map((m) => `### File: ${m.name}\n${m.text.slice(0, per)}`).join("\n\n");
    const past = data.pastEmds.length ? `\n\nPREVIOUS-YEAR EMDs (style reference ONLY — study their structure, wording, difficulty and frequently tested concepts; NEVER copy or lightly reword their questions):\n${data.pastEmds.map((p) => `### ${p.name}\n${p.text.slice(0, 12000)}`).join("\n\n")}` : "";
    const typeRule = data.qtype === "SCQ"
      ? "Each question is an SCQ (QCS): exactly ONE correct option among 4–5."
      : "Each question is an MCQ (QCM): 5 options (A–E) with ONE OR MORE correct options (usually 2–3).";
    const system = `You are Wisen AI, writing ${data.mode === "exam" ? "an original EMD exam simulation" : "practice questions"} for 1st-year medical students at the Faculty of Medicine, Université Ferhat Abbas Sétif 1. ${STRICT} ${typeRule} Difficulty: ${data.difficulty}. ${LANG} ${NOTATION}
Return JSON only: {"questions":[{"stem":"...","options":["..."],"answers":[0-based indices of correct options],"explanation":"why the answer(s) are right and the others wrong","source":"file name and page/section if known"}]}`;
    const user = `Write exactly ${data.count} questions on: ${[data.subject, data.unit, data.lesson].filter(Boolean).join(" → ")}.\n\nCOURSE MATERIAL:\n${mat}${past}`;
    if (!total) throw new Error("The selected material has no readable text.");
    const r = await wisenComplete([{ role: "system", content: system }, { role: "user", content: user }], { json: true });
    if (!r.ok) throw new Error(r.error === "credits" ? "Wisen AI is out of credits right now." : r.error === "busy" ? "Wisen AI is busy — try again in a minute." : "Wisen AI couldn't generate questions. Try again.");
    const parsed = parseJson<{ questions?: RawQ[] }>(r.text);
    const rows = (parsed?.questions ?? []).flatMap((q) => {
      const options = (q.options ?? []).map(String).filter(Boolean).slice(0, 6);
      const answers = [...new Set((q.answers ?? []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < options.length))];
      if (!q.stem || options.length < 2 || !answers.length) return [];
      return [{ user_id: context.userId, qtype: data.qtype, subject: data.subject, unit: data.unit, lesson: data.lesson, difficulty: data.difficulty, stem: String(q.stem), options, answers: data.qtype === "SCQ" ? answers.slice(0, 1) : answers, explanation: String(q.explanation ?? ""), source: String(q.source ?? ""), origin: data.mode }];
    });
    if (!rows.length) throw new Error("Wisen AI couldn't generate questions from this material. Try another selection.");
    const { data: saved, error } = await context.supabase.from("ai_questions").insert(rows).select("*");
    if (error) throw new Error("Couldn't save the questions.");
    return saved;
  });

export const generateFlashcards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ subject: z.string().max(120), scope: z.string().max(300), count: z.number().int().min(4).max(30), outputLanguage: z.literal('English').optional(), material }).parse(d))
  .handler(async ({ data, context }) => {
    const per = Math.max(2000, Math.floor(90000 / data.material.length));
    const mat = data.material.map((m) => `### File: ${m.name}\n${m.text.slice(0, per)}`).join("\n\n");
    const system = `You are Wisen AI, making active-recall Kapsules (active-recall cards) for 1st-year medical students (Faculty of Medicine, Sétif 1). ${STRICT} Cover the most important concepts, definitions, mechanisms, numbers and classic exam traps. Fronts are short questions or cloze prompts; backs are concise (1–3 lines). ${data.outputLanguage === 'English' ? 'Write every front, back and tip in English, even when the source material is in French or another language.' : LANG} ${NOTATION}
Return JSON only: {"cards":[{"front":"...","back":"...","tip":"short high-yield tip or source (file/page)"}]}`;
    const r = await wisenComplete([{ role: "system", content: system }, { role: "user", content: `Make ${data.count} Kapsules (active-recall cards) for: ${data.scope}\n\nMATERIAL:\n${mat}` }], { json: true });
    if (!r.ok) throw new Error(r.error === "credits" ? "Wisen AI is out of credits right now." : r.error === "busy" ? "Wisen AI is busy — try again in a minute." : "Wisen AI couldn't generate Kapsules. Try again.");
    const parsed = parseJson<{ cards?: { front?: string; back?: string; tip?: string }[] }>(r.text);
    const rows = (parsed?.cards ?? []).filter((c) => c.front && c.back).map((c) => ({ user_id: context.userId, subject: data.subject, scope_label: data.scope, front: String(c.front), back: String(c.back), tip: String(c.tip ?? "") }));
    if (!rows.length) throw new Error("Wisen AI couldn't build Kapsules from this material.");
    const { data: saved, error } = await context.supabase.from("ai_flashcards").insert(rows).select("*");
    if (error) throw new Error("Couldn't save the Kapsules.");
    return saved;
  });
