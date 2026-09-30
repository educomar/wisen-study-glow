import { Bookmark, BookmarkCheck, FileText, FileUp, Loader2, RotateCcw, Wand2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { seedCards, type Card } from "./data";
import { getDoc, uploadPdf, useDoc, type Doc, type Stage } from "./doc";
import { sentences } from "./grounded";
import { log, toggle, update, useAppState, type FlashSession } from "./store";
import { Button } from "@/components/ui/button";

const ratings = [
  { l: "Again", t: "<1m", ms: 60e3, st: "learning" },
  { l: "Hard", t: "6m", ms: 6 * 60e3, st: "learning" },
  { l: "Good", t: "1d", ms: 864e5, st: "review" },
  { l: "Easy", t: "4d", ms: 4 * 864e5, st: "review" },
] as const;

/** Cloze-style cards from the document's own sentences, with page references. */
function cardsFrom(doc: Doc, max = 10): Card[] {
  const out: Card[] = [];
  for (const p of doc.pages) {
    for (const s of sentences(p.text).slice(0, 3)) {
      const term = (s.match(/[A-Za-zÀ-ÿ-]{7,}/g) ?? []).sort((a, b) => b.length - a.length)[0];
      if (!term) continue;
      out.push({ id: `f${Date.now()}${out.length}`, topic: doc.sample ? "Neurulation" : doc.subject, source: doc.title, front: s.replace(term, "_____"), back: term, tip: `${doc.title} · Page ${p.pageNumber}` });
      if (out.length >= max) return out;
      break;
    }
  }
  return out;
}

export function Flashcards() {
  const s = useAppState();
  const { doc } = useDoc();
  const [busy, setBusy] = useState<Stage | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const f = s.flash;
  const setF = (patch: Partial<FlashSession>) => update((st) => ({ ...st, flash: { ...st.flash, ...patch } }));

  const all = useMemo(() => [...seedCards, ...s.customCards], [s.customCards]);
  const deck = f.source === "doc" ? all.filter((c) => c.source === doc.title || (doc.sample && !c.source && seedCards.includes(c))) : f.source === "saved" ? all.filter((c) => s.savedCards.includes(c.id)) : all;
  const now = Date.now();
  const due = deck.filter((c) => (s.cards[c.id]?.due ?? 0) <= now);
  const card = due.find((c) => c.id === f.cardId) ?? due[0];
  const flipped = f.flipped && card?.id === f.cardId;
  const counts = { New: deck.filter((c) => !s.cards[c.id]).length, Learning: deck.filter((c) => s.cards[c.id]?.status === "learning").length, Review: deck.filter((c) => s.cards[c.id]?.status === "review").length };
  const saved = card ? s.savedCards.includes(card.id) : false;

  const rate = (r: (typeof ratings)[number]) => {
    if (!card) return;
    const next = due.filter((c) => c.id !== card.id)[0];
    update((st) => ({ ...st, cards: { ...st.cards, [card.id]: { due: Date.now() + r.ms, status: r.st } }, flash: { ...st.flash, cardId: next?.id ?? null, flipped: false, reviewed: st.flash.reviewed + 1 } }));
    if (due.length === 1) log("Finished today's flashcard queue");
  };

  const generate = (d: Doc) => {
    const made = cardsFrom(d);
    if (!made.length) { toast.error("Not enough readable text to build flashcards."); return; }
    update((st) => ({ ...st, customCards: [...st.customCards, ...made], flash: { ...st.flash, source: "doc", cardId: made[0]!.id, flipped: false } }));
    log(`Generated ${made.length} flashcards from ${d.title}`);
    toast(`${made.length} flashcards generated from “${d.title}”`);
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    const r = await uploadPdf(file, doc.subject, setBusy);
    if (fileRef.current) fileRef.current.value = "";
    if (r.error) { toast.error(r.error); return; }
    generate(getDoc().doc);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Deck" value={f.source} onChange={(e) => setF({ source: e.target.value as FlashSession["source"], cardId: null, flipped: false })} className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary">
            <option value="all">All cards</option>
            <option value="doc">Active document</option>
            <option value="saved">Saved cards</option>
          </select>
          <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-xs text-muted-foreground"><FileText className="size-3.5 shrink-0 text-primary" /><span className="truncate">{doc.title}</span></p>
          <Button size="sm" variant="outline" onClick={() => generate(doc)}><Wand2 /> Generate from material</Button>
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => fileRef.current?.click()}>{busy ? <Loader2 className="animate-spin" /> : <FileUp />} Upload new</Button>
        </div>
        {busy && <p className="mt-2 font-mono text-xs text-muted-foreground">{busy.name} · {["Parsing pages…", "Indexing medical content", "Ready to study"][busy.i]} {busy.total ? `${busy.done}/${busy.total}` : ""}</p>}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold">{due.length} cards due today <span className="text-sm font-normal text-muted-foreground">· {f.reviewed} reviewed</span></p>
        <div className="flex gap-2 font-mono text-xs">
          {Object.entries(counts).map(([k, v]) => <span key={k} className="rounded-md border border-border px-2 py-1">{k} <b className="text-primary">{v}</b></span>)}
        </div>
      </div>
      {card ? (
        <>
          <div className="relative">
            <button onClick={() => setF({ cardId: card.id, flipped: !flipped })} className="group block h-72 w-full [perspective:1200px]" aria-label="Flip card">
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
            <button onClick={() => { update((st) => ({ ...st, savedCards: toggle(st.savedCards, card.id) })); toast(saved ? "Card removed from saved" : "Card saved"); }} className="absolute right-3 top-3 rounded-md p-2 hover:bg-accent" aria-label={saved ? "Unsave card" : "Save card"}>
              {saved ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
            </button>
          </div>
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
          <p className="font-serif text-2xl">{deck.length ? "All caught up." : "No cards in this deck yet."}</p>
          <p className="mt-2 text-sm text-muted-foreground">{deck.length ? "Come back later for your next reviews." : "Generate cards from your active document or upload a new PDF."}</p>
          {deck.length > 0 && <Button variant="outline" className="mt-5" onClick={() => update((st) => ({ ...st, cards: {}, flash: { ...st.flash, cardId: null, flipped: false, reviewed: 0 } }))}><RotateCcw /> Reset deck</Button>}
        </div>
      )}
    </div>
  );
}
