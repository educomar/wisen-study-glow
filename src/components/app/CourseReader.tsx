import { AlertCircle, CheckCircle2, FileText, FileUp, HelpCircle, Layers, Library, Lightbulb, ListChecks, Loader2, NotebookPen, Target, Wand2, X, AlignLeft } from "lucide-react";
import { CurriculumBrowser, fetchCurriculumFile, useCurriculum, type CurFile } from "./Curriculum";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ask, pushMsgs } from "./chat";
import { lecture, type Slide } from "./data";
import { clearJump, sampleDoc, setDoc, setPage, setSubject, uploadPdf, useDoc, type Stage } from "./doc";
import { sentences } from "./grounded";
import { PdfPage } from "./PdfPage";
import { addCard, addNote, log } from "./store";
import { setTab } from "./store";
import { Button } from "@/components/ui/button";

const SUBJECTS = ["Embryology", "Anatomy", "Histology", "Pathology", "Cardiology", "Pharmacology", "Physiology"];
export const SUBJECT_LIST = SUBJECTS;
const ACTIONS = [["Explain", Lightbulb], ["Simplify", Wand2], ["Summarize", AlignLeft], ["Compare", AlignLeft], ["Exam Prep", Target], ["Make Kapsule", Layers], ["Quiz me", HelpCircle], ["Generate EMD Question", ListChecks], ["Save note", NotebookPen]] as const;
const STAGES = ["Parsing pages…", "Indexing medical content", "Ready to study"];

function Diagram({ kind }: { kind?: Slide["diagram"] }) {
  if (!kind) return null;
  const c = "h-28 w-full text-primary";
  if (kind === "layers") return <svg viewBox="0 0 300 110" className={c}><rect x="10" y="12" width="280" height="22" rx="4" fill="currentColor" opacity=".25" /><text x="20" y="27" fontSize="10" fill="currentColor">Ectoderm → neural plate</text><circle cx="150" cy="55" r="11" fill="currentColor" opacity=".7" /><text x="168" y="58" fontSize="10" fill="currentColor">Notochord (SHH, noggin, chordin)</text><rect x="10" y="76" width="280" height="22" rx="4" fill="currentColor" opacity=".12" /><text x="20" y="91" fontSize="10" fill="currentColor">Endoderm</text></svg>;
  if (kind === "tube") return <svg viewBox="0 0 300 110" className={c}><path d="M20 40 Q80 40 110 70 Q150 100 190 70 Q220 40 280 40" fill="none" stroke="currentColor" strokeWidth="3" opacity=".5" /><circle cx="150" cy="60" r="18" fill="none" stroke="currentColor" strokeWidth="3" /><text x="130" y="100" fontSize="10" fill="currentColor">Neural tube · day 22–28</text></svg>;
  if (kind === "crest") return <svg viewBox="0 0 300 110" className={c}><circle cx="150" cy="60" r="20" fill="none" stroke="currentColor" strokeWidth="3" />{[70, 100, 200, 230].map((x) => <circle key={x} cx={x} cy={30} r="5" fill="currentColor" />)}<path d="M135 42 L100 30 M165 42 L200 30" stroke="currentColor" strokeDasharray="3 3" /><text x="95" y="102" fontSize="10" fill="currentColor">Crest cells migrate (EMT)</text></svg>;
  return <svg viewBox="0 0 300 110" className={c}><rect x="140" y="10" width="20" height="90" rx="8" fill="currentColor" opacity=".3" />{[0, 1, 2, 3, 4].map((i) => <g key={i}><rect x="100" y={12 + i * 18} width="30" height="14" rx="4" fill="currentColor" opacity=".6" /><rect x="170" y={12 + i * 18} width="30" height="14" rx="4" fill="currentColor" opacity=".6" /></g>)}<text x="210" y="60" fontSize="10" fill="currentColor">Somite pairs</text></svg>;
}

