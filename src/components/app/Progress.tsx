import { ChevronRight, NotebookPen, Target, Trash2, TrendingUp } from "lucide-react";
import { useState } from "react";

import { seedCards } from "./data";
import { useAi } from "./ai-store";
import { openPage } from "./doc";
import { allQuestions, QuestionView } from "./QBank";
import { practice, update, useAppState } from "./store";
import { Button } from "@/components/ui/button";

export function ProgressView() {
  const s = useAppState();
  const pool = allQuestions(s);
  const lessons = Object.entries(s.attempts).filter(([, a]) => a.total > 0).map(([t, a]) => ({ t, subject: pool.find((q) => q.topic === t)?.subject ?? "Course", pct: Math.round((a.correct / a.total) * 100), n: a.total }));
  const bySubject = [...new Set(lessons.map((l) => l.subject))].map((sub) => {
    const ls = lessons.filter((l) => l.subject === sub).sort((a, b) => a.pct - b.pct);
    const c = ls.reduce((x, l) => x + (l.pct * l.n) / 100, 0), n = ls.reduce((x, l) => x + l.n, 0);
    return { sub, pct: Math.round((c / n) * 100), n, ls };
  }).sort((a, b) => a.pct - b.pct);
  const weak = [...lessons].filter((l) => l.pct < 65).sort((a, b) => a.pct - b.pct);
  const strong = [...lessons].filter((l) => l.pct >= 75).sort((a, b) => b.pct - a.pct);
  const top = weak[0];

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="font-semibold">Subject &amp; lesson breakdown</p>
        <p className="mb-4 text-xs text-muted-foreground">From your QBank practice and EMD exams. Click a lesson to practice it.</p>
        {bySubject.map((x) => (
          <div key={x.sub} className="mb-5">
            <div className="flex justify-between text-sm font-medium"><span>{x.sub}</span><span className="font-mono">{x.pct}% · {x.n} q</span></div>
            <div className="mt-1 h-2 rounded-full bg-muted"><div className={`h-full rounded-full ${x.pct < 65 ? "bg-destructive/80" : "bg-primary"}`} style={{ width: `${x.pct}%` }} /></div>
            <div className="mt-2 space-y-1 pl-3">
              {x.ls.map((l) => (
                <button key={l.t} onClick={() => practice(l.subject, l.t)} className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-accent">
                  <span>{x.sub}: {l.t} — <span className={l.pct < 65 ? "text-destructive" : "text-primary"}>{l.pct}%</span></span>
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {top && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
            <p className="flex items-center gap-2 font-mono text-xs uppercase text-destructive"><Target className="size-4" /> Targeted weak area</p>
            <p className="mt-2 font-serif text-3xl">{top.t}</p>
            <p className="text-sm text-muted-foreground">{top.subject} · {top.pct}% accuracy · {top.n} questions attempted</p>
            <Button className="mt-4" onClick={() => practice(top.subject, top.t)}>Start Targeted Practice</Button>
            {weak.length > 1 && <div className="mt-4 flex flex-wrap gap-1.5">{weak.slice(1).map((w) => <button key={w.t} onClick={() => practice(w.subject, w.t)} className="rounded-full border border-destructive/40 px-2.5 py-1 text-xs hover:bg-destructive/10">{w.t} · {w.pct}%</button>)}</div>}
          </div>
        )}
        {strong.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="flex items-center gap-2 font-semibold"><TrendingUp className="size-4 text-primary" /> Strengths</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{strong.map((l) => <span key={l.t} className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">{l.subject}: {l.t} · {l.pct}%</span>)}</div>
          </div>
        )}
        {s.examHistory.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="mb-3 font-semibold">EMD exam history</p>
            {s.examHistory.slice(0, 5).map((h) => <p key={h.t} className="flex justify-between border-b border-border py-1.5 text-sm last:border-0"><span>{h.subject === "All" ? "Mixed EMD" : h.subject}</span><span className="font-mono">{h.score}/{h.total} · {Math.round((h.score / h.total) * 100)}%</span></p>)}
          </div>
        )}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-3 font-semibold">Recent activity</p>
          <ul className="space-y-2 text-sm">
            {s.activity.slice(0, 8).map((a) => (
              <li key={a.t + a.text} className="flex justify-between gap-3 border-b border-border pb-2 last:border-0">
                <span>{a.text}</span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{new Date(a.t).toLocaleDateString(undefined, { month: "short", day: "numeric" })} {new Date(a.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const FILTERS = ["All", "Questions", "Kapsules", "Notes"] as const;

export function Saved() {
  const s = useAppState();
  const ai = useAi();
  const [f, setF] = useState<(typeof FILTERS)[number]>("All");
  const bq = allQuestions(s).filter((q) => s.bookmarks.includes(q.id));
  const cards = [...seedCards, ...s.customCards, ...ai.cards].filter((c) => s.savedCards.includes(c.id) || s.customCards.includes(c));
  const show = (k: string) => f === "All" || f === k;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((k) => {
          const n = k === "Questions" ? bq.length : k === "Kapsules" ? cards.length : k === "Notes" ? s.notes.length : bq.length + cards.length + s.notes.length;
          return <button key={k} onClick={() => setF(k)} className={`rounded-full border px-3 py-1 text-sm ${f === k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}>{k} <span className="font-mono text-xs opacity-80">{n}</span></button>;
        })}
      </div>
      {show("Questions") && (
        <div>
          <p className="mb-3 font-semibold">Bookmarked questions ({bq.length})</p>
          {bq.length ? <div className="space-y-4">{bq.map((q) => <QuestionView key={q.id} q={q} />)}</div> : <p className="text-sm text-muted-foreground">No bookmarks yet — bookmark questions in the QBank.</p>}
        </div>
      )}
      {show("Kapsules") && (
        <div>
          <p className="mb-3 font-semibold">Saved Kapsules ({cards.length})</p>
          {cards.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {cards.map((c) => <div key={c.id} className="rounded-xl border border-border bg-card p-4 text-sm"><p className="font-mono text-[10px] uppercase text-primary">{c.topic}{c.source ? ` · ${c.source}` : ""}</p><p className="mt-1 font-medium">{c.front}</p><p className="mt-1 text-muted-foreground">{c.back}</p></div>)}
            </div>
          ) : <p className="text-sm text-muted-foreground">Save cards in Kapsules, or create them from the reader and QBank.</p>}
        </div>
      )}
      {show("Notes") && (
        <div>
          <p className="mb-3 font-semibold">High-yield notes ({s.notes.length})</p>
          {s.notes.length ? (
            <div className="space-y-3">
              {s.notes.map((n) => (
                <div key={n.id} className="rounded-xl border-l-4 border-primary bg-card p-4 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-primary"><NotebookPen className="size-3" /> {n.subject} · {n.source}</p>
                    <button onClick={() => update((st) => ({ ...st, notes: st.notes.filter((x) => x.id !== n.id) }))} aria-label="Delete note" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                  </div>
                  <p dir="auto" className="mt-2 whitespace-pre-line">{n.text}</p>
                  {n.page ? <button onClick={() => openPage(n.page ?? 1)} className="mt-2 rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-primary hover:bg-accent">Open page {n.page}</button> : null}
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No notes saved yet.</p>}
        </div>
      )}
    </div>
  );
}
