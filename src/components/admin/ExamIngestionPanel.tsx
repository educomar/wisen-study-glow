import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2, Save, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { extractExamFile, EXAM_FILE_ACCEPT } from "@/lib/exam-files";
import { parseExamJson, uniqueQuestions, validateSemester, type ExamDraftQuestion, type ExtractedPage, type PaperDraft } from "@/lib/exam-ingestion";
import { discoverExamPapers, enrichExamQuestions, extractExamQuestions, generateSourceExam } from "@/lib/exam-ingestion.functions";
import { saveExamQuestions, saveExamSet } from "@/lib/exams.functions";
import { area, inp, sel, useHierarchy } from "./team-context";
import { ExamScopePicker } from "./ExamScopePicker";
import { ExamQuestionCards } from "./ExamQuestionCards";

type ReviewPaper = PaperDraft & { questions: ExamDraftQuestion[]; savedId?: string | undefined };
export function ExamIngestionPanel({ kind, subjectId, unitId, setId, onQuestions, onSaved }: { kind: "past_emd" | "ai_generated"; subjectId: string; unitId: string | null; setId?: string; onQuestions: (qs: ExamDraftQuestion[]) => void; onSaved: () => void }) {
  const { t, lang } = useLang();
  const { data: h } = useHierarchy();
  const input = useRef<HTMLInputElement>(null), stop = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState("");
  const [pages, setPages] = useState<ExtractedPage[]>([]), [papers, setPapers] = useState<ReviewPaper[]>([]);
  const [active, setActive] = useState(0), [raw, setRaw] = useState(""), [count, setCount] = useState(20);
  const [format, setFormat] = useState<"mixed" | "QCS" | "QCM_MULTI">("mixed"), [prompt, setPrompt] = useState("");
  const discover = useServerFn(discoverExamPapers), extract = useServerFn(extractExamQuestions), enrich = useServerFn(enrichExamQuestions), generate = useServerFn(generateSourceExam);
  const save = useServerFn(saveExamSet), saveQs = useServerFn(saveExamQuestions);
  const check = () => { if (stop.current?.signal.aborted) throw new Error(t("Processing stopped")); };
  const perform = async (fn: () => Promise<void>) => {
    stop.current = new AbortController(); setBusy(true);
    try { await fn(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); setProgress(""); }
  };
  const blankPaper = (title: string): ReviewPaper => ({ title, subject_id: subjectId || null, unit_id: unitId, exam_year: "", semester: "", session: "normal", emd_number: "", start_page: 1, end_page: 1, review_note: "", questions: [] });
  const enrichAll = async (qs: ExamDraftQuestion[], sid: string, uid: string | null) => {
    const result: ExamDraftQuestion[] = [];
    for (let i = 0; i < qs.length; i += 8) {
      check(); setProgress(`${t("Adding comments and lessons")} ${i + 1}–${Math.min(i + 8, qs.length)}/${qs.length}`);
      const batch = await enrich({ data: { subjectId: sid, unitId: uid, questions: qs.slice(i, i + 8), language: lang } }); check(); result.push(...batch);
    }
    return result;
  };
  const loadFile = async (file: File) => perform(async () => {
    const result = await extractExamFile(file, setProgress, stop.current?.signal); check();
    setPages(result.pages); setRaw(""); setActive(0);
    if (result.pages.some((p) => p.ocr)) toast.warning(t("OCR was used. Review wording and corrections carefully."));
    if (result.json && kind === "past_emd") {
      const imported = parseExamJson(result.json).papers;
      setPapers(imported.map((p) => ({ ...blankPaper(p.title ?? file.name), ...p, questions: p.questions })));
      if (setId && imported.length === 1 && subjectId) {
        const qs = await enrichAll(imported[0]?.questions ?? [], subjectId, unitId);
        onQuestions(qs); setPapers([]);
      }
    } else if (kind === "past_emd") {
      setProgress(t("Detecting subjects and exam years"));
      const detected = await discover({ data: { pages: result.pages.map(({ number, text }) => ({ number, text })), subjectId: subjectId || undefined } }); check();
      setPapers(detected.map((p) => ({ ...p, questions: [] })));
    } else { setProgress(t("Course text extracted")); }
  });
  const processPaper = async (index: number) => {
    const p = papers[index]; if (!p?.subject_id) throw new Error(t("Choose a subject first."));
    const subject = h?.subjects.find((s) => s.id === p.subject_id); if (!subject) throw new Error(t("Choose a subject first."));
    validateSemester(subject.academic_year, p.semester);
    let qs = p.questions;
    if (!qs.length) {
      const text = pages.filter((page) => page.number >= p.start_page && page.number <= p.end_page).map((page) => `[Page ${page.number}]\n${page.text}`).join("\n");
      if (text.length > 160000) throw new Error(t("Split this paper into smaller page ranges (maximum 160,000 characters)."));
      let offset = 0, total = 1; qs = [];
      while (offset < total) {
        check(); setProgress(`${t("Extracting questions")} ${offset + 1}`);
        const batch = await extract({ data: { text, offset, count: 8 } }); check();
        if (!batch.questions.length) throw new Error(t("No questions found."));
        qs.push(...batch.questions); offset += batch.questions.length; total = batch.total;
        setPapers((ps) => ps.map((x, i) => i === index ? { ...x, questions: uniqueQuestions(qs) } : x));
      }
    }
    const ready = await enrichAll(uniqueQuestions(qs), p.subject_id, p.unit_id);
    setPapers((ps) => ps.map((x, i) => i === index ? { ...x, questions: ready } : x));
  };
  const runGeneration = async () => perform(async () => {
    if (!subjectId) throw new Error(t("Choose a subject first."));
    const material = raw.trim() || pages.map((p) => `[Page ${p.number}]\n${p.text}`).join("\n");
    if (material.length < 50 || material.length > 160000) throw new Error(t("Provide 50–160,000 characters of course material."));
    const qs: ExamDraftQuestion[] = [];
    for (let i = 0; i < count; i += 8) {
      check(); setProgress(`${t("Generating questions")} ${i + 1}/${count}`);
      const batch = await generate({ data: { subjectId, material, count: Math.min(8, count - i), format, language: lang, prompt, previousStems: qs.map((q) => q.stem) } }); check(); qs.push(...batch);
    }
    const ready = await enrichAll(uniqueQuestions(qs), subjectId, unitId);
    if (setId) onQuestions(ready);
    else setPapers([{ ...blankPaper("EMD Simulation"), end_page: Math.max(1, pages.length), questions: ready }]);
  });
  const current = papers[active];
  const patchPaper = (p: Partial<ReviewPaper>) => setPapers((ps) => ps.map((x, i) => i === active ? { ...x, ...p } : x));
  return <section className="space-y-4 border-y border-border py-5">
    <div className="flex flex-wrap items-center gap-2"><FileText className="size-5 text-primary" /><h3 className="mr-auto font-semibold">{t(kind === "past_emd" ? "Upload & extract exam archive" : "Upload lessons & generate exam")}</h3>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}><Upload />{t(kind === "past_emd" ? "Upload exam files" : "Upload course files")}</Button>
      <input ref={input} type="file" accept={EXAM_FILE_ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void loadFile(f); }} />
    </div>
    <p className="text-xs text-muted-foreground">PDF · DOCX · PPTX/POTX · JSON · TXT — {t("50 MB per file · 300 PDF pages")}</p>
    {busy && <div role="status" className="flex items-center gap-2 rounded-md border border-border p-3 text-sm"><Loader2 className="size-4 animate-spin" /><span className="min-w-0 flex-1">{progress}</span><Button size="sm" variant="ghost" onClick={() => stop.current?.abort()}><X />{t("Stop")}</Button></div>}
    {!!pages.length && <p className="text-xs text-muted-foreground">{pages.length} {t("pages extracted")} · {pages.reduce((n, p) => n + p.text.length, 0).toLocaleString()} {t("characters")}</p>}
    {!papers.length && kind === "past_emd" && <details><summary className="cursor-pointer text-sm">{t("Paste exam text instead")}</summary><textarea className={`${area} mt-2`} rows={5} value={raw} onChange={(e) => setRaw(e.target.value)} /><Button size="sm" className="mt-2" disabled={busy || raw.trim().length < 10} onClick={() => perform(async () => { const source = [{ number: 1, text: raw }]; setPages(source); setProgress(t("Detecting subjects and exam years")); const detected = await discover({ data: { pages: source, subjectId: subjectId || undefined } }); check(); setPapers(detected.map((p) => ({ ...p, questions: [] }))); })}><Sparkles />{t("Detect exams")}</Button></details>}
    {kind === "ai_generated" && <div className="space-y-3"><textarea className={area} rows={4} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={t("Course material (or upload a file)")} /><div className="flex flex-wrap items-center gap-2"><input aria-label={t("Question count")} className={`${inp} w-20`} type="number" min={3} max={200} value={count} onChange={(e) => setCount(Math.max(3, Math.min(200, Number(e.target.value))))} /><select aria-label={t("Question format")} className={sel} value={format} onChange={(e) => setFormat(e.target.value as typeof format)}><option value="mixed">{t("Mixed MCQ / QCS")}</option><option value="QCM_MULTI">MCQ</option><option value="QCS">QCS</option></select><Button size="sm" disabled={busy || !subjectId} onClick={runGeneration}><Sparkles />{t("Generate draft")}</Button></div><details><summary className="cursor-pointer text-sm">{t("Faculty simulation prompt (optional)")}</summary><textarea className={`${area} mt-2`} rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></details></div>}
    {!!papers.length && <><div className="flex flex-wrap gap-2">{papers.map((p, i) => <Button key={i} size="sm" variant={active === i ? "default" : "outline"} onClick={() => setActive(i)}>{i + 1}. {p.title || t("Exam")} · {p.questions.length}</Button>)}</div>
      {current && <div className="space-y-3"><input aria-label={t("Exam title")} className={inp} value={current.title} onChange={(e) => patchPaper({ title: e.target.value })} /><ExamScopePicker value={{ subject_id: current.subject_id ?? "", unit_id: current.unit_id }} onChange={(p) => patchPaper({ ...p, semester: "", questions: current.questions.map((q) => ({ ...q, lesson_ids: [], verified: false })) })} />
        <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs text-muted-foreground">{t("Exam calendar year")}<input className={inp} value={current.exam_year} onChange={(e) => patchPaper({ exam_year: e.target.value })} /></label><label className="text-xs text-muted-foreground">{t("Session")}<select className={`${sel} w-full`} value={current.session} onChange={(e) => patchPaper({ session: e.target.value as PaperDraft["session"] })}><option value="normal">Normal</option><option value="rattrapage">Rattrapage</option></select></label>{h?.subjects.find((s) => s.id === current.subject_id)?.academic_year === 1 && <label className="text-xs text-muted-foreground">{t("Semester")}<select className={`${sel} w-full`} value={current.semester} onChange={(e) => patchPaper({ semester: e.target.value as PaperDraft["semester"] })}><option value="">{t("Not specified")}</option><option>S1</option><option>S2</option></select></label>}
          <label className="text-xs text-muted-foreground">{t("First page")}<input className={inp} type="number" min={1} max={pages.length} value={current.start_page} onChange={(e) => patchPaper({ start_page: Number(e.target.value), questions: [] })} /></label><label className="text-xs text-muted-foreground">{t("Last page (include correction)")}<input className={inp} type="number" min={current.start_page} max={pages.length} value={current.end_page} onChange={(e) => patchPaper({ end_page: Number(e.target.value), questions: [] })} /></label><label className="text-xs text-muted-foreground">EMD<input className={inp} value={current.emd_number} onChange={(e) => patchPaper({ emd_number: e.target.value })} /></label></div>
        <label className="block text-xs text-muted-foreground">{t("Archive review warning")}<textarea className={area} rows={2} value={current.review_note} onChange={(e) => patchPaper({ review_note: e.target.value })} /></label>
        <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy || !current.subject_id} onClick={() => perform(() => processPaper(active))}><Sparkles />{t(current.questions.length ? "Add comments & lesson suggestions" : "Confirm scope & extract")}</Button>{setId && papers.length === 1 && current.subject_id === subjectId && <Button size="sm" variant="outline" disabled={busy || !current.questions.length || !!current.review_note} onClick={() => { onQuestions(current.questions); setPapers([]); }}>{t("Use in this exam")}</Button>}
        <Button size="sm" variant="outline" disabled={busy || !papers.every((p) => p.subject_id && p.questions.length && !p.review_note)} onClick={() => perform(async () => {
          for (let i = 0; i < papers.length; i++) {
            check(); const p = papers[i]; if (!p?.subject_id) throw new Error(t("Choose a subject first."));
            setProgress(`${t("Saving exam drafts")} ${i + 1}/${papers.length}`);
            const saved = await save({ data: { id: p.savedId, kind, title: p.title, subject_id: p.subject_id, unit_id: p.unit_id, semester: p.semester, exam_year: p.exam_year, session: p.session, emd_number: p.emd_number, has_corrige: p.questions.every((q) => q.answers.length > 0) } });
            setPapers((ps) => ps.map((x, j) => i === j ? { ...x, savedId: saved.id } : x));
            await saveQs({ data: { setId: saved.id, questions: p.questions } });
          }
          toast.success(t("Exam drafts saved. Verify each exam before publishing.")); onSaved();
        })}><Save />{t("Save all as review drafts")}</Button></div>
        <ExamQuestionCards questions={current.questions} subjectId={current.subject_id ?? ""} unitId={current.unit_id} onChange={(questions) => patchPaper({ questions })} />
      </div>}
    </>}
  </section>;
}