import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { seedCards } from "./data";
import { log, update, useAppState } from "./store";
import { Button } from "@/components/ui/button";

const ratings = [
  { l: "Again", t: "<1m", ms: 60e3, st: "learning" },
  { l: "Hard", t: "6m", ms: 6 * 60e3, st: "learning" },
  { l: "Good", t: "1d", ms: 864e5, st: "review" },
  { l: "Easy", t: "4d", ms: 4 * 864e5, st: "review" },
] as const;

export function Flashcards() {
  const s = useAppState();
  const [flipped, setFlipped] = useState(false);
  const all = useMemo(() => [...seedCards, ...s.customCards], [s.customCards]);
  const now = Date.now();
  const due = all.filter((c) => (s.cards[c.id]?.due ?? 0) <= now);
  const card = due[0];
  const counts = { New: all.filter((c) => !s.cards[c.id]).length, Learning: all.filter((c) => s.cards[c.id]?.status === "learning").length, Review: all.filter((c) => s.cards[c.id]?.status === "review").length };

  const rate = (r: (typeof ratings)[number]) => {
    update((st) => ({ ...st, cards: { ...st.cards, [card.id]: { due: Date.now() + r.ms, status: r.st } } }));
    setFlipped(false);
    if (due.length === 1) log("Finished today's flashcard queue");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold">{due.length} cards due today</p>
        <div className="flex gap-2 font-mono text-xs">
          {Object.entries(counts).map(([k, v]) => <span key={k} className="rounded-md border border-border px-2 py-1">{k} <b className="text-primary">{v}</b></span>)}
        </div>
      </div>
      {card ? (
        <>
          <button onClick={() => setFlipped(!flipped)} className="group block h-72 w-full [perspective:1200px]" aria-label="Flip card">
            <div className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""}`}>
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center [backface-visibility:hidden]">
                <span className="mb-4 font-mono text-[11px] uppercase text-primary">{card.topic}</span>
                <p className="font-serif text-2xl">{card.front}</p>
                <span className="mt-6 text-xs text-muted-foreground">Tap to reveal answer</span>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-primary/40 bg-card p-8 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <p className="text-lg">{card.back}</p>
                <p className="mt-5 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">High-yield tip: {card.tip}</p>
              </div>
            </div>
          </button>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {ratings.map((r) => (
              <Button key={r.l} variant={r.l === "Good" ? "default" : "outline"} disabled={!flipped} onClick={() => rate(r)} className="h-auto flex-col py-2">
                <span>{r.l}</span><span className="font-mono text-[10px] opacity-70">{r.t}</span>
              </Button>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <p className="font-serif text-2xl">All caught up.</p>
          <p className="mt-2 text-sm text-muted-foreground">Come back later for your next reviews.</p>
          <Button variant="outline" className="mt-5" onClick={() => update((st) => ({ ...st, cards: {} }))}><RotateCcw /> Reset deck</Button>
        </div>
      )}
    </div>
  );
}
