import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileUp,
  HelpCircle,
  Layers,
  Library,
  Lightbulb,
  ListChecks,
  Loader2,
  NotebookPen,
  Target,
  Wand2,
  X,
  AlignLeft,
  ZoomIn,
  ZoomOut,
  ScanLine,
  ChevronDown,
} from "lucide-react";
import { CurriculumBrowser, downloadCurriculumFile, fetchCurriculumFile, useCurriculum, type CurFile } from "./Curriculum";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ask, pushMsgs } from "./chat";
import { lecture, type Slide } from "./data";
import {
  clearJump,
  sampleDoc,
  setDoc,
  setPage,
  setSubject,
  uploadPdf,
  useDoc,
  type Stage,
} from "./doc";
import { sentences } from "./grounded";
import { PdfPage } from "./PdfPage";
import { addCard, addNote, log } from "./store";
import { setTab } from "./store";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const SUBJECTS = [
  "Embryology",
  "Anatomy",
  "Histology",
  "Pathology",
  "Cardiology",
  "Pharmacology",
  "Physiology",
];
export const SUBJECT_LIST = SUBJECTS;
const ACTIONS = [
  ["Explain", Lightbulb],
  ["Simplify", Wand2],
  ["Summarize", AlignLeft],
  ["Compare", AlignLeft],
  ["Exam Prep", Target],
  ["Make Kapsule", Layers],
  ["Quiz me", HelpCircle],
  ["Generate EMD Question", ListChecks],
  ["Save note", NotebookPen],
] as const;
const STAGES = ["Parsing pages…", "Indexing medical content", "Ready to study"];
const WORKSPACE_ACTIONS = [
  ["Explain", Lightbulb],
  ["EMD Trap", Target],
  ["Make Kapsule", Layers],
  ["Quiz Me", HelpCircle],
  ["Save Note", NotebookPen],
] as const;
export type PassageSelection = { text: string; page: number; subject: string; title: string };

function Diagram({ kind }: { kind?: Slide["diagram"] }) {
  if (!kind) return null;
  const c = "h-28 w-full text-primary";
  if (kind === "layers")
    return (
      <svg viewBox="0 0 300 110" className={c}>
        <rect x="10" y="12" width="280" height="22" rx="4" fill="currentColor" opacity=".25" />
        <text x="20" y="27" fontSize="10" fill="currentColor">
          Ectoderm → neural plate
        </text>
        <circle cx="150" cy="55" r="11" fill="currentColor" opacity=".7" />
        <text x="168" y="58" fontSize="10" fill="currentColor">
          Notochord (SHH, noggin, chordin)
        </text>
        <rect x="10" y="76" width="280" height="22" rx="4" fill="currentColor" opacity=".12" />
        <text x="20" y="91" fontSize="10" fill="currentColor">
          Endoderm
        </text>
      </svg>
    );
  if (kind === "tube")
    return (
      <svg viewBox="0 0 300 110" className={c}>
        <path
          d="M20 40 Q80 40 110 70 Q150 100 190 70 Q220 40 280 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          opacity=".5"
        />
        <circle cx="150" cy="60" r="18" fill="none" stroke="currentColor" strokeWidth="3" />
        <text x="130" y="100" fontSize="10" fill="currentColor">
          Neural tube · day 22–28
        </text>
      </svg>
    );
  if (kind === "crest")
    return (
      <svg viewBox="0 0 300 110" className={c}>
        <circle cx="150" cy="60" r="20" fill="none" stroke="currentColor" strokeWidth="3" />
        {[70, 100, 200, 230].map((x) => (
          <circle key={x} cx={x} cy={30} r="5" fill="currentColor" />
        ))}
        <path d="M135 42 L100 30 M165 42 L200 30" stroke="currentColor" strokeDasharray="3 3" />
        <text x="95" y="102" fontSize="10" fill="currentColor">
          Crest cells migrate (EMT)
        </text>
      </svg>
    );
  return (
    <svg viewBox="0 0 300 110" className={c}>
      <rect x="140" y="10" width="20" height="90" rx="8" fill="currentColor" opacity=".3" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect
            x="100"
            y={12 + i * 18}
            width="30"
            height="14"
            rx="4"
            fill="currentColor"
            opacity=".6"
          />
          <rect
            x="170"
            y={12 + i * 18}
            width="30"
            height="14"
            rx="4"
            fill="currentColor"
            opacity=".6"
          />
        </g>
      ))}
      <text x="210" y="60" fontSize="10" fill="currentColor">
        Somite pairs
      </text>
    </svg>
  );
}

