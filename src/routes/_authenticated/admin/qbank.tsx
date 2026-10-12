import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileUp, History, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { area, inp, LessonPicker, PageHead, sel, useAction, useServerFn, useTeam } from "@/components/admin/team-context";
import { QBankImporter } from "@/components/admin/QBankImporter";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { deleteContent, restoreVersion, saveContent } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/admin/qbank")({ head: () => ({ meta: [{"title": "Faculty QBank Management \u2014 Wisen"}, {"name": "description", "content": "Manage faculty questions, explanations and version history."}, {"property": "og:title", "content": "Faculty QBank Management \u2014 Wisen"}, {"property": "og:description", "content": "Manage faculty questions, explanations and version history."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}] }), component: QBankAdmin });

type Q = { id: string; stem: string; options: string[]; answer: number; answers: number[] | null; explanation: string; difficulty: string; version: number };
const blank = { stem: "", options: ["", "", "", "", ""], answers: [0] as number[], explanation: "", difficulty: "Medium" };

function QBankAdmin() {
  const t = useTeam();
  const [pick, setPick] = useState({ s: "", u: "", l: "" });
  const [edit, setEdit] = useState<{ id?: string; v: typeof blank } | null>(null);
  const [hist, setHist] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);
  const ansOf = (q: Q) => (q.answers?.length ? q.answers : [q.answer]);
  const save = useServerFn(saveContent);
  const del = useServerFn(deleteContent);
  const restore = useServerFn(restoreVersion);
  const act = useAction();

  const qs = useQuery({
    queryKey: ["questions", pick.l], enabled: !!pick.l,
    queryFn: async () => ((await supabase.from("qbank_questions").select("*").eq("lesson_id", pick.l).order("created_at")).data ?? []) as unknown as Q[],
  });
  const versions = useQuery({
    queryKey: ["versions", hist], enabled: !!hist,
    queryFn: async () => (await supabase.from("question_versions").select("*").eq("question_id", hist!).order("created_at", { ascending: false })).data ?? [],
  });

  const submit = async () => {
    if (!edit) return;
    const v = edit.v;
    const options = v.options.map((o) => o.trim()).filter(Boolean);
    if (!v.stem.trim() || options.length < 2 || !v.answers.length || v.answers.some((a) => !v.options[a]?.trim())) return alert("Fill in the question, at least 2 options and mark the correct option(s).");
    const r = await act(save({ data: { table: "qbank_questions", id: edit.id, values: { stem: v.stem, explanation: v.explanation, difficulty: v.difficulty, options: v.options.filter((o) => o.trim()), answers: v.answers.map((a) => v.options.slice(0, a).filter((o) => o.trim()).length).sort(), answer: v.options.slice(0, Math.min(...v.answers)).filter((o) => o.trim()).length, lesson_id: pick.l } } }), edit.id ? "Saved — previous version kept" : "Question added");
    if (r) setEdit(null);
  };

  return (
    <>
      <PageHead title="QBank" sub="Questions live inside a lesson. Every edit keeps the previous version." />
      <LessonPicker value={pick} onChange={(v) => { setPick(v); setEdit(null); setHist(null); setBulk(false); }} />
      {pick.l && (
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap gap-2"><Button onClick={() => setEdit({ v: structuredClone(blank) })}><Plus /> New question</Button><Button variant="outline" onClick={() => setBulk(true)}><FileUp /> Bulk / JSON import</Button></div>
          {bulk && <QBankImporter lessonId={pick.l} context="UFAS1 Faculty of Medicine" onClose={() => setBulk(false)} />}
          {edit && (
            <div className="space-y-3 rounded-xl border border-primary/40 bg-card p-4">
              <textarea className={area} rows={3} placeholder="Question stem / vignette" value={edit.v.stem} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, stem: e.target.value } })} />
              {edit.v.options.map((o, k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={edit.v.answers.includes(k)} onChange={() => setEdit({ ...edit, v: { ...edit.v, answers: edit.v.answers.includes(k) ? edit.v.answers.filter((a) => a !== k) : [...edit.v.answers, k].sort() } })} aria-label={`Correct answer ${String.fromCharCode(65 + k)}`} />
                  <span className="font-mono">{String.fromCharCode(65 + k)}.</span>
                  <input className={inp} value={o} onChange={(e) => { const opts = [...edit.v.options]; opts[k] = e.target.value; setEdit({ ...edit, v: { ...edit.v, options: opts } }); }} />
                </label>
              ))}
              <textarea className={area} rows={3} placeholder="Explanation" value={edit.v.explanation} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, explanation: e.target.value } })} />
              <div className="flex gap-2">
                <select className={sel} value={edit.v.difficulty} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, difficulty: e.target.value } })}><option>Easy</option><option>Medium</option><option>Hard</option></select>
                <Button onClick={submit}>Save</Button>
                <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
              </div>
            </div>
          )}
          {qs.data?.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-2">
                <p className="flex-1 text-sm"><span className="font-mono text-muted-foreground">Q{i + 1} · v{q.version} · {q.difficulty} · {ansOf(q).length > 1 ? "QCM" : "QCU"}</span><br />{q.stem}</p>
                <Button size="icon" variant="ghost" aria-label="History" onClick={() => setHist(hist === q.id ? null : q.id)}><History /></Button>
                <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit({ id: q.id, v: { stem: q.stem, options: [...q.options, "", "", "", "", ""].slice(0, Math.max(5, q.options.length)), answers: ansOf(q), explanation: q.explanation, difficulty: q.difficulty } })}><Pencil /></Button>
                <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => confirm("Delete this question? A copy is kept in history.") && act(del({ data: { table: "qbank_questions", id: q.id, label: q.stem.slice(0, 120) } }), "Deleted")}><Trash2 /></Button>
              </div>
              <ol className="mt-2 space-y-0.5 text-sm">
                {q.options.map((o, k) => <li key={k} className={ansOf(q).includes(k) ? "text-primary" : "text-muted-foreground"}>{String.fromCharCode(65 + k)}. {o}</li>)}
              </ol>
              {hist === q.id && (
                <div className="mt-3 rounded-lg border border-border p-3 text-sm">
                  <p className="font-semibold">Version history</p>
                  {versions.data?.map((v) => {
                    const snap = v.snapshot as { stem?: string };
                    return (
                      <div key={v.id} className="flex flex-wrap items-center gap-2 border-t border-border py-2 first:border-0">
                        <span className="font-mono text-xs">v{v.version}</span>
                        <span className="flex-1 truncate text-muted-foreground">{snap.stem}</span>
                        <span className="text-xs text-muted-foreground">{v.changed_by_email} · {new Date(v.created_at).toLocaleString()} · {v.note}</span>
                        {t.role === "admin" && <Button size="sm" variant="outline" onClick={() => confirm(`Restore v${v.version}?`) && act(restore({ data: { versionId: v.id } }), "Version restored")}>Restore</Button>}
                      </div>
                    );
                  })}
                  {!versions.data?.length && <p className="text-muted-foreground">No previous versions yet.</p>}
                </div>
              )}
            </div>
          ))}
          {qs.data && !qs.data.length && <p className="text-sm text-muted-foreground">No questions in this lesson yet.</p>}
        </div>
      )}
    </>
  );
}
