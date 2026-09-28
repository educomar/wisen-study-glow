import { AlertCircle, BookOpen, CheckCircle2, FileText, FileUp, HelpCircle, Layers, Lightbulb, ListChecks, Loader2, Send, Target, Wand2, X, AlignLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { lecture, type Slide } from "./data";
import { addCard, log } from "./store";
import { respond, sentences, type AiMsg, type DocPage } from "./grounded";
import { loadPdfLib, PdfPage } from "./PdfPage";
import { Button } from "@/components/ui/button";

type Msg = { role: "user"; text: string } | AiMsg;
type Doc = { subject: string; title: string; pages: DocPage[]; pdf?: PDFDocumentProxy };

const SUBJECTS = ["Embryology", "Anatomy", "Histology", "Pathology", "Cardiology", "Pharmacology", "Physiology"];
const sampleDoc: Doc = {
  subject: "Embryology",
  title: "Embryology — Chapter 3: Neurulation",
  pages: lecture.slides.map((s) => ({ pageNumber: s.n, text: [s.title + ".", ...s.body, s.highYield].join(" ") })),
};
const ACTIONS = [["Explain", Lightbulb], ["Simplify", Wand2], ["Summarize", AlignLeft], ["Why on EMD?", Target], ["Make Flashcard", Layers], ["Quiz me", HelpCircle], ["Generate EMD Question", ListChecks]] as const;
const STAGES = ["Parsing pages…", "Indexing medical content", "Ready to study"];

function Diagram({ kind }: { kind?: Slide["diagram"] }) {
  if (!kind) return null;
  const c = "h-28 w-full text-primary";
  if (kind === "layers") return <svg viewBox="0 0 300 110" className={c}><rect x="10" y="12" width="280" height="22" rx="4" fill="currentColor" opacity=".25" /><text x="20" y="27" fontSize="10" fill="currentColor">Ectoderm → neural plate</text><circle cx="150" cy="55" r="11" fill="currentColor" opacity=".7" /><text x="168" y="58" fontSize="10" fill="currentColor">Notochord (SHH, noggin, chordin)</text><rect x="10" y="76" width="280" height="22" rx="4" fill="currentColor" opacity=".12" /><text x="20" y="91" fontSize="10" fill="currentColor">Endoderm</text></svg>;
  if (kind === "tube") return <svg viewBox="0 0 300 110" className={c}><path d="M20 40 Q80 40 110 70 Q150 100 190 70 Q220 40 280 40" fill="none" stroke="currentColor" strokeWidth="3" opacity=".5" /><circle cx="150" cy="60" r="18" fill="none" stroke="currentColor" strokeWidth="3" /><text x="130" y="100" fontSize="10" fill="currentColor">Neural tube · day 22–28</text></svg>;
  if (kind === "crest") return <svg viewBox="0 0 300 110" className={c}><circle cx="150" cy="60" r="20" fill="none" stroke="currentColor" strokeWidth="3" />{[70, 100, 200, 230].map((x) => <circle key={x} cx={x} cy={30} r="5" fill="currentColor" />)}<path d="M135 42 L100 30 M165 42 L200 30" stroke="currentColor" strokeDasharray="3 3" /><text x="95" y="102" fontSize="10" fill="currentColor">Crest cells migrate (EMT)</text></svg>;
  return <svg viewBox="0 0 300 110" className={c}><rect x="140" y="10" width="20" height="90" rx="8" fill="currentColor" opacity=".3" />{[0, 1, 2, 3, 4].map((i) => <g key={i}><rect x="100" y={12 + i * 18} width="30" height="14" rx="4" fill="currentColor" opacity=".6" /><rect x="170" y={12 + i * 18} width="30" height="14" rx="4" fill="currentColor" opacity=".6" /></g>)}<text x="210" y="60" fontSize="10" fill="currentColor">Somite pairs</text></svg>;
}

function McqView({ q }: { q: NonNullable<AiMsg["mcq"]> }) {
  const [pick, setPick] = useState<string | null>(null);
  return (
    <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3">
      <p className="font-medium">{q.stem}</p>
      {q.options ? (
        <div className="mt-2 grid gap-1.5">
          {q.options.map((o, k) => {
            const state = pick && (o === q.answer ? "border-primary bg-primary/10 text-primary" : o === pick ? "border-destructive bg-destructive/10 text-destructive" : "opacity-60");
            return <button key={o} disabled={!!pick} onClick={() => setPick(o)} className={`rounded-md border border-border px-3 py-1.5 text-left text-xs ${state || "hover:border-primary"}`}>{String.fromCharCode(65 + k)}. {o}</button>;
          })}
        </div>
      ) : !pick && <button onClick={() => setPick("x")} className="mt-2 rounded-md border border-border px-3 py-1 text-xs hover:border-primary">Reveal answer</button>}
      {pick && <p className="mt-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">{q.options ? `Answer: ${q.answer}. ` : ""}</span>{q.options ? q.explain : q.answer} {!q.options && q.explain}</p>}
    </div>
  );
}

export function Workspace() {
  const [doc, setDoc] = useState<Doc>(sampleDoc);
  const [subject, setSubject] = useState("Embryology");
  const [page, setPage] = useState(doc.pages[0]!.pageNumber);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [sel, setSel] = useState<{ text: string; page: number; x: number; y: number } | null>(null);
  const [stage, setStage] = useState<{ i: number; done: number; total: number; name: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPage(doc.pages[0]?.pageNumber ?? 1);
    setMsgs([{ role: "ai", text: `I'm grounded in “${doc.title}” (${doc.pages.length} pages). Select any text or ask a question — I'll cite the page.`, cite: doc.pages[0]?.pageNumber ?? 1 }]);
    readerRef.current?.scrollTo({ top: 0 });
  }, [doc]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs, typing]);

  useEffect(() => {
    const el = readerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.round(Math.min(el.clientWidth - 40, 1000) / 20) * 20));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const root = readerRef.current;
    if (!root) return;
    const ratios = new Map<number, number>();
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => ratios.set(Number((e.target as HTMLElement).dataset["page"]), e.intersectionRatio));
      let best = 0, bp = 0;
      ratios.forEach((r, p) => { if (r > best) { best = r; bp = p; } });
      if (bp) setPage(bp);
    }, { root, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
    root.querySelectorAll("[data-page]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [doc, width]);

  const reply = (action: string, query: string, display: string, p = page) => {
    setMsgs((m) => [...m, { role: "user", text: display }]);
    setTyping(true);
    setTimeout(() => {
      setMsgs((m) => [...m, respond(action, query, doc.pages, p, doc.subject)]);
      setTyping(false);
    }, 550);
  };
  const send = (t: string) => { if (!t.trim()) return; setInput(""); reply("Ask", t, t); };

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
    if (a === "Make Flashcard") {
      const ctx = sentences(doc.pages.find((p) => p.pageNumber === sel.page)?.text ?? "")[0] ?? "";
      addCard(`${doc.subject} p.${sel.page}: explain “${sel.text.slice(0, 70)}”`, sel.text, ctx, doc.subject);
      log(`Created flashcard from ${doc.subject} · Page ${sel.page}`);
      setMsgs((m) => [...m, { role: "user", text: label }, { role: "ai", text: `Flashcard added to your deck [Source: Page ${sel.page}].`, cite: sel.page }]);
    } else reply(a, sel.text, label, sel.page);
    setSel(null);
    window.getSelection()?.removeAllRanges();
  };

  const goto = (p: number) => readerRef.current?.querySelector(`[data-page="${p}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  async function onFile(f?: File) {
    if (!f) return;
    setErr(null);
    if (!f.name.toLowerCase().endsWith(".pdf") && f.type !== "application/pdf") return setErr(`“${f.name}” isn't a PDF. Please upload a .pdf course file.`);
    if (f.size > 80 * 1024 * 1024) return setErr("This PDF is larger than 80 MB. Please upload a smaller file.");
    const buf = new Uint8Array(await f.arrayBuffer());
    if (!(buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)) return setErr("This file looks corrupted or isn't a real PDF.");
    const name = f.name.replace(/\.pdf$/i, "");
    setStage({ i: 0, done: 0, total: 0, name });
    try {
      const lib = await loadPdfLib();
      const pdf = await lib.getDocument({ data: buf }).promise;
      const pages: DocPage[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const tc = await (await pdf.getPage(n)).getTextContent();
        pages.push({ pageNumber: n, text: tc.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("") });
        setStage({ i: 0, done: n, total: pdf.numPages, name });
      }
      setStage({ i: 1, done: pdf.numPages, total: pdf.numPages, name });
      await new Promise((r) => setTimeout(r, 500));
      setStage({ i: 2, done: pdf.numPages, total: pdf.numPages, name });
      await new Promise((r) => setTimeout(r, 450));
      setDoc({ subject, title: name, pages, pdf });
      log(`Uploaded ${subject} course · ${name} (${pdf.numPages} pages)`);
      if (!pages.some((p) => p.text.trim())) setErr("No selectable text found — this looks like a scanned PDF. You can read it, but Wisen AI can't cite it yet.");
    } catch (e) {
      setErr((e as Error)?.name === "PasswordException" ? "This PDF is password-protected. Please upload an unlocked copy." : "We couldn't read this PDF. It may be corrupted or damaged.");
    } finally {
      setStage(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const isSample = !doc.pdf;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <select value={subject} onChange={(e) => { setSubject(e.target.value); if (doc.pdf) setDoc({ ...doc, subject: e.target.value }); }} aria-label="Subject" className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary">
          {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
          <FileText className="size-4 shrink-0 text-primary" />
          <p className="truncate text-sm font-semibold">{doc.title}</p>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">· {doc.pages.length} pages</span>
        </div>
        {!isSample && <Button size="sm" variant="ghost" onClick={() => { setDoc(sampleDoc); setSubject("Embryology"); setErr(null); }}>Sample lecture</Button>}
        <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={!!stage}><FileUp /> Upload Course PDF</Button>
      </div>
      {err && <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="size-4 shrink-0" /><span className="flex-1">{err}</span><button onClick={() => setErr(null)} aria-label="Dismiss"><X className="size-4" /></button></div>}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.15fr_1fr]">
        <section onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }} className={`relative flex min-h-[28rem] flex-col overflow-hidden rounded-xl border bg-card ${drag ? "border-primary ring-2 ring-primary/40" : "border-border"}`}>
          <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">{doc.subject} · {isSample ? `${lecture.faculty}` : "Your upload"}</p>
            <span className="font-mono text-xs text-muted-foreground">Page {page} / {isSample ? doc.pages.at(-1)!.pageNumber : doc.pages.length}</span>
          </header>
          {drag && <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-background/80 text-sm font-semibold text-primary">Drop your PDF to upload</div>}
          <div ref={readerRef} onMouseUp={onMouseUp} className="relative flex-1 overflow-y-auto bg-muted/30 p-5">
            {sel && (
              <div className="absolute z-20 flex w-max max-w-[22rem] -translate-x-1/2 -translate-y-[112%] flex-wrap gap-1 rounded-lg border border-border bg-popover p-1 shadow-xl" style={{ left: Math.min(Math.max(170, sel.x), (readerRef.current?.clientWidth ?? 400) - 170), top: sel.y }} onMouseUp={(e) => e.stopPropagation()}>
                {ACTIONS.map(([l, Icon]) => (
                  <button key={l} onMouseDown={(e) => e.preventDefault()} onClick={() => act(l)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-accent"><Icon className="size-3.5 text-primary" /> {l}</button>
                ))}
              </div>
            )}
            {doc.pdf ? (
              <div className="space-y-5">{width > 0 && doc.pages.map((p) => <PdfPage key={`${doc.title}-${p.pageNumber}`} pdf={doc.pdf!} n={p.pageNumber} width={width} />)}</div>
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
                <p className="text-center text-xs text-muted-foreground">Tip: select any text for Explain, Summarize, flashcards and EMD questions — or drop a PDF here.</p>
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-border bg-card">
          <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-primary/15 text-primary"><BookOpen className="size-4" /></span>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Wisen AI</p><p className="truncate text-xs text-muted-foreground">Grounded in {doc.title}</p></div>
            <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] text-primary">Context: {doc.subject} · Page {page}</span>
          </header>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {msgs.map((m, k) =>
              m.role === "user" ? (
                <div key={k} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{m.text}</div>
              ) : (
                <div key={k} className="max-w-[94%] text-sm">
                  <p>{m.text}</p>
                  {m.points && <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/90">{m.points.map((p) => <li key={p}>{p}</li>)}</ul>}
                  {m.mcq && <McqView q={m.mcq} />}
                  {m.cite && <button onClick={() => goto(m.cite!)} className="mt-2 inline-flex rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-primary hover:bg-accent">[Source: {doc.subject} · Page {m.cite}]</button>}
                </div>
              ),
            )}
            {typing && <div className="flex gap-1">{[0, 1, 2].map((d) => <span key={d} className="size-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${d * 120}ms` }} />)}</div>}
            <div ref={endRef} />
          </div>
          <div className="border-t border-border p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {["Summarize this page", "What's high-yield for EMD?", "Generate an EMD question"].map((c) => (
                <button key={c} onClick={() => reply(c.startsWith("Summarize") ? "Summarize" : c.startsWith("Generate") ? "Generate EMD Question" : "Why on EMD?", doc.pages.find((p) => p.pageNumber === page)?.text ?? "", `${c} (Page ${page})`)} className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary hover:text-primary">{c}</button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask about page ${page}…`} className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
              <Button type="submit" size="icon" className="size-10" aria-label="Send"><Send /></Button>
            </form>
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