export function CourseReader({
  parallel = false,
  onSelectionAction,
}: {
  parallel?: boolean;
  onSelectionAction?: (action: string, selection: PassageSelection) => void;
}) {
  const { doc, page, jump, restoring } = useDoc();
  const subject = doc.subject;
  const [sel, setSel] = useState<{ text: string; page: number; x: number; y: number } | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState(false);
  const [showCourses, setShowCourses] = useState(!parallel);
  const [reading, setReading] = useState(parallel);
  const [zoom, setZoom] = useState(100);
  const { tree, signedIn } = useCurriculum();
  const readerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = readerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0) setWidth(Math.round(Math.min(el.clientWidth - 40, 1000) / 20) * 20);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const root = readerRef.current;
    if (!root) return;
    if (parallel && doc.pdf) return;
    const ratios = new Map<number, number>();
    const io = new IntersectionObserver(
      (es) => {
        if (!root.offsetParent) return;
        es.forEach((e) =>
          ratios.set(Number((e.target as HTMLElement).dataset["page"]), e.intersectionRatio),
        );
        if (parallel) {
          const top = root.getBoundingClientRect().top;
          const visible = Array.from(root.querySelectorAll<HTMLElement>("[data-page]")).filter(
            (el) => el.getBoundingClientRect().bottom > top + 24,
          );
          const first = visible[0];
          if (first) setPage(Number(first.dataset["page"]));
          return;
        }
        let best = 0,
          bp = 0;
        ratios.forEach((r, p) => {
          if (r > best) {
            best = r;
            bp = p;
          }
        });
        if (bp) setPage(bp);
      },
      { root, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );
    root.querySelectorAll("[data-page]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [doc, width, parallel]);

  // Jump requests (citations, restored reading position) — wait until the reader is visible and laid out.
  useEffect(() => {
    if (jump != null) {
      setReading(true);
      setShowCourses(false);
    }
    if (jump == null || width === 0) return;
    if (parallel && doc.pdf) {
      setPage(jump);
      readerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      readerRef.current?.focus({ preventScroll: true });
      clearJump();
      return;
    }
    let tries = 0,
      raf = 0;
    const tick = () => {
      const root = readerRef.current;
      const el = root?.querySelector<HTMLElement>(`[data-page="${jump}"]`);
      if (root?.offsetParent && el) {
        root.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" });
        clearJump();
        return;
      }
      if (tries++ < 60) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [jump, width, doc, parallel]);

  const onMouseUp = () => {
    const s = window.getSelection();
    const text = s?.toString().trim();
    if (!s || !text || !readerRef.current || s.rangeCount === 0) return setSel(null);
    const anchor = s.anchorNode instanceof Element ? s.anchorNode : s.anchorNode?.parentElement;
    const pg = Number(anchor?.closest<HTMLElement>("[data-page]")?.dataset["page"]) || page;
    const r = s.getRangeAt(0).getBoundingClientRect();
    const box = readerRef.current.getBoundingClientRect();
    if (!anchor || !readerRef.current.contains(anchor)) return setSel(null);
    setSel({
      text,
      page: pg,
      x: parallel
        ? Math.max(8, Math.min(r.left, window.innerWidth - Math.min(520, window.innerWidth - 16)))
        : r.left - box.left + r.width / 2,
      y: parallel
        ? Math.max(8, Math.min(r.bottom + 8, window.innerHeight - 112))
        : r.top - box.top + readerRef.current.scrollTop,
    });
  };

  const act = (a: string) => {
    if (!sel) return;
    if (onSelectionAction) {
      onSelectionAction(a, {
        text: sel.text,
        page: sel.page,
        subject: doc.subject,
        title: doc.title,
      });
      setSel(null);
      window.getSelection()?.removeAllRanges();
      return;
    }
    const q = `“${sel.text.slice(0, 110)}${sel.text.length > 110 ? "…" : ""}”`;
    const label = `${a} · ${doc.subject} · Page ${sel.page}: ${q}`;
    if (a === "Make Kapsule") {
      const ctx = sentences(doc.pages.find((p) => p.pageNumber === sel.page)?.text ?? "")[0] ?? "";
      addCard(
        `${doc.subject} p.${sel.page}: explain “${sel.text.slice(0, 70)}”`,
        sel.text,
        ctx,
        doc.subject,
        doc.title,
      );
      log(`Created Kapsule from ${doc.subject} · Page ${sel.page}`);
      pushMsgs(
        { role: "user", text: label },
        {
          role: "ai",
          text: `Kapsule added to your deck [Source: Page ${sel.page}].`,
          cite: sel.page,
        },
      );
    } else if (a === "Save note") {
      addNote(sel.text, doc.subject, doc.title, sel.page);
      toast("Saved to high-yield notes");
    } else {
      void ask(a, sel.text, label, sel.page);
      setTab("ai");
    }
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
    setReading(true);
    setShowCourses(false);
    pushMsgs({
      role: "ai",
      text: `Now grounded in “${f.name.replace(/\.(pdf|docx|pptx)$/i, "")}” (${subj}). Select any text or ask a question — I'll cite the page.`,
      cite: 1,
    });
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
      setErr(
        `We couldn't open “${f.file_name}” in the reader: ${e instanceof Error ? e.message : "please try again in a moment."}`,
      );
      toast("You can still download the original file.", {
        action: { label: "Download", onClick: () => void downloadCurriculumFile(f).catch(() => toast.error("Download failed.")) },
      });
    }
  }

  const isSample = !!doc.sample;
  const pdf = doc.pdf;
  const subjectOptions = tree && tree.length ? tree.map((t) => t.name) : SUBJECTS;
  const pageIndex = doc.pages.findIndex((p) => p.pageNumber === page);
  const goTo = (n: number) => {
    const target = doc.pages.find((p) => p.pageNumber === n);
    if (!target) return;
    setReading(true);
    setShowCourses(false);
    setPage(n);
    if (parallel && doc.pdf) {
      readerRef.current?.scrollTo({ top: 0 });
      return;
    }
    requestAnimationFrame(() => {
      const root = readerRef.current;
      const el = root?.querySelector<HTMLElement>(`[data-page="${n}"]`);
      if (root && el) root.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" });
    });
  };

  return (
    <div
      className={`flex min-h-full flex-col gap-3 lg:h-full lg:min-h-0 ${parallel ? "parallel-reader" : ""}`}
    >
      <div
        className={
          parallel
            ? "studio-lecture-header"
            : "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
        }
      >
        <Button
          size="sm"
          variant="ghost"
          className={parallel ? "studio-browse" : ""}
          aria-expanded={showCourses}
          onClick={() => setShowCourses(!showCourses)}
        >
          <Library />
          {parallel ? doc.subject : "My courses"}
          {parallel && <ChevronDown />}
        </Button>
        <div className="studio-title flex min-w-0 flex-1 items-center gap-2 px-1">
          <FileText className="size-4 shrink-0 text-primary" />
          <p className="truncate text-sm font-semibold">{doc.title}</p>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            · {doc.pages.length} pages
          </span>
        </div>
        {restoring && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Restoring your document…
          </span>
        )}
        {!isSample && !parallel && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDoc(sampleDoc);
              setErr(null);
              pushMsgs({ role: "ai", text: `Switched back to “${sampleDoc.title}”.`, cite: 12 });
            }}
          >
            Sample lecture
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button
          size={parallel ? "icon" : "sm"}
          variant="ghost"
          aria-label="Upload PDF, Word or PowerPoint"
          title="Upload PDF, Word or PowerPoint"
          onClick={() => fileRef.current?.click()}
          disabled={!!stage}
        >
          <FileUp />
          {!parallel && "Upload file"}
        </Button>
        {!isSample && (
          <Button
            size={parallel ? "icon" : "sm"}
            variant="ghost"
            aria-label="Download original file"
            title="Download original file"
            onClick={() => void downloadActiveDoc().then((ok) => { if (!ok) toast.error("The original file isn't available to download."); })}
          >
            <Download />
            {!parallel && "Download"}
          </Button>
        )}
      </div>
      {parallel && (
        <Sheet open={showCourses} onOpenChange={setShowCourses}>
          <SheetContent side="left" className="study-theme reference-theme studio-course-drawer">
            <SheetHeader>
              <SheetTitle>Faculty lectures</SheetTitle>
              <SheetDescription>UFAS1 Sétif · Courses & materials</SheetDescription>
            </SheetHeader>
            <CurriculumBrowser
              tree={tree}
              signedIn={signedIn}
              activeTitle={doc.title}
              onOpen={openCurriculum}
            />
          </SheetContent>
        </Sheet>
      )}
      {!parallel && showCourses && (
        <div
          className={`${parallel ? "max-h-64 shrink-0" : "max-h-[65dvh]"} overflow-y-auto rounded-lg border border-border bg-card`}
        >
          <CurriculumBrowser
            tree={tree}
            signedIn={signedIn}
            activeTitle={doc.title}
            onOpen={openCurriculum}
          />
        </div>
      )}
      {err && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr(null)} aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className={`min-h-0 flex-1 ${reading ? "" : "hidden"}`}>
        <section
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            onFile(e.dataTransfer.files[0]);
          }}
          className={`relative flex ${parallel ? "studio-document h-full min-h-0" : "min-h-[28rem] rounded-xl"} flex-col overflow-hidden border bg-card ${drag ? "border-primary ring-2 ring-primary/40" : "border-border"}`}
        >
          <header
            className={
              parallel
                ? "sr-only"
                : "flex items-center justify-between gap-2 border-b border-border px-4 py-2.5"
            }
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
              {doc.subject} · {isSample ? `${lecture.faculty}` : "Course file"}
            </p>
            <span className="font-mono text-xs text-muted-foreground">
              Page {page} / {isSample ? (doc.pages.at(-1)?.pageNumber ?? 1) : doc.pages.length}
            </span>
          </header>
          {parallel && (
            <div className="studio-reader-controls" aria-label="Reader controls">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Previous page"
                  disabled={pageIndex <= 0}
                  onClick={() => goTo(doc.pages[pageIndex - 1]?.pageNumber ?? page)}
                >
                  <ChevronLeft />
                </Button>
                <label className="studio-page-switcher">
                  Page{" "}
                  <select
                    aria-label="Lecture page"
                    value={page}
                    onChange={(e) => goTo(Number(e.target.value))}
                    className="rounded border border-input bg-background px-2 py-1"
                  >
                    {doc.pages.map((p) => (
                      <option key={p.pageNumber} value={p.pageNumber}>
                        {p.pageNumber}
                      </option>
                    ))}
                  </select>
                  <span>of {doc.pages.length}</span>
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Next page"
                  disabled={pageIndex >= doc.pages.length - 1}
                  onClick={() => goTo(doc.pages[pageIndex + 1]?.pageNumber ?? page)}
                >
                  <ChevronRight />
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Zoom out"
                  disabled={zoom <= 60}
                  onClick={() => setZoom((z) => z - 20)}
                >
                  <ZoomOut />
                </Button>
                <span className="studio-zoom">{zoom}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Zoom in"
                  disabled={zoom >= 180}
                  onClick={() => setZoom((z) => z + 20)}
                >
                  <ZoomIn />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Fit width"
                  title="Fit width"
                  onClick={() => setZoom(100)}
                >
                  <ScanLine />
                </Button>
              </div>
            </div>
          )}
          {drag && (
            <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-background/80 text-sm font-semibold text-primary">
              Drop your PDF to upload
            </div>
          )}
          <div
            ref={readerRef}
            tabIndex={-1}
            aria-label="Document pages"
            onScroll={() => {
              if (parallel) setSel(null);
            }}
            onMouseUp={onMouseUp}
            onTouchEnd={() => setTimeout(onMouseUp, 100)}
            className={`relative ${parallel ? "studio-document-scroll min-h-0" : "max-h-[72dvh]"} flex-1 overflow-auto bg-muted/30 p-5`}
          >
            {sel && (
              <div
                role="toolbar"
                aria-label="Selected passage actions"
                className={`${parallel ? "studio-selection fixed z-50" : "absolute z-20 -translate-x-1/2 -translate-y-[112%]"} flex w-max max-w-[min(33rem,calc(100vw-16px))] flex-wrap gap-1 rounded-lg border border-border bg-popover p-1 shadow-xl`}
                style={{
                  left: parallel
                    ? sel.x
                    : Math.min(Math.max(170, sel.x), (readerRef.current?.clientWidth ?? 400) - 170),
                  top: sel.y,
                }}
                onMouseUp={(e) => e.stopPropagation()}
              >
                {(parallel ? WORKSPACE_ACTIONS : ACTIONS).map(([l, Icon]) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    key={l}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => act(l)}
                    className="gap-1 px-2 text-xs"
                  >
                    <Icon className="size-3.5 text-primary" /> {l}
                  </Button>
                ))}
              </div>
            )}
            {!isSample && doc.office ? (
              <div className="space-y-5">
                {(parallel ? doc.pages.filter((p) => p.pageNumber === page) : doc.pages).map((p) => (
                  <article
                    key={`${doc.id}-${p.pageNumber}`}
                    data-page={p.pageNumber}
                    className="office-page mx-auto rounded-lg border border-border bg-card p-5 sm:p-7"
                    style={{ maxWidth: width ? Math.round((width * zoom) / 100) : undefined, fontSize: `${zoom}%` }}
                  >
                    <p className="font-mono text-xs text-muted-foreground">
                      {doc.office!.kind === "pptx" ? "Slide" : "Page"} {p.pageNumber}
                    </p>
                    <div dangerouslySetInnerHTML={{ __html: doc.office!.html[p.pageNumber] ?? "" }} />
                  </article>
                ))}
              </div>
            ) : !isSample && pdf ? (
              <div className="space-y-5">
                {width > 0 &&
                  (parallel ? doc.pages.filter((p) => p.pageNumber === page) : doc.pages).map(
                    (p) => (
                      <PdfPage
                        key={`${doc.title}-${p.pageNumber}`}
                        pdf={pdf}
                        n={p.pageNumber}
                        width={Math.round((width * zoom) / 100)}
                      />
                    ),
                  )}
              </div>
            ) : (
              <div className="space-y-5">
                {(parallel ? lecture.slides.filter((s) => s.n === page) : lecture.slides).map(
                  (s) => (
                    <article
                      key={s.n}
                      data-page={s.n}
                      className="rounded-lg border border-border bg-card p-5 sm:p-7"
                    >
                      <p className="font-mono text-xs text-muted-foreground">Page {s.n}</p>
                      <h2 className="mt-1 font-serif text-3xl">{s.title}</h2>
                      <div className="my-4 rounded-lg border border-border bg-muted/40 p-3">
                        <Diagram kind={s.diagram} />
                      </div>
                      <div className="space-y-3 text-[15px] leading-relaxed">
                        {s.body.map((b) => (
                          <p key={b}>{b}</p>
                        ))}
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {s.keyTerms.map((k) => (
                          <span
                            key={k}
                            className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs text-primary"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                      <div className="mt-5 rounded-lg border-l-4 border-primary bg-primary/5 p-4 text-sm">
                        <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-primary">
                          High-yield note
                        </p>
                        {s.highYield}
                      </div>
                    </article>
                  ),
                )}
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
                <li
                  key={s}
                  className={`flex items-center gap-2 text-sm ${k > stage.i ? "text-muted-foreground" : ""}`}
                >
                  {k < stage.i || (k === 2 && stage.i === 2) ? (
                    <CheckCircle2 className="size-4 text-primary" />
                  ) : k === stage.i ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <span className="size-4 rounded-full border border-border" />
                  )}
                  {s}
                  {k === 0 && stage.total > 0 && (
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {stage.done}/{stage.total}
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${stage.total ? (stage.done / stage.total) * 70 + stage.i * 15 : 5}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
