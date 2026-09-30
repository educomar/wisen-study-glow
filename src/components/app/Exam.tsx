import { Clock, Flag } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { allQuestions } from "./QBank";
import { getState, log, practice, recordAttempt, setTab, update, useAppState, type ExamSession } from "./store";
import { Button } from "@/components/ui/button";

const COUNTS = [10, 20, 30, 40];
const DURATIONS = [10, 15, 20, 30, 45, 60, 90];
const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
const setE = (patch: Partial<ExamSession>) => update((st) => ({ ...st, exam: { ...st.exam, ...patch } }));

function submit() {
  const st = getState();
  const e = st.exam;
  if (e.phase !== "run") return;
  const pool = allQuestions(st);
  const qs = e.qids.map((id) => pool.find((q) => q.id === id)!).filter(Boolean);
  qs.forEach((q, k) => recordAttempt(q.topic, e.answers[k] === q.answer));
  const score = qs.filter((q, k) => e.answers[k] === q.answer).length;
  const used = Math.min(e.minutes * 60, Math.round((Date.now() - (e.endsAt - e.minutes * 60e3)) / 1000));
  log(`EMD Exam Mode · ${e.subject} — ${score}/${qs.length}`);
  update((s) => ({ ...s, exam: { ...s.exam, phase: "done", usedSec: used }, examHistory: [{ t: Date.now(), subject: e.subject, score, total: qs.length }, ...s.examHistory].slice(0, 20) }));
}

