import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

import { questions } from "./data";
import { log, recordAttempt } from "./store";
import { Button } from "@/components/ui/button";

const DURATION = 10 * 60;

export function Exam({ onReview, onPractice }: { onReview: () => void; onPractice: (topic: string) => void }) {
  const [phase, setPhase] = useState<"intro" | "run" | "done">("intro");
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<(number | null)[]>(Array(questions.length).fill(null));
  const [left, setLeft] = useState(DURATION);

  const finish = () => {
    questions.forEach((q, k) => recordAttempt(q.topic, ans[k] === q.answer));
    log(`EMD Exam Mode — ${questions.filter((q, k) => ans[k] === q.answer).length}/${questions.length}`);
    setPhase("done");
  };

  useEffect(() => {
    if (phase !== "run") return;
    if (left <= 0) return finish();
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  });

  if (phase === "intro")
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
        <p className="font-mono text-xs uppercase text-primary">EMD Simulation · Embryology</p>
        <h2 className="mt-2 font-serif text-4xl">Timed exam</h2>
        <p className="mt-3 text-sm text-muted-foreground">{questions.length} questions · 10 minutes · no AI hints. Results at the end.</p>
        <Button className="mt-6" size="lg" onClick={() => { setAns(Array(questions.length).fill(null)); setI(0); setLeft(DURATION); setPhase("run"); }}>Start exam</Button>
      </div>
    );

  if (phase === "done") {
    const score = questions.filter((q, k) => ans[k] === q.answer).length;
    const byTopic: Record<string, { c: number; n: number }> = {};
    questions.forEach((q, k) => { const t = (byTopic[q.topic] ??= { c: 0, n: 0 }); t.n++; if (ans[k] === q.answer) t.c++; });
    const weak = Object.entries(byTopic).filter(([, v]) => v.c / v.n < 0.7);
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {[["Score", `${score}/${questions.length}`], ["Accuracy", `${Math.round((score / questions.length) * 100)}%`], ["Time used", `${Math.floor((DURATION - left) / 60)}m ${(DURATION - left) % 60}s`]].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-card p-5"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 font-serif text-4xl text-primary">{v}</p></div>
          ))}
        </div>
        {weak.length > 0 && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
            <p className="font-semibold">Identified weak areas</p>
            {weak.map(([t, v]) => (
              <div key={t} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="flex-1">{t} — {Math.round((v.c / v.n) * 100)}%</span>
                <Button size="sm" variant="outline" onClick={onReview}>Review Lecture — 5 min</Button>
                <Button size="sm" onClick={() => onPractice(t)}>Practice 10 targeted questions</Button>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-3 font-semibold">Mistake review</p>
          {questions.map((q, k) => ans[k] !== q.answer && (
            <div key={q.id} className="border-t border-border py-3 text-sm first:border-0">
              <p>{k + 1}. {q.stem}</p>
              <p className="mt-1 text-destructive">Your answer: {ans[k] === null ? "—" : q.options[ans[k]!]}</p>
              <p className="text-primary">Correct: {q.options[q.answer]} · Slide {q.slide}</p>
            </div>
          ))}
          {score === questions.length && <p className="text-sm text-muted-foreground">Perfect score — no mistakes.</p>}
        </div>
        <Button variant="outline" onClick={() => setPhase("intro")}>Retake exam</Button>
      </div>
    );
  }

  const q = questions[i]!;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {questions.map((_, k) => (
            <button key={k} onClick={() => setI(k)} className={`size-8 rounded-md border font-mono text-xs ${k === i ? "border-primary bg-primary text-primary-foreground" : ans[k] !== null ? "border-primary/40 bg-primary/10" : "border-border"}`}>{k + 1}</button>
          ))}
        </div>
        <span className={`flex items-center gap-1.5 font-mono text-lg ${left < 60 ? "text-destructive" : ""}`}><Clock className="size-4" />{String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}</span>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="font-mono text-xs text-muted-foreground">Question {i + 1} of {questions.length}</p>
        <p className="mt-3 text-[15px] leading-relaxed">{q.stem}</p>
        <div className="mt-5 space-y-2">
          {q.options.map((o, k) => (
            <label key={o} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm ${ans[i] === k ? "border-primary bg-primary/5" : "border-border"}`}>
              <input type="radio" name={q.id} checked={ans[i] === k} onChange={() => setAns(ans.map((a, j) => (j === i ? k : a)))} className="accent-[var(--primary)]" />
              {String.fromCharCode(65 + k)}. {o}
            </label>
          ))}
        </div>
        <div className="mt-6 flex justify-between">
          <Button variant="outline" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</Button>
          {i < questions.length - 1 ? <Button onClick={() => setI(i + 1)}>Next</Button> : <Button onClick={finish}>Finish exam</Button>}
        </div>
      </div>
    </div>
  );
}
