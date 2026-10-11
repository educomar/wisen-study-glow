import { useEffect, useSyncExternalStore } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { AiQuestion } from "./ai-store";

/** Team-managed questions visible to the signed-in student (filtered by profile via RLS). */
let remote: AiQuestion[] = [];
const subs = new Set<() => void>();
export const remoteQuestions = () => remote;

async function load() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) { remote = []; subs.forEach((f) => f()); return; }
  const [s, un, l, q] = await Promise.all([
    supabase.from("subjects").select("id,name"),
    supabase.from("units").select("id,subject_id,name"),
    supabase.from("lessons").select("id,unit_id,name"),
    supabase.from("qbank_questions").select("id,lesson_id,stem,options,answer,answers,explanation,difficulty"),
  ]);
  const lessons = new Map((l.data ?? []).map((x) => [x.id, x]));
  const units = new Map((un.data ?? []).map((x) => [x.id, x]));
  const subjects = new Map((s.data ?? []).map((x) => [x.id, x]));
  remote = (q.data ?? []).flatMap((x) => {
    const les = lessons.get(x.lesson_id); const unit = les && units.get(les.unit_id); const sub = unit && subjects.get(unit.subject_id);
    if (!les || !sub) return [];
    const opts = ((x.options as string[]) ?? []).slice(0, 5);
    const ans = (Array.isArray(x.answers) && x.answers.length ? (x.answers as number[]) : [x.answer]).filter((n) => n >= 0 && n < opts.length);
    if (!ans.length) return [];
    const multi = ans.length > 1;
    const d = ["Easy", "Medium", "Hard"].includes(x.difficulty) ? x.difficulty : "Medium";
    return [{ id: `db-${x.id}`, subject: sub.name, topic: les.name, difficulty: d as AiQuestion["difficulty"], stem: x.stem, options: opts, answer: multi ? ans.reduce((a, b) => a | (1 << b), 0) : ans[0]!, multi, origin: "faculty", unit: unit.name, why: x.explanation, distractors: [], slide: 0, source: `${sub.name} · ${unit.name}` }];
  });
  subs.forEach((f) => f());
}

export function useRemoteQuestions() {
  useEffect(() => {
    void load();
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN" || e === "SIGNED_OUT") void load(); });
    return () => data.subscription.unsubscribe();
  }, []);
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, remoteQuestions, remoteQuestions);
}