export function CourseReader() {
  const { doc, page, jump, restoring } = useDoc();
  const subject = doc.subject;
  const [sel, setSel] = useState<{ text: string; page: number; x: number; y: number } | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState(false);
  const [showCourses, setShowCourses] = useState(true);
  const [reading, setReading] = useState(false);
  const { tree, signedIn } = useCurriculum();
  const readerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = readerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { if (el.clientWidth > 0) setWidth(Math.round(Math.min(el.clientWidth - 40, 1000) / 20) * 20); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const root = readerRef.current;
    if (!root) return;
    const ratios = new Map<number, number>();
    const io = new IntersectionObserver((es) => {
      if (!root.offsetParent) return;
      es.forEach((e) => ratios.set(Number((e.target as HTMLElement).dataset["page"]), e.intersectionRatio));
      let best = 0, bp = 0;
      ratios.forEach((r, p) => { if (r > best) { best = r; bp = p; } });
      if (bp) setPage(bp);
    }, { root, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
    root.querySelectorAll("[data-page]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [doc, width]);

  // Jump requests (citations, restored reading position) — wait until the reader is visible and laid out.
  useEffect(() => {
    if (jump != null) { setReading(true); setShowCourses(false); }
    if (jump == null || width === 0) return;
    let tries = 0, raf = 0;
    const tick = () => {
      const root = readerRef.current;
      const el = root?.querySelector<HTMLElement>(`[data-page="${jump}"]`);
      if (root?.offsetParent && el) { root.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" }); clearJump(); return; }
      if (tries++ < 60) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [jump, width, doc]);

  const onMouseUp = () => {
    const s = window.getSelection();
    const text = s?.toString().trim();
    if (!s || !text || !readerRef.current || s.rangeCount === 0) return setSel(null);
    const anchor = s.anchorNode instanceof Element ? s.anchorNode : s.anchorNode?.parentElement;
    const pg = Number(anchor?.closest<HTMLElement>("[data-page]")?.dataset["page"]) || page;
    const r = s.getRangeAt(0).getBoundingClientRect();
    const box = readerRef.current.getBoundingClientRect();
    setSel({ text, page: pg, x: r.left - box.left + r.width / 2, y: r.top - box.top + readerRef.current.scrollTop });
  };

  const act = (a: string) => {
    if (!sel) return;
    const q = `“${sel.text.slice(0, 110)}${sel.text.length > 110 ? "…" : ""}”`;
    const label = `${a} · ${doc.subject} · Page ${sel.page}: ${q}`;
    if (a === "Make Kapsule") {
      const ctx = sentences(doc.pages.find((p) => p.pageNumber === sel.page)?.text ?? "")[0] ?? "";
      addCard(`${doc.subject} p.${sel.page}: explain “${sel.text.slice(0, 70)}”`, sel.text, ctx, doc.subject, doc.title);
      log(`Created Kapsule from ${doc.subject} · Page ${sel.page}`);
      pushMsgs({ role: "user", text: label }, { role: "ai", text: `Kapsule added to your deck [Source: Page ${sel.page}].`, cite: sel.page });
    } else if (a === "Save note") {
      addNote(sel.text, doc.subject, doc.title, sel.page);
      toast("Saved to high-yield notes");
    } else { void ask(a, sel.text, label, sel.page); setTab("ai"); }
    setSel(null);
    window.getSelection()?.removeAllRanges();
  };

  async function onFile(f?: File, subj = subject) {
    if (!f) return;
    setErr(null);
    const r = await uploadPdf(f, subj, setStage);
    if (fileRef.current) fileRef.current.value = "";
    if (r.error) return setErr(r.error);
    if (r.warning) setErr(r.warning);
    setReading(true);setShowCourses(false);
    pushMsgs({ role: "ai", text: `Now grounded in “${f.name.replace(/\.pdf$/i, "")}” (${subj}). Select any text or ask a question — I'll cite the page.`, cite: 1 });
  }

  async function openCurriculum(f: CurFile) {
    setErr(null);
    setStage({ i: 0, done: 0, total: 0, name: f.file_name });
    try {
      const file = await fetchCurriculumFile(f);
      setShowCourses(false);
      await onFile(file, f.subject);
      log(`Opened ${f.subject} · ${f.unit} · ${f.lesson}`);
    } catch (e) {
      setStage(null);
      setErr(`We couldn't open “${f.file_name}”: ${e instanceof Error ? e.message : "please try again in a moment."}`);
    }
  }

  const isSample = !!doc.sample;
  const pdf = doc.pdf;
  const subjectOptions = tree && tree.length ? tree.map((t) => t.name) : SUBJECTS;

  return (
    <div className="flex min-h-full flex-col gap-3 lg:h-full lg:min-h-0">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Button size="sm" variant={showCourses ? "default" : "outline"} onClick={() => setShowCourses(!showCourses)}><Library /> My courses</Button>
        <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
          <FileText className="size-4 shrink-0 text-primary" />
          <p className="truncate text-sm font-semibold">{doc.title}</p>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">· {doc.pages.length} pages</span>
        </div>
        {restoring && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Restoring your document…</span>}
        {!isSample && <Button size="sm" variant="ghost" onClick={() => { setDoc(sampleDoc); setErr(null); pushMsgs({ role: "ai", text: `Switched back to “${sampleDoc.title}”.`, cite: 12 }); }}>Sample lecture</Button>}
        <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={!!stage}><FileUp /> Upload PDF</Button>
      </div>
      {showCourses && <div className="max-h-[65dvh] overflow-y-auto rounded-lg border border-border bg-card"><CurriculumBrowser tree={tree} signedIn={signedIn} activeTitle={doc.title} onOpen={openCurriculum} /></div>}
      {err && <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="size-4 shrink-0" /><span className="flex-1">{err}</span><button onClick={() => setErr(null)} aria-label="Dismiss"><X className="size-4" /></button></div>}

      <div className={`min-h-0 flex-1 ${reading ? "" : "hidden"}`}>
        <section onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }} className={`relative flex min-h-[28rem] flex-col overflow-hidden rounded-xl border bg-card ${drag ? "border-primary ring-2 ring-primary/40" : "border-border"}`}>
          <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">{doc.subject} · {isSample ? `${lecture.faculty}` : "Course file"}</p>
            <span className="font-mono text-xs text-muted-foreground">Page {page} / {isSample ? (doc.pages.at(-1)?.pageNumber ?? 1) : doc.pages.length}</span>
          </header>
          {drag && <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-background/80 text-sm font-semibold text-primary">Drop your PDF to upload</div>}
          <div ref={readerRef} onMouseUp={onMouseUp} className="relative max-h-[72dvh] flex-1 overflow-y-auto bg-muted/30 p-5">
            {sel && (
              <div className="absolute z-20 flex w-max max-w-[22rem] -translate-x-1/2 -translate-y-[112%] flex-wrap gap-1 rounded-lg border border-border bg-popover p-1 shadow-xl" style={{ left: Math.min(Math.max(170, sel.x), (readerRef.current?.clientWidth ?? 400) - 170), top: sel.y }} onMouseUp={(e) => e.stopPropagation()}>
                {ACTIONS.map(([l, Icon]) => (
                  <button key={l} onMouseDown={(e) => e.preventDefault()} onClick={() => act(l)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-accent"><Icon className="size-3.5 text-primary" /> {l}</button>
                ))}
              </div>
            )}
            {!isSample && pdf ? (
              <div className="space-y-5">{width > 0 && doc.pages.map((p) => <PdfPage key={`${doc.title}-${p.pageNumber}`} pdf={pdf} n={p.pageNumber} width={width} />)}</div>
            ) : (
              <div className="space-y-5">
                {lecture.slides.map((s) => (
                  <article key={s.n} data-page={s.n} className="rounded-lg border border-border bg-card p-5 sm:p-7">
                    <p className="font-mono text-xs text-muted-foreground">Page {s.n}</p>
                    <h2 className="mt-1 font-serif text-3xl">{s.title}</h2>
                    <div className="my-4 rounded-lg border border-border bg-muted/40 p-3"><Diagram kind={s.diagram} /></div>
                    <div className="space-y-3 text-[15px] leading-relaxed">{s.body.map((b) => <p key={b}>{b}</p>)}</div>
                    <div className="mt-5 flex flex-wrap gap-2">{s.keyTerms.map((k) => <span key={k} className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs text-primary">{k}</span>)}</div>
                    <div className="mt-5 rounded-lg border-l-4 border-primary bg-primary/5 p-4 text-sm"><p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-primary">High-yield note</p>{s.highYield}</div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>


      </div>

      {stage && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm">
          <div className="w-[min(92vw,24rem)] rounded-xl border border-border bg-card p-6 shadow-2xl">
            <p className="truncate font-semibold">{stage.name}</p>
            <p className="mb-4 text-xs text-muted-foreground">{subject} · processing your course</p>
            <ol className="space-y-2.5">
              {STAGES.map((s, k) => (
                <li key={s} className={`flex items-center gap-2 text-sm ${k > stage.i ? "text-muted-foreground" : ""}`}>
                  {k < stage.i || (k === 2 && stage.i === 2) ? <CheckCircle2 className="size-4 text-primary" /> : k === stage.i ? <Loader2 className="size-4 animate-spin text-primary" /> : <span className="size-4 rounded-full border border-border" />}
                  {s}{k === 0 && stage.total > 0 && <span className="ml-auto font-mono text-xs text-muted-foreground">{stage.done}/{stage.total}</span>}
                </li>
              ))}
            </ol>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${stage.total ? ((stage.done / stage.total) * 70 + stage.i * 15) : 5}%` }} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
