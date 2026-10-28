import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Eye, Loader2, Plus, Save, Send, Trash2, Undo2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { inp, sel, useAction, useHierarchy, useServerFn } from "@/components/admin/team-context";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { deleteExamSet, saveExamQuestions, saveExamSet, setExamStatus } from "@/lib/exams.functions";
import { resourceDownloadUrl, resourceUploadUrl, saveResource } from "@/lib/team.functions";
import { ExamScopePicker } from "./ExamScopePicker";
import { examScopeName } from "@/lib/exam-scope";

type Kind = "past_emd" | "ai_generated";
import { questionDraftSchema, type ExamDraftQuestion as Q } from "@/lib/exam-ingestion";
import { ExamIngestionPanel } from "./ExamIngestionPanel";
import { ExamQuestionCards } from "./ExamQuestionCards";
import { useLang } from "@/lib/i18n";
type Meta = { title: string; subject_id: string; unit_id: string | null; exam_year: string; session: "normal" | "rattrapage"; emd_number: string; has_corrige: boolean; semester: "" | "S1" | "S2" };
const STATUS: Record<string, string> = { uploaded: "Uploaded", in_review: "In review", verified: "Verified", published: "Published" };
const blank: Meta = { title: "", subject_id: "", unit_id: null, exam_year: "", session: "normal", emd_number: "", has_corrige: false, semester: "" };

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
      <ExamIngestionPanel kind={kind} subjectId={subj} unitId={null} onQuestions={() => {}} onSaved={() => void list.refetch()} />
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
  const { t } = useLang();
  const act = useAction();
  const [m, setM] = useState<Meta>(set ? { title: set.title, subject_id: set.subject_id, unit_id: set.unit_id, exam_year: set.exam_year, session: set.session, emd_number: set.emd_number, has_corrige: set.has_corrige, semester: set.semester ?? "" } : blank);
  const [qs, setQs] = useState<Q[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const save = useServerFn(saveExamSet), saveQs = useServerFn(saveExamQuestions), setSt = useServerFn(setExamStatus), del = useServerFn(deleteExamSet);
  const view = useServerFn(resourceDownloadUrl);
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
    void Promise.resolve(supabase.from("exam_set_questions").select("*").eq("set_id", set.id).order("position")).then(({ data }) =>
      setQs((data ?? []).map((q) => questionDraftSchema.parse({ ...q, verified: q.verified && q.answer_source !== "missing" && !q.review_note, format: ["QCS", "QCM_MULTI", "QCM_REGRP", "CAS_CLIN"].includes(q.format) ? q.format : "" })))).catch(() => toast.error("Could not load exam questions."));
  }, [set]);

  const subjects = h?.subjects ?? [];
  const units = (h?.units ?? []).filter((u) => u.subject_id === m.subject_id);

  const saveMeta = async () => {
    if (!m.title.trim() || !m.subject_id) { toast.error("Add a title and subject."); return; }
    const r = await act(save({ data: { ...m, kind, id: set?.id } }), set ? "Details saved" : "Exam created");
    if (r && !set) onCreated(r.id);
  };
  const saveAll = async () => { if (!set) return; await act(saveQs({ data: { setId: set.id, questions: qs } }), `${qs.length} questions saved`); };
  const status = async (s: "uploaded" | "in_review" | "verified" | "published") => {
    if (!set) return;
    if (s === "verified" || s === "published") {
      const saved = await act(saveQs({ data: { setId: set.id, questions: qs } }));
      if (!saved) return;
    }
    await act(setSt({ data: { id: set.id, status: s } }), `Status: ${STATUS[s]}`);
  };

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
        {kind === "past_emd" ? <div className="min-w-0 sm:col-span-2"><ExamScopePicker value={m} onChange={(scope) => { setM({ ...m, ...scope, semester: "" }); setQs((qs) => qs.map((q) => ({ ...q, lesson_ids: [], verified: false }))); }} /></div> : <>
          <label className="text-xs text-muted-foreground">Subject / Module<select className={`${sel} w-full`} value={m.subject_id} onChange={(e) => setM({ ...m, subject_id: e.target.value, unit_id: null, semester: "" })}><option value="">Choose…</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.department} Y{s.academic_year}</option>)}</select></label>
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

      {h?.subjects.find((s) => s.id === m.subject_id)?.academic_year === 1 && <label className="block text-xs text-muted-foreground">{t("Semester")}<select className={`${sel} ml-2`} value={m.semester} onChange={(e) => setM({ ...m, semester: e.target.value as Meta["semester"] })}><option value="">{t("Not specified")}</option><option>S1</option><option>S2</option></select></label>}
      {set && <>
        <ExamIngestionPanel kind={kind} subjectId={m.subject_id} unitId={m.unit_id} setId={set.id} onQuestions={(add) => setQs((q) => [...q, ...add])} onSaved={onClose} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setQs((d) => [...d, { stem: "", options: ["", ""], answers: [], explanation: "", format: "", verified: false, lesson_ids: [], option_comments: [], trap_phrase: "", trap_explanation: "", answer_source: "missing", review_note: "", source_pages: [] }])}><Plus /> {t("Add question")}</Button>
          <Button size="sm" disabled={!!busy} onClick={saveAll}><Save />{t("Save questions")}</Button>
        </div>
        <ExamQuestionCards questions={qs} subjectId={m.subject_id} unitId={m.unit_id} onChange={setQs} />
      </>}
    </div>
  );
}
