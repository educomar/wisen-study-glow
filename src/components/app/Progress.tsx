import { Target } from "lucide-react";

import { questions, seedCards, subjects } from "./data";
import { QuestionView } from "./QBank";
import { useAppState } from "./store";
import { Button } from "@/components/ui/button";

export function ProgressView({ onPractice }: { onPractice: (t: string) => void }) {
  const s = useAppState();
  const weak = Object.entries(s.attempts).map(([t, a]) => ({ t, pct: Math.round((a.correct / a.total) * 100), n: a.total })).sort((a, b) => a.pct - b.pct)[0];
  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-4 font-semibold">Subject breakdown</p>
        {subjects.map((x) => (
          <div key={x.name} className="mb-3">
            <div className="flex justify-between text-sm"><span>{x.name}</span><span className="font-mono">{x.pct}%</span></div>
            <div className="mt-1 h-2 rounded-full bg-muted"><div className={`h-full rounded-full ${x.pct < 65 ? "bg-destructive/80" : "bg-primary"}`} style={{ width: `${x.pct}%` }} /></div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{x.n} questions</p>
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {weak && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
            <p className="flex items-center gap-2 font-mono text-xs uppercase text-destructive"><Target className="size-4" /> Targeted weak area</p>
            <p className="mt-2 font-serif text-3xl">{weak.t}</p>
            <p className="text-sm text-muted-foreground">{weak.pct}% accuracy · {weak.n} questions attempted</p>
            <p className="mt-2 text-sm">Recommended: re-read Slides 12–13, then 10 targeted questions.</p>
            <Button className="mt-4" onClick={() => onPractice(weak.t)}>Start Targeted Practice</Button>
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

export function Saved() {
  const s = useAppState();
  const bq = questions.filter((q) => s.bookmarks.includes(q.id));
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="mb-3 font-semibold">Bookmarked questions ({bq.length})</p>
        {bq.length ? <div className="space-y-4">{bq.map((q) => <QuestionView key={q.id} q={q} />)}</div> : <p className="text-sm text-muted-foreground">No bookmarks yet — bookmark questions in the QBank.</p>}
      </div>
      <div>
        <p className="mb-3 font-semibold">Your flashcards ({s.customCards.length})</p>
        {s.customCards.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {s.customCards.map((c) => <div key={c.id} className="rounded-xl border border-border bg-card p-4 text-sm"><p className="font-mono text-[10px] uppercase text-primary">{c.topic}</p><p className="mt-1 font-medium">{c.front}</p><p className="mt-1 text-muted-foreground">{c.back}</p></div>)}
          </div>
        ) : <p className="text-sm text-muted-foreground">Create flashcards from the reader or QBank. {seedCards.length} starter cards are in your deck.</p>}
      </div>
    </div>
  );
}
