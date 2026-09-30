import { AlertTriangle, Bookmark, BookmarkCheck, Check, ChevronLeft, ChevronRight, Clock, Layers, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { questions, type Question } from "./data";
import { openPage } from "./doc";
import { addCard, getState, log, practice, recordAttempt, toggle, update, useAppState, type AppState, type QSession } from "./store";
import { Button } from "@/components/ui/button";

export const allQuestions = (s: AppState) => [...questions, ...s.customQuestions];

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary";
const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

export function QuestionView({ q, picked: pickedProp, onPick, onNext, onPrev }: { q: Question; picked?: number | null; onPick?: (k: number) => void; onNext?: (() => void) | undefined; onPrev?: (() => void) | undefined }) {
  const s = useAppState();
  const [local, setLocal] = useState<number | null>(null);
  const picked = onPick ? (pickedProp ?? null) : local;
  const done = picked !== null;
  const saved = s.bookmarks.includes(q.id);

  const pick = (k: number) => {
    if (done) return;
    if (onPick) onPick(k); else setLocal(k);
    recordAttempt(q.topic, k === q.answer);
    log(`QBank · ${q.subject} · ${q.topic} — ${k === q.answer ? "correct" : "incorrect"}`);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[11px] uppercase text-primary">EMD · {q.subject}</span>
          <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] uppercase text-muted-foreground">{q.topic}</span>
          <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] uppercase text-muted-foreground">{q.difficulty}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={() => { update((st) => ({ ...st, bookmarks: toggle(st.bookmarks, q.id) })); toast(saved ? "Bookmark removed" : "Question bookmarked"); }}>
          {saved ? <BookmarkCheck className="text-primary" /> : <Bookmark />} {saved ? "Bookmarked" : "Bookmark"}
        </Button>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed">{q.stem}</p>
      <div className="mt-5 space-y-2">
        {q.options.map((o, k) => {
          const state = !done ? "" : k === q.answer ? "border-primary bg-primary/10" : k === picked ? "border-destructive bg-destructive/10" : "opacity-60";
          return (
            <button key={o + k} onClick={() => pick(k)} className={`flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-left text-sm transition hover:border-primary/60 ${state}`}>
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
          {q.distractors.some(Boolean) && (
            <div className="space-y-1.5">
              <p className="font-semibold">Why the others are wrong</p>
              {q.distractors.map((d, k) => d && <p key={k} className="text-muted-foreground"><span className="font-mono text-foreground">{String.fromCharCode(65 + k)}.</span> {d}</p>)}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {q.source ? (
              <button onClick={() => openPage(q.slide)} className="rounded-md border border-border px-2 py-1 font-mono text-xs text-primary hover:bg-accent">Reference · {q.source} · Page {q.slide}</button>
            ) : (
              <span className="rounded-md border border-border px-2 py-1 font-mono text-xs text-primary">Reference · {q.subject} · Slide {q.slide}</span>
            )}
            <Button size="sm" variant="outline" onClick={() => { addCard(q.stem, q.options[q.answer]!, q.why, q.topic, q.source); toast("Saved as flashcard"); }}><Layers /> Save as Flashcard</Button>
          </div>
        </div>
      )}
      {(onPrev || onNext) && (
        <div className="mt-6 flex justify-between border-t border-border pt-4">
          <Button size="sm" variant="ghost" disabled={!onPrev} onClick={onPrev}><ChevronLeft /> Previous</Button>
          <Button size="sm" disabled={!onNext} onClick={onNext}>Next <ChevronRight /></Button>
        </div>
      )}
    </div>
  );
}

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

function filtered(pool: Question[], f: Pick<QSession, "subject" | "lesson" | "difficulty">) {
  return pool.filter((q) => (f.subject === "All" || q.subject === f.subject) && (f.lesson === "All" || q.topic === f.lesson) && (f.difficulty === "All" || q.difficulty === f.difficulty));
}

export function QBank({ context, defaultSubject }: { context?: string | undefined; defaultSubject?: string }) {
  const s = useAppState();
  const pool = useMemo(() => [...questions, ...s.customQuestions], [s.customQuestions]);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);

  const session: QSession = s.qbank ?? { subject: defaultSubject ?? "All", lesson: "All", difficulty: "All", order: [], i: 0, answers: {}, startedAt: Date.now() };
  // Build the question order lazily when filters change (targeted practice sets order: []).
  useEffect(() => {
    const cur = getState().qbank;
    if (cur && cur.order.length) return;
    const base = cur ?? session;
    update((st) => ({ ...st, qbank: { ...base, order: shuffle(filtered(pool, base)).map((q) => q.id), i: 0, answers: base.answers, startedAt: base.startedAt || Date.now() } }));
  }, [s.qbank, pool]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (patch: Partial<QSession>) => {
    const f = { ...session, ...patch };
    if (patch.subject) f.lesson = "All";
    update((st) => ({ ...st, qbank: { ...f, order: shuffle(filtered(pool, f)).map((q) => q.id), i: 0, answers: {}, startedAt: Date.now() } }));
  };
  const setI = (i: number) => update((st) => ({ ...st, qbank: st.qbank && { ...st.qbank, i } }));

  const subjects = [...new Set(pool.map((q) => q.subject))];
  const lessons = [...new Set(pool.filter((q) => session.subject === "All" || q.subject === session.subject).map((q) => q.topic))];
  const list = session.order.map((id) => pool.find((q) => q.id === id)).filter((q): q is Question => !!q);
  const q = list[Math.min(session.i, list.length - 1)];
  const answered = Object.keys(session.answers).filter((id) => session.order.includes(id));
  const correct = answered.filter((id) => pool.find((x) => x.id === id)?.answer === session.answers[id]).length;
  const elapsed = Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000));

  const stats = Object.entries(s.attempts).map(([t, a]) => ({ t, pct: Math.round((a.correct / a.total) * 100), n: a.total, subject: pool.find((x) => x.topic === t)?.subject ?? "Course" })).sort((a, b) => a.pct - b.pct);
  const weak = stats[0];

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_17rem]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <select aria-label="Subject" value={session.subject} onChange={(e) => setFilter({ subject: e.target.value })} className={sel}><option value="All">All subjects</option>{subjects.map((x) => <option key={x}>{x}</option>)}</select>
          <select aria-label="Lesson" value={session.lesson} onChange={(e) => setFilter({ lesson: e.target.value })} className={sel}><option value="All">All lessons</option>{lessons.map((x) => <option key={x}>{x}</option>)}</select>
          <select aria-label="Difficulty" value={session.difficulty} onChange={(e) => setFilter({ difficulty: e.target.value })} className={sel}>{["All", "Easy", "Medium", "Hard"].map((x) => <option key={x} value={x}>{x === "All" ? "Any difficulty" : x}</option>)}</select>
          <span className="ml-auto flex items-center gap-1.5 font-mono text-sm"><Clock className="size-4 text-primary" />{fmt(elapsed)}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className="font-mono text-muted-foreground">{list.length ? `Question ${Math.min(session.i, list.length - 1) + 1} of ${list.length}` : "No questions"} · {answered.length} answered · {correct} correct{context && ` · ${context}`}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setFilter({})}><RotateCcw /> New session</Button>
          </div>
        </div>
        {q ? (
          <QuestionView key={q.id} q={q} picked={session.answers[q.id] ?? null} onPick={(k) => update((st) => ({ ...st, qbank: st.qbank && { ...st.qbank, answers: { ...st.qbank.answers, [q.id]: k } } }))} onPrev={session.i > 0 ? () => setI(session.i - 1) : undefined} onNext={session.i < list.length - 1 ? () => setI(session.i + 1) : undefined} />
        ) : (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">No questions match these filters yet. Try another subject, lesson or difficulty.</div>
        )}
        {list.length > 0 && session.i === list.length - 1 && answered.length === list.length && (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">Session complete — {correct}/{list.length} correct ({Math.round((correct / list.length) * 100)}%) in {fmt(elapsed)}. <button className="font-semibold text-primary underline-offset-2 hover:underline" onClick={() => setFilter({})}>Start a new session</button></div>
        )}
      </div>
      <aside className="space-y-3">
        {weak && weak.pct < 65 && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 text-destructive" /> Weak area detected</p>
            <p className="mt-1 text-muted-foreground">{weak.subject}: {weak.t} — {weak.pct}% accuracy</p>
            <Button size="sm" className="mt-3 w-full" onClick={() => practice(weak.subject, weak.t)}>Practice this weak area</Button>
          </div>
        )}
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="mb-3 font-semibold">Performance by lesson</p>
          {stats.map((a) => (
            <button key={a.t} onClick={() => practice(a.subject, a.t)} className="mb-2 block w-full rounded-md p-1 text-left hover:bg-accent">
              <div className="flex justify-between text-xs"><span>{a.t}</span><span className="font-mono">{a.pct}%</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-muted"><div className={`h-full rounded-full ${a.pct < 65 ? "bg-destructive/80" : "bg-primary"}`} style={{ width: `${a.pct}%` }} /></div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
