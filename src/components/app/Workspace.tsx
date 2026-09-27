import { BookOpen, ChevronLeft, ChevronRight, HelpCircle, Layers, Lightbulb, Send, Sparkles as _s, Target, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { lecture, type Slide } from "./data";
import { addCard, log } from "./store";
import { Button } from "@/components/ui/button";

type Msg = { role: "user" | "ai"; text: string; points?: string[]; cite?: number };

function Diagram({ kind }: { kind?: Slide["diagram"] }) {
  if (!kind) return null;
  const common = "h-28 w-full text-primary";
  if (kind === "layers")
    return (
      <svg viewBox="0 0 300 110" className={common}>
        <rect x="10" y="12" width="280" height="22" rx="4" fill="currentColor" opacity=".25" />
        <text x="20" y="27" fontSize="10" fill="currentColor">Ectoderm → neural plate</text>
        <circle cx="150" cy="55" r="11" fill="currentColor" opacity=".7" />
        <text x="168" y="58" fontSize="10" fill="currentColor">Notochord (SHH, noggin, chordin)</text>
        <path d="M150 42 L150 36" stroke="currentColor" strokeWidth="2" markerEnd="url(#a)" />
        <rect x="10" y="76" width="280" height="22" rx="4" fill="currentColor" opacity=".12" />
        <text x="20" y="91" fontSize="10" fill="currentColor">Endoderm</text>
      </svg>
    );
  if (kind === "tube")
    return (
      <svg viewBox="0 0 300 110" className={common}>
        <path d="M20 40 Q80 40 110 70 Q150 100 190 70 Q220 40 280 40" fill="none" stroke="currentColor" strokeWidth="3" opacity=".5" />
        <circle cx="150" cy="60" r="18" fill="none" stroke="currentColor" strokeWidth="3" />
        <text x="130" y="100" fontSize="10" fill="currentColor">Neural tube · day 22–28</text>
      </svg>
    );
  if (kind === "crest")
    return (
      <svg viewBox="0 0 300 110" className={common}>
        <circle cx="150" cy="60" r="20" fill="none" stroke="currentColor" strokeWidth="3" />
        {[70, 100, 200, 230].map((x) => <circle key={x} cx={x} cy={x < 150 ? 30 : 30} r="5" fill="currentColor" />)}
        <path d="M135 42 L100 30 M165 42 L200 30" stroke="currentColor" strokeDasharray="3 3" />
        <text x="95" y="102" fontSize="10" fill="currentColor">Crest cells migrate (EMT)</text>
      </svg>
    );
  return (
    <svg viewBox="0 0 300 110" className={common}>
      <rect x="140" y="10" width="20" height="90" rx="8" fill="currentColor" opacity=".3" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x="100" y={12 + i * 18} width="30" height="14" rx="4" fill="currentColor" opacity=".6" />
          <rect x="170" y={12 + i * 18} width="30" height="14" rx="4" fill="currentColor" opacity=".6" />
        </g>
      ))}
      <text x="210" y="60" fontSize="10" fill="currentColor">Somite pairs</text>
    </svg>
  );
}

function answer(prompt: string, slide: Slide): Msg {
  const p = prompt.toLowerCase();
  const all = lecture.slides;
  const find = (k: string) => all.find((s) => s.title.toLowerCase().includes(k)) ?? slide;
  if (p.includes("compare") || (p.includes("tube") && p.includes("crest"))) {
    const s = find("crest");
    return { role: "ai", text: "Neural tube vs neural crest — the key EMD contrast:", points: ["Neural tube → CNS: brain, spinal cord, retina, posterior pituitary.", "Neural crest → PNS ganglia, Schwann cells, melanocytes, adrenal medulla, pia/arachnoid.", "Crest cells leave the fold tips by epithelial-to-mesenchymal transition.", "Trap: retina is neural tube, not crest."], cite: s.n };
  }
  if (p.includes("neural crest")) {
    const s = find("crest");
    return { role: "ai", text: "The neural crest is a migratory population arising at the lateral edges of the neural folds.", points: s.body.slice(1), cite: s.n };
  }
  if (p.includes("high-yield") || p.includes("why on emd")) {
    return { role: "ai", text: `Why this matters on the EMD (Slide ${slide.n}):`, points: [slide.highYield, `Expect a single-best-answer on: ${slide.keyTerms.join(", ")}.`, "Past Sétif EMDs favour derivative and timing questions."], cite: slide.n };
  }
  if (p.includes("quiz")) {
    return { role: "ai", text: `Quick check on "${slide.title}":`, points: [`Q: ${slide.keyTerms[0]} — what is its role here?`, `Hint: ${slide.highYield.split(".")[0]}.`, "Reply with your answer and I'll correct it."], cite: slide.n };
  }
  if (p.includes("simplify")) {
    return { role: "ai", text: "In plain words:", points: [slide.body[0]!.split(",")[0] + ".", `Remember one idea: ${slide.highYield.split(".")[0]}.`], cite: slide.n };
  }
  const hit = all.find((s) => s.keyTerms.some((k) => p.includes(k.toLowerCase().split(" ")[0]))) ?? slide;
  return { role: "ai", text: `Based on your lecture (Slide ${hit.n} · ${hit.title}):`, points: [...hit.body.slice(0, 2), `High-yield: ${hit.highYield}`], cite: hit.n };
}

const chips = ["What's high-yield for EMD?", "Explain the neural crest", "Quiz me on this slide", "Compare neural tube vs crest"];

