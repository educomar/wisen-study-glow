import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Eye, Loader2, Plus, Save, Send, Sparkles, Trash2, Undo2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { area, inp, sel, useAction, useHierarchy, useServerFn } from "@/components/admin/team-context";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { deleteExamSet, generateAiExam, saveExamQuestions, saveExamSet, setExamStatus } from "@/lib/exams.functions";
import { aiParseQuestions, resourceDownloadUrl, resourceUploadUrl, saveResource } from "@/lib/team.functions";
import { ExamScopePicker } from "./ExamScopePicker";
import { examScopeName } from "@/lib/exam-scope";

type Kind = "past_emd" | "ai_generated";
type Q = { stem: string; options: string[]; answers: number[]; explanation: string; format: string; verified: boolean; lesson_ids: string[] };
type Meta = { title: string; subject_id: string; unit_id: string | null; exam_year: string; session: "normal" | "rattrapage"; emd_number: string; has_corrige: boolean };
const L = "ABCDE";
const STATUS: Record<string, string> = { uploaded: "Uploaded", in_review: "In review", verified: "Verified", published: "Published" };
const blank: Meta = { title: "", subject_id: "", unit_id: null, exam_year: "", session: "normal", emd_number: "", has_corrige: false };

export function ExamSetsManager({ kind }: { kind: Kind }) {
  const { data: h } = useHierarchy();
  const [subj, setSubj] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | "new" | null>(null);
  const list = useQuery({
    queryKey: ["exam-sets", kind],
    queryFn: async () => {
      const { data } = await supabase.from("exam_sets").select("*, exam_set_questions(count)").eq("kind", kind).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const rows = (list.data ?? []).filter((r) => (!subj || r.subject_id === subj) && (!status || r.status === status));
  const subjName = (id: string) => { const s = h?.subjects.find((x) => x.id === id); return s ? `${s.name} · ${s.department} Y${s.academic_year}` : "—"; };
  const current = open && open !== "new" ? list.data?.find((r) => r.id === open) : undefined;

  if (open) return <Editor key={open} kind={kind} set={current as SetRow | undefined} onClose={() => setOpen(null)} onCreated={setOpen} />;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Subject" className={sel} value={subj} onChange={(e) => setSubj(e.target.value)}>
          <option value="">All subjects</option>
          {h?.subjects.map((s) => <option key={s.id} value={s.id}>{subjName(s.id)}</option>)}
        </select>
        <select aria-label="Status" className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button className="ml-auto" onClick={() => setOpen("new")}><Plus /> {kind === "past_emd" ? "New Past EMD" : "New AI exam"}</Button>
      </div>
      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground"><tr className="border-b border-border">
            <th className="p-3">Exam</th><th className="p-3">Subject / Module</th>
            {kind === "past_emd" && <><th className="p-3">Year</th><th className="p-3">Session</th><th className="p-3">Corrigé</th></>}
            <th className="p-3">Questions</th><th className="p-3">Status</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/50" onClick={() => setOpen(r.id)}>
                <td className="p-3 font-medium">{r.title}{r.emd_number && <span className="ml-1 text-muted-foreground">· {r.emd_number}</span>}</td>
                <td className="p-3 text-muted-foreground">{examScopeName(subjName(r.subject_id), h?.units.find((u) => u.id === r.unit_id)?.name)}</td>
                {kind === "past_emd" && <><td className="p-3">{r.exam_year || "—"}</td><td className="p-3">{r.session === "rattrapage" ? "Rattrapage" : "Normal"}</td><td className="p-3">{r.has_corrige ? "Yes" : "No"}</td></>}
                <td className="p-3">{(r.exam_set_questions as unknown as { count: number }[])[0]?.count ?? 0}</td>
                <td className="p-3"><StatusBadge s={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.data && !rows.length && <p className="p-4 text-sm text-muted-foreground">{kind === "past_emd" ? "No past EMDs yet. Upload an exam paper in Files & Sources as “Previous-year EMD”, or create one here." : "No AI exams yet. Create one to have Wisen AI draft it for review."}</p>}
      </div>
    </>
  );
}

function StatusBadge({ s }: { s: string }) {
  const tone = s === "published" ? "border-primary/40 bg-primary/10 text-primary" : s === "verified" ? "border-border bg-accent text-foreground" : "border-border text-muted-foreground";
  return <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${tone}`}>{STATUS[s] ?? s}</span>;
}

type SetRow = { id: string; status: string; resource_id: string | null } & Meta;

function Editor({ kind, set, onClose, onCreated }: { kind: Kind; set: SetRow | undefined; onClose: () => void; onCreated: (id: string) => void }) {
  const { data: h } = useHierarchy();
  const act = useAction();
  const [m, setM] = useState<Meta>(set ? { title: set.title, subject_id: set.subject_id, unit_id: set.unit_id, exam_year: set.exam_year, session: set.session, emd_number: set.emd_number, has_corrige: set.has_corrige } : blank);
  const [qs, setQs] = useState<Q[]>([]);
  const [raw, setRaw] = useState("");
  const [count, setCount] = useState(20);
  const [busy, setBusy] = useState<string | null>(null);
  const save = useServerFn(saveExamSet), saveQs = useServerFn(saveExamQuestions), setSt = useServerFn(setExamStatus), del = useServerFn(deleteExamSet);
  const parse = useServerFn(aiParseQuestions), gen = useServerFn(generateAiExam), view = useServerFn(resourceDownloadUrl);
  const uploadUrl = useServerFn(resourceUploadUrl), uploadResource = useServerFn(saveResource);

  const uploadPaper = async (file: File) => {
    if (!m.subject_id) { toast.error("Choose a subject first."); return; }
    setBusy("upload");
    try {
      const up = await uploadUrl({ data: { fileName: file.name } });
      const { error } = await supabase.storage.from("resources").uploadToSignedUrl(up.path, up.token, file, { contentType: file.type || "application/octet-stream" });
      if (error) throw new Error("Upload failed");
      const result = await uploadResource({ data: { subject_id: m.subject_id, unit_id: m.unit_id, lesson_id: null, file_name: file.name, storage_path: up.path, mime_type: file.type || "application/octet-stream", size_bytes: file.size, kind: "past_emd" } });
      if (!("examId" in result) || !result.examId) throw new Error("Could not create the past EMD.");
      await save({ data: { ...m, title: m.title.trim() || file.name.replace(/\.[^.]+$/, ""), kind, id: result.examId } });
      await act(Promise.resolve(result), "Paper uploaded");
      onCreated(result.examId);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  useEffect(() => {
    if (!set) return;
    void supabase.from("exam_set_questions").select("*").eq("set_id", set.id).order("position").then(({ data }) =>
      setQs((data ?? []).map((q) => ({ stem: q.stem, options: q.options as string[], answers: q.answers as number[], explanation: q.explanation, format: q.format, verified: q.verified, lesson_ids: (q.lesson_ids ?? []) as string[] }))));
  }, [set]);

  const patch = (i: number, p: Partial<Q>) => setQs((d) => d.map((q, j) => (j === i ? { ...q, ...p, verified: "verified" in p ? !!p.verified : false } : q)));
  const subjects = h?.subjects ?? [];
  const units = (h?.units ?? []).filter((u) => u.subject_id === m.subject_id);

  const saveMeta = async () => {
    if (!m.title.trim() || !m.subject_id) { toast.error("Add a title and subject."); return; }
    const r = await act(save({ data: { ...m, kind, id: set?.id } }), set ? "Details saved" : "Exam created");
    if (r && !set) onCreated(r.id);
  };
  const saveAll = async () => { if (!set) return; await act(saveQs({ data: { setId: set.id, questions: qs } }), `${qs.length} questions saved`); };
  const run = async (label: string, fn: () => Promise<Q[]>) => {
    setBusy(label);
    try { const add = await fn(); setQs((d) => [...d, ...add]); toast.success(`${add.length} draft questions added — review, then save`); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const status = async (s: "uploaded" | "in_review" | "verified" | "published") => { if (set) await act(setSt({ data: { id: set.id, status: s } }), `Status: ${STATUS[s]}`); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}><X /> Back to list</Button>
        {set && <StatusBadge s={set.status} />}
        <div className="ml-auto flex flex-wrap gap-2">
          {set?.resource_id && <Button size="sm" variant="outline" onClick={async () => { if (!set.resource_id) return; const x = await act(view({ data: { id: set.resource_id } })); if (x?.url) window.open(x.url, "_blank", "noopener"); }}><Eye /> View paper</Button>}
          {set && set.status !== "published" && <Button size="sm" variant="outline" onClick={() => status("verified")}><CheckCircle2 /> Mark verified</Button>}
          {set && set.status !== "published" && <Button size="sm" onClick={() => status("published")}><Send /> Publish to students</Button>}
          {set?.status === "published" && <Button size="sm" variant="outline" onClick={() => status("in_review")}><Undo2 /> Unpublish</Button>}
          {set && <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Delete this exam and its questions? The paper file stays in Files & Sources.")) { await act(del({ data: { id: set.id } }), "Exam deleted"); onClose(); } }}><Trash2 /></Button>}
        </div>
      </div>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground sm:col-span-2">Title<input className={inp} value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} placeholder={kind === "past_emd" ? "EMD 1 Anatomie 2023" : "Wisen mock EMD — Cardiologie"} /></label>
        {kind === "past_emd" ? <div className="min-w-0 sm:col-span-2"><ExamScopePicker value={m} onChange={(scope) => setM({ ...m, ...scope })} /></div> : <>
          <label className="text-xs text-muted-foreground">Subject / Module<select className={`${sel} w-full`} value={m.subject_id} onChange={(e) => setM({ ...m, subject_id: e.target.value, unit_id: null })}><option value="">Choose…</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.department} Y{s.academic_year}</option>)}</select></label>
          <label className="text-xs text-muted-foreground">Unit (optional)<select className={`${sel} w-full`} value={m.unit_id ?? ""} disabled={!m.subject_id} onChange={(e) => setM({ ...m, unit_id: e.target.value || null })}><option value="">Whole module</option>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
        </>}
        {kind === "past_emd" && <>
          <label className="text-xs text-muted-foreground">Academic year<input className={inp} value={m.exam_year} onChange={(e) => setM({ ...m, exam_year: e.target.value })} placeholder="2023–2024" /></label>
          <label className="text-xs text-muted-foreground">Exam<input className={inp} value={m.emd_number} onChange={(e) => setM({ ...m, emd_number: e.target.value })} placeholder="EMD 1" /></label>
          <label className="text-xs text-muted-foreground">Session<select className={`${sel} w-full`} value={m.session} onChange={(e) => setM({ ...m, session: e.target.value as Meta["session"] })}><option value="normal">Normal</option><option value="rattrapage">Rattrapage</option></select></label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={m.has_corrige} onChange={(e) => setM({ ...m, has_corrige: e.target.checked })} /> Answer key (Corrigé) available</label>
        </>}
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2"><Button size="sm" disabled={!!busy} onClick={saveMeta}><Save /> {set ? "Save details" : "Create exam"}</Button>
          {kind === "past_emd" && !set && <><Button size="sm" variant="outline" disabled={!m.subject_id || !!busy} onClick={() => document.getElementById("past-emd-paper")?.click()}>{busy === "upload" ? <Loader2 className="animate-spin" /> : <Upload />} Upload exam paper</Button><input id="past-emd-paper" type="file" hidden onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void uploadPaper(file); }} /></>}
        </div>
      </section>

      {set && <>
        <section className="space-y-2 rounded-xl border border-border bg-card p-4">
          {kind === "past_emd" ? <>
            <strong className="text-sm">Transcribe the paper</strong>
            <p className="text-xs text-muted-foreground">Paste the exam text (and corrigé if available). Wisen AI structures it once; you verify every answer before publishing.</p>
            <textarea className={area} rows={6} value={raw} onChange={(e) => setRaw(e.target.value)} />
            <Button size="sm" disabled={!!busy || raw.trim().length < 20} onClick={() => run("parse", async () => (await parse({ data: { text: raw, context: m.title } })).map((q) => ({ stem: q.stem, options: q.options, answers: q.answers, explanation: q.explanation, format: "", verified: false, lesson_ids: [] })))}>{busy === "parse" ? <Loader2 className="animate-spin" /> : <Sparkles />} Structure with Wisen AI</Button>
          </> : <>
            <strong className="text-sm">Generate with Wisen AI</strong>
            <p className="text-xs text-muted-foreground">Optional: paste course material to keep questions strictly on-source. Generated once and shared with all students after approval.</p>
            <textarea className={area} rows={5} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Course material (optional)" />
            <div className="flex items-center gap-2"><input type="number" min={3} max={40} className={`${inp} w-24`} value={count} onChange={(e) => setCount(Number(e.target.value))} /><span className="text-xs text-muted-foreground">questions</span>
              <Button size="sm" disabled={!!busy} onClick={() => run("gen", async () => (await gen({ data: { setId: set.id, count, material: raw } })).map((q) => ({ ...q, lesson_ids: [] })))}>{busy === "gen" ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate draft</Button></div>
          </>}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="mr-auto text-sm">{qs.length} questions · {qs.filter((q) => q.verified).length} verified</strong>
            <Button size="sm" variant="outline" onClick={() => setQs((d) => [...d, { stem: "", options: ["", ""], answers: [], explanation: "", format: "", verified: false, lesson_ids: [] }])}><Plus /> Add question</Button>
            <Button size="sm" variant="outline" disabled={!qs.length} onClick={() => setQs((d) => d.map((q) => ({ ...q, verified: q.answers.length > 0 })))}><CheckCircle2 /> Verify all with a key</Button>
            <Button size="sm" onClick={saveAll}><Save /> Save questions</Button>
          </div>
          {qs.map((q, i) => (
            <div key={i} className={`space-y-2 rounded-xl border p-3 ${q.answers.length ? "border-border" : "border-destructive/50"} bg-card`}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><b className="text-foreground">Q{i + 1}</b>{q.format && <span className="font-mono">{q.format}</span>}
                <label className="ml-auto flex items-center gap-1"><input type="checkbox" checked={q.verified} onChange={(e) => patch(i, { verified: e.target.checked })} /> Verified</label>
                <button type="button" aria-label="Remove question" onClick={() => setQs((d) => d.filter((_, j) => j !== i))}><Trash2 className="size-4" /></button></div>
              <textarea className={area} rows={2} value={q.stem} onChange={(e) => patch(i, { stem: e.target.value })} />
              {q.options.map((o, k) => (
                <div key={k} className="flex items-center gap-2">
                  <button type="button" className={`size-7 shrink-0 rounded border text-xs font-semibold ${q.answers.includes(k) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`} onClick={() => patch(i, { answers: q.answers.includes(k) ? q.answers.filter((a) => a !== k) : [...q.answers, k].sort() })}>{L[k]}</button>
                  <input className={inp} value={o} onChange={(e) => patch(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} />
                  {q.options.length > 2 && <button type="button" aria-label="Remove option" onClick={() => patch(i, { options: q.options.filter((_, j) => j !== k), answers: q.answers.filter((a) => a !== k).map((a) => (a > k ? a - 1 : a)) })}><X className="size-4" /></button>}
                </div>
              ))}
              {q.options.length < 5 && <Button size="sm" variant="ghost" onClick={() => patch(i, { options: [...q.options, ""] })}><Plus /> Option</Button>}
              <textarea className={area} rows={2} placeholder="Explanation" value={q.explanation} onChange={(e) => patch(i, { explanation: e.target.value })} />
              <details className="rounded border border-border p-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground">Lessons ({q.lesson_ids.length ? q.lesson_ids.map((id) => h?.lessons.find((l) => l.id === id)?.name ?? "?").join(", ") : "none — whole module"})</summary>
                <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                  {units.filter((u) => !m.unit_id || u.id === m.unit_id).map((u) => (
                    <div key={u.id}><b className="text-foreground">{u.name}</b>
                      {(h?.lessons ?? []).filter((l) => l.unit_id === u.id).map((l) => (
                        <label key={l.id} className="flex items-center gap-2 py-0.5"><input type="checkbox" checked={q.lesson_ids.includes(l.id)} onChange={(e) => patch(i, { verified: q.verified, lesson_ids: e.target.checked ? [...q.lesson_ids, l.id] : q.lesson_ids.filter((x) => x !== l.id) })} />{l.name}</label>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ))}
        </section>
      </>}
    </div>
  );
}
