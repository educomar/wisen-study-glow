import { AlertTriangle, Bookmark, BookmarkCheck, Check, ChevronRight, Layers, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { questions, type Question } from "./data";
import { addCard, log, recordAttempt, update, useAppState } from "./store";
import { Button } from "@/components/ui/button";

export function QuestionView({ q, onNext }: { q: Question; onNext?: () => void }) {
  const s = useAppState();
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  const saved = s.bookmarks.includes(q.id);

  const pick = (k: number) => {
    if (done) return;
    setPicked(k);
    recordAttempt(q.topic, k === q.answer);
    log(`QBank · ${q.topic} — ${k === q.answer ? "correct" : "incorrect"}`);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-7">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[11px] uppercase text-primary">EMD · {q.topic}</span>
        <Button size="sm" variant="ghost" onClick={() => { update((st) => ({ ...st, bookmarks: saved ? st.bookmarks.filter((b) => b !== q.id) : [...st.bookmarks, q.id] })); toast(saved ? "Bookmark removed" : "Question bookmarked"); }}>
          {saved ? <BookmarkCheck className="text-primary" /> : <Bookmark />} {saved ? "Bookmarked" : "Bookmark"}
        </Button>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed">{q.stem}</p>
      <div className="mt-5 space-y-2">
        {q.options.map((o, k) => {
          const state = !done ? "" : k === q.answer ? "border-primary bg-primary/10" : k === picked ? "border-destructive bg-destructive/10" : "opacity-60";
          return (
            <button key={o} onClick={() => pick(k)} className={`flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-left text-sm transition hover:border-primary/60 ${state}`}>
              <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border font-mono text-xs">{String.fromCharCode(65 + k)}</span>
              <span className="flex-1">{o}</span>
              {done && k === q.answer && <Check className="size-4 text-primary" />}
              {done && k === picked && k !== q.answer && <X className="size-4 text-destructive" />}
            </button>
          );
        })}
      </div>
      {done && (
        <div className="mt-6 space-y-4 text-sm">
          <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4">
            <p className="font-semibold">{picked === q.answer ? "Correct." : "Incorrect."} Why {String.fromCharCode(65 + q.answer)} is right</p>
            <p className="mt-1 text-foreground/85">{q.why}</p>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold">Why the others are wrong</p>
            {q.distractors.map((d, k) => d && <p key={k} className="text-muted-foreground"><span className="font-mono text-foreground">{String.fromCharCode(65 + k)}.</span> {d}</p>)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-border px-2 py-1 font-mono text-xs text-primary">Reference · Embryology · Slide {q.slide}</span>
            <Button size="sm" variant="outline" onClick={() => { addCard(q.stem, q.options[q.answer], q.why, q.topic); toast("Saved as flashcard"); }}><Layers /> Save as Flashcard</Button>
            {onNext && <Button size="sm" className="ml-auto" onClick={onNext}>Next <ChevronRight /></Button>}
          </div>
        </div>
      )}
    </div>
  );
}

export function QBank({ topic }: { topic?: string }) {
  const s = useAppState();
  const pool = topic ? questions.filter((q) => q.topic === topic) : questions;
  const [i, setI] = useState(0);
  const q = pool[i % pool.length];
  const weak = Object.entries(s.attempts).map(([t, a]) => ({ t, pct: Math.round((a.correct / a.total) * 100), n: a.total })).sort((a, b) => a.pct - b.pct)[0];

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1fr_16rem]">
      <div>
        <p className="mb-3 font-mono text-xs text-muted-foreground">Question {(i % pool.length) + 1} of {pool.length}{topic && ` · Targeted: ${topic}`}</p>
        <QuestionView key={q.id + i} q={q} onNext={() => setI(i + 1)} />
      </div>
      <aside className="space-y-3">
        {weak && weak.pct < 60 && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 text-destructive" /> Weak area detected</p>
            <p className="mt-1 text-muted-foreground">{weak.t} — {weak.pct}% accuracy</p>
          </div>
        )}
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="mb-3 font-semibold">Session performance</p>
          {Object.entries(s.attempts).map(([t, a]) => {
            const pct = Math.round((a.correct / a.total) * 100);
            return (
              <div key={t} className="mb-2">
                <div className="flex justify-between text-xs"><span>{t}</span><span className="font-mono">{pct}%</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