export function Exam() {
  const s = useAppState();
  const e = s.exam;
  const pool = allQuestions(s);
  const [, tick] = useState(0);
  const left = Math.max(0, Math.round((e.endsAt - Date.now()) / 1000));

  const onTick = useCallback(() => {
    tick((n) => n + 1);
    const cur = getState().exam;
    if (cur.phase === "run" && Date.now() >= cur.endsAt) submit();
  }, []);
  useEffect(() => {
    if (e.phase !== "run") return;
    const t = setInterval(onTick, 1000);
    return () => clearInterval(t);
  }, [e.phase, onTick]);

  if (e.phase === "setup") {
    const subs = [...new Set(pool.map((q) => q.subject))];
    const avail = pool.filter((q) => e.subject === "All" || q.subject === e.subject).length;
    const start = () => {
      const qs = pool.filter((q) => e.subject === "All" || q.subject === e.subject).sort(() => Math.random() - 0.5).slice(0, e.count);
      setE({ phase: "run", qids: qs.map((q) => q.id), answers: qs.map(() => null), flags: qs.map(() => false), i: 0, endsAt: Date.now() + e.minutes * 60e3, usedSec: 0 });
    };
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs uppercase text-primary">EMD Simulation · Faculty of Medicine Sétif 1</p>
        <h2 className="mt-2 font-serif text-4xl">Set up your exam</h2>
        <div className="mt-6 space-y-5 text-sm">
          <label className="block"><span className="mb-1.5 block font-medium">Subject</span>
            <select value={e.subject} onChange={(ev) => setE({ subject: ev.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-2 outline-none focus:border-primary"><option value="All">All subjects (mixed EMD)</option>{subs.map((x) => <option key={x}>{x}</option>)}</select>
          </label>
          <div><span className="mb-1.5 block font-medium">Number of questions</span>
            <div className="grid grid-cols-4 gap-2">{COUNTS.map((c) => <button key={c} onClick={() => setE({ count: c, minutes: Math.max(10, Math.round(c * 1.5 / 5) * 5) })} className={`rounded-md border py-2 font-mono ${e.count === c ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}>{c}</button>)}</div>
            {avail < e.count && <p className="mt-1.5 text-xs text-muted-foreground">Only {avail} questions are in the QBank for this subject — the exam will use all {avail}.</p>}
          </div>
          <label className="block"><span className="mb-1.5 block font-medium">Duration</span>
            <select value={e.minutes} onChange={(ev) => setE({ minutes: Number(ev.target.value) })} className="h-10 w-full rounded-md border border-input bg-background px-2 outline-none focus:border-primary">{DURATIONS.map((d) => <option key={d} value={d}>{d} minutes</option>)}</select>
          </label>
          <p className="text-xs text-muted-foreground">No hints or explanations during the exam. It submits automatically when time runs out.</p>
        </div>
        <Button className="mt-6 w-full" size="lg" disabled={!avail} onClick={start}>Start exam</Button>
      </div>
    );
  }

  const qs = e.qids.map((id) => pool.find((q) => q.id === id)).filter((q): q is NonNullable<typeof q> => !!q);

  if (e.phase === "done") {
    const score = qs.filter((q, k) => e.answers[k] === q.answer).length;
    const byTopic: Record<string, { c: number; n: number; subject: string }> = {};
    qs.forEach((q, k) => { const t = (byTopic[q.topic] ??= { c: 0, n: 0, subject: q.subject }); t.n++; if (e.answers[k] === q.answer) t.c++; });
    const weak = Object.entries(byTopic).filter(([, v]) => v.c / v.n < 0.7).sort((a, b) => a[1].c / a[1].n - b[1].c / b[1].n);
    const wrong = qs.filter((q, k) => e.answers[k] !== null && e.answers[k] !== q.answer).length;
    const blank = e.answers.filter((a) => a === null).length;
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          {[["Score", `${score}/${qs.length}`], ["Accuracy", `${Math.round((score / Math.max(1, qs.length)) * 100)}%`], ["Mistakes", `${wrong} wrong · ${blank} blank`], ["Time used", fmt(e.usedSec)]].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-card p-5"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 font-serif text-3xl text-primary">{v}</p></div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-3 font-semibold">Breakdown by lesson</p>
          {Object.entries(byTopic).map(([t, v]) => (
            <div key={t} className="mb-2 text-sm"><div className="flex justify-between"><span>{v.subject} · {t}</span><span className="font-mono">{v.c}/{v.n}</span></div><div className="mt-1 h-1.5 rounded-full bg-muted"><div className={`h-full rounded-full ${v.c / v.n < 0.7 ? "bg-destructive/80" : "bg-primary"}`} style={{ width: `${(v.c / v.n) * 100}%` }} /></div></div>
          ))}
        </div>
        {weak.length > 0 && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
            <p className="font-semibold">Diagnosed weak areas</p>
            {weak.map(([t, v]) => (
              <div key={t} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="flex-1">{v.subject} · {t} — {Math.round((v.c / v.n) * 100)}%</span>
                <Button size="sm" variant="outline" onClick={() => setTab("workspace")}>Review Lecture — 5 min</Button>
                <Button size="sm" onClick={() => practice(v.subject, t)}>Start targeted practice</Button>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-3 font-semibold">Mistake review</p>
          {qs.map((q, k) => e.answers[k] !== q.answer && (
            <div key={q.id} className="border-t border-border py-3 text-sm first:border-0">
              <p>{k + 1}. {q.stem}</p>
              <p className="mt-1 text-destructive">Your answer: {e.answers[k] === null ? "—" : q.options[e.answers[k]!]}</p>
              <p className="text-primary">Correct: {q.options[q.answer]}</p>
              <p className="mt-1 text-muted-foreground">{q.why}</p>
            </div>
          ))}
          {score === qs.length && <p className="text-sm text-muted-foreground">Perfect score — no mistakes.</p>}
        </div>
        <Button variant="outline" onClick={() => setE({ phase: "setup" })}>New exam</Button>
      </div>
    );
  }

  const q = qs[e.i];
  if (!q) return null;
  const answer = (k: number) => setE({ answers: e.answers.map((a, j) => (j === e.i ? k : a)) });
  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1fr_15rem]">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-xs text-muted-foreground">Question {e.i + 1} of {qs.length} · {q.subject}</p>
          <Button size="sm" variant={e.flags[e.i] ? "default" : "outline"} onClick={() => setE({ flags: e.flags.map((f, j) => (j === e.i ? !f : f)) })}><Flag /> {e.flags[e.i] ? "Marked" : "Mark for review"}</Button>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed">{q.stem}</p>
        <div className="mt-5 space-y-2">
          {q.options.map((o, k) => (
            <label key={o + k} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm ${e.answers[e.i] === k ? "border-primary bg-primary/5" : "border-border"}`}>
              <input type="radio" name={q.id} checked={e.answers[e.i] === k} onChange={() => answer(k)} className="accent-[var(--primary)]" />
              {String.fromCharCode(65 + k)}. {o}
            </label>
          ))}
        </div>
        <div className="mt-6 flex justify-between">
          <Button variant="outline" disabled={e.i === 0} onClick={() => setE({ i: e.i - 1 })}>Previous</Button>
          {e.i < qs.length - 1 ? <Button onClick={() => setE({ i: e.i + 1 })}>Next</Button> : <Button onClick={() => { if (confirm("Submit your exam now?")) submit(); }}>Submit exam</Button>}
        </div>
      </div>
      <aside className="space-y-3 lg:order-none">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground">Time remaining</p>
          <p className={`mt-1 flex items-center justify-center gap-1.5 font-mono text-3xl ${left < 60 ? "text-destructive" : ""}`}><Clock className="size-5" />{fmt(left)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-xs font-semibold">Question palette</p>
          <div className="grid grid-cols-5 gap-1.5">
            {qs.map((_, k) => (
              <button key={k} onClick={() => setE({ i: k })} className={`relative size-9 rounded-md border font-mono text-xs ${k === e.i ? "border-primary bg-primary text-primary-foreground" : e.answers[k] !== null ? "border-primary/40 bg-primary/10" : "border-border"}`}>
                {k + 1}{e.flags[k] && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-destructive" />}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">{e.answers.filter((a) => a !== null).length} answered · {e.flags.filter(Boolean).length} marked</p>
          <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => { if (confirm("Submit your exam now?")) submit(); }}>Submit exam</Button>
        </div>
      </aside>
    </div>
  );
}
