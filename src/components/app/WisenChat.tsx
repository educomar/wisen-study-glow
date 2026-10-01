import { BookOpen, Loader2, NotebookPen, Paperclip, RotateCcw, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { fileText } from "./ai-store";
import { AiSettings } from "./AiSettings";
import { Inline, RichText } from "./RichText";
import { ask, clearChat, useChat } from "./chat";
import { openPage, useDoc } from "./doc";
import type { AiMsg } from "./grounded";
import { addNote } from "./store";
import { Button } from "@/components/ui/button";

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

const CHIPS = ["Summarize this page", "What's high-yield for EMD?", "Generate an EMD question", "EMD & coefficients at UFAS1"];

export function WisenChat({ context }: { context?: string | undefined }) {
  const { msgs, typing } = useChat();
  const { doc, page } = useDoc();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs.length, typing]);

  const pageText = (doc.pages.find((p) => p.pageNumber === page)?.text ?? "").slice(0, 1500);
  const chip = (c: string) => {
    if (c.startsWith("EMD &")) return ask("Ask", "EMD dates, QCM correction and module coefficients at UFAS1 1ère année", c);
    const action = c.startsWith("Summarize") ? "Summarize" : c.startsWith("Generate") ? "Generate EMD Question" : "Why on EMD?";
    return ask(action, `${c} (Page ${page}): ${pageText}`, `${c} (Page ${page})`);
  };
  const [att, setAtt] = useState<{ name: string; text?: string; image?: string } | null>(null);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const onAttach = async (f?: File) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { toast.error("Please attach a file under 25 MB."); return; }
    setReading(true);
    try {
      if (f.type.startsWith("image/")) {
        const image = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
        setAtt({ name: f.name, image });
      } else if (/\.pdf$/i.test(f.name) || f.type === "application/pdf") {
        const text = await fileText(f);
        if (!text.trim()) toast.error("No readable text found in this PDF."); else setAtt({ name: f.name, text });
      } else if (f.type.startsWith("text/") || /\.(txt|md)$/i.test(f.name)) setAtt({ name: f.name, text: (await f.text()).slice(0, 38000) });
      else toast.error("Attach a PDF, image or text file.");
    } catch { toast.error("Couldn't read this file."); }
    setReading(false);
  };
  const send = () => {
    const t = input.trim() || (att ? "Analyse this file and explain its key points." : "");
    if (!t) return;
    setInput("");
    const a = att; setAtt(null);
    void ask("Ask", t, a ? `📎 ${a.name}\n${t}` : t, undefined, a ? { ...(a.image ? { image: a.image } : {}), ...(a.text ? { attachment: { name: a.name, text: a.text } } : {}) } : undefined);
  };

  return (
    <section className="flex h-full min-h-[28rem] flex-col overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="grid size-8 place-items-center rounded-full bg-primary/15 text-primary"><BookOpen className="size-4" /></span>
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Wisen AI</p><p className="truncate text-xs text-muted-foreground">Grounded in {doc.title}{context ? ` · ${context}` : ""}</p></div>
        <AiSettings />
        <button onClick={() => { clearChat(); toast("New conversation started"); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" title="New conversation" aria-label="New conversation"><RotateCcw className="size-4" /></button>
        <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] text-primary">Context: {doc.subject} · Page {page}</span>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {msgs.map((m, k) =>
          m.role === "user" ? (
            <div key={k} dir="auto" className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{m.text}</div>
          ) : (
            <div key={k} className="group max-w-[94%] text-sm">
              <RichText text={m.text} />
              {m.points && <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/90">{m.points.map((p) => <li key={p}><Inline text={p} /></li>)}</ul>}
              {m.mcq && <McqView q={m.mcq} />}
              {m.sources?.map((s) => <p key={s} className="mr-1 mt-1 inline-flex rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 font-mono text-[11px] text-primary">Source: {s}</p>)}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {m.cite ? <button onClick={() => openPage(m.cite!)} className="inline-flex rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-primary hover:bg-accent">[Source: {doc.subject} · Page {m.cite}]</button> : null}
                {k > 0 && <button onClick={() => { addNote([m.text, ...(m.points ?? [])].join("\n"), doc.subject, `Wisen AI · ${doc.title}`, m.cite); toast("Saved to high-yield notes"); }} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"><NotebookPen className="size-3" /> Save note</button>}
              </div>
            </div>
          ),
        )}
        {typing && <div className="flex gap-1">{[0, 1, 2].map((d) => <span key={d} className="size-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${d * 120}ms` }} />)}</div>}
        <div ref={endRef} />
      </div>
      <div className="border-t border-border p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {CHIPS.map((c) => <button key={c} onClick={() => void chip(c)} className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary hover:text-primary">{c}</button>)}
        </div>
        {att && <div className="mb-2 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs"><Paperclip className="size-3.5 text-primary" /><span className="flex-1 truncate">{att.name}</span><button onClick={() => setAtt(null)} aria-label="Remove attachment"><X className="size-3.5" /></button></div>}
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
          <input ref={fileRef} type="file" accept=".pdf,application/pdf,image/*,.txt,.md" className="hidden" onChange={(e) => void onAttach(e.target.files?.[0])} />
          <Button type="button" size="icon" variant="outline" className="size-10" aria-label="Attach a file" disabled={reading} onClick={() => fileRef.current?.click()}>{reading ? <Loader2 className="animate-spin" /> : <Paperclip />}</Button>
          <input value={input} onChange={(e) => setInput(e.target.value)} dir="auto" placeholder="Ask in English, Français, العربية or Darija…" className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
          <Button type="submit" size="icon" className="size-10" aria-label="Send" disabled={typing}><Send /></Button>
        </form>
      </div>
    </section>
  );
}