export function Workspace() {
  const [i, setI] = useState(0);
  const slide = lecture.slides[i]!;
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "ai", text: "Hi! I'm grounded in your Embryology Chapter 3 lecture. Select any text on the left or ask me anything.", cite: slide.n }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [sel, setSel] = useState<{ text: string; x: number; y: number } | null>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [msgs, typing]);

  const send = (text: string, display?: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { role: "user", text: display ?? text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setMsgs((m) => [...m, answer(text, slide)]);
      setTyping(false);
      inputRef.current?.focus();
    }, 650);
  };

  const onMouseUp = () => {
    const s = window.getSelection();
    const text = s?.toString().trim();
    if (!s || !text || !readerRef.current) return setSel(null);
    const r = s.getRangeAt(0).getBoundingClientRect();
    const box = readerRef.current.getBoundingClientRect();
    setSel({ text, x: r.left - box.left + r.width / 2, y: r.top - box.top + readerRef.current.scrollTop });
  };

  const act = (a: string) => {
    if (!sel) return;
    const q = `"${sel.text.slice(0, 120)}${sel.text.length > 120 ? "…" : ""}"`;
    if (a === "Make Flashcard") {
      addCard(`Explain: ${sel.text.slice(0, 80)}`, sel.text, slide.highYield, "Embryology");
      log(`Created flashcard from Slide ${slide.n}`);
      setMsgs((m) => [...m, { role: "user", text: `Make flashcard: ${q}` }, { role: "ai", text: "Flashcard added to your deck. You'll see it in today's queue.", cite: slide.n }]);
    } else send(`${a} ${a === "Quiz me" ? "quiz" : ""} ${sel.text}`, `${a}: ${q}`);
    setSel(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[1.15fr_1fr]">
      <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-border bg-card">
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">{lecture.faculty} · {lecture.course}</p>
            <p className="truncate text-sm font-semibold">{lecture.chapter}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Previous slide"><ChevronLeft /></Button>
            <span className="font-mono text-xs text-muted-foreground">{i + 1}/{lecture.slides.length}</span>
            <Button size="icon" variant="ghost" disabled={i === lecture.slides.length - 1} onClick={() => { setI(i + 1); log(`Read Embryology · Slide ${lecture.slides[i + 1]!.n}`); }} aria-label="Next slide"><ChevronRight /></Button>
          </div>
        </header>
        <div ref={readerRef} onMouseUp={onMouseUp} className="relative flex-1 overflow-y-auto p-5 sm:p-7">
          {sel && (
            <div className="absolute z-10 flex -translate-x-1/2 -translate-y-[115%] flex-wrap gap-1 rounded-lg border border-border bg-popover p-1 shadow-xl" style={{ left: Math.max(150, sel.x), top: sel.y }} onMouseUp={(e) => e.stopPropagation()}>
              {[["Explain", Lightbulb], ["Simplify", Wand2], ["Why on EMD?", Target], ["Make Flashcard", Layers], ["Quiz me", HelpCircle]].map(([l, I]) => {
                const Icon = I as typeof Lightbulb;
                return (
                  <button key={l as string} onMouseDown={(e) => e.preventDefault()} onClick={() => act(l as string)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-accent">
                    <Icon className="size-3.5 text-primary" /> {l as string}
                  </button>
                );
              })}
            </div>
          )}
          <p className="font-mono text-xs text-muted-foreground">Slide {slide.n}</p>
          <h2 className="mt-1 font-serif text-3xl">{slide.title}</h2>
          <div className="my-4 rounded-lg border border-border bg-muted/40 p-3"><Diagram kind={slide.diagram} /></div>
          <div className="space-y-3 text-[15px] leading-relaxed">
            {slide.body.map((b) => <p key={b}>{b}</p>)}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {slide.keyTerms.map((k) => <span key={k} className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs text-primary">{k}</span>)}
          </div>
          <div className="mt-5 rounded-lg border-l-4 border-primary bg-primary/5 p-4 text-sm">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-primary">High-yield note</p>
            {slide.highYield}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">Tip: select any text to Explain, Simplify, or make a flashcard.</p>
        </div>
      </section>

      <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-border bg-card">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="grid size-8 place-items-center rounded-full bg-primary/15 text-primary"><BookOpen className="size-4" /></span>
          <div>
            <p className="text-sm font-semibold">Wisen AI</p>
            <p className="text-xs text-muted-foreground">Grounded in Embryology · Chapter 3</p>
          </div>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {msgs.map((m, k) =>
            m.role === "user" ? (
              <div key={k} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{m.text}</div>
            ) : (
              <div key={k} className="max-w-[92%] text-sm">
                <p>{m.text}</p>
                {m.points && <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/90">{m.points.map((p) => <li key={p}>{p}</li>)}</ul>}
                {m.cite && (
                  <button onClick={() => setI(lecture.slides.findIndex((s) => s.n === m.cite))} className="mt-2 inline-flex rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-primary hover:bg-accent">
                    Source · Embryology · Slide {m.cite}
                  </button>
                )}
              </div>
            ),
          )}
          {typing && <div className="flex gap-1">{[0, 1, 2].map((d) => <span key={d} className="size-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${d * 120}ms` }} />)}</div>}
          <div ref={endRef} />
        </div>
        <div className="border-t border-border p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {chips.map((c) => <button key={c} onClick={() => send(c)} className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary hover:text-primary">{c}</button>)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
            <input ref={inputRef} autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about this lecture…" className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
            <Button type="submit" size="icon" className="size-10" aria-label="Send"><Send /></Button>
          </form>
        </div>
      </section>
    </div>
  );
}
void _s;
