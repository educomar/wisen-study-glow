import { Bookmark, BookmarkCheck, FileText, FileUp, Loader2, RotateCcw, Wand2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { extractMaterial, reloadAi, useAi } from "./ai-store";
import { useCurriculum } from "./Curriculum";
import { seedCards, type Card } from "./data";
import { Inline } from "./RichText";
import { emptyScope, resolveScope, ScopePicker, type Scope } from "./ScopePicker";
import { generateFlashcards } from "@/lib/ai/study.functions";
import { getDoc, uploadPdf, useDoc, type Doc, type Stage } from "./doc";
import { sentences } from "./grounded";
import { addCard, log, toggle, update, useAppState, type FlashSession } from "./store";
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

export function Flashcards({ view = "cards" }: { view?: "cards" | "new" | "decks" | "reviews" }) {
  const s = useAppState();
  const { doc } = useDoc();
  const [busy, setBusy] = useState<Stage | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const f = s.flash;
  const setF = (patch: Partial<FlashSession>) => update((st) => ({ ...st, flash: { ...st.flash, ...patch } }));

  const ai = useAi();
  const { tree, signedIn } = useCurriculum();
  const [sc, setSc] = useState<Scope>(emptyScope);
  const [mode, setMode] = useState<"subject" | "unit" | "file">("unit");
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const genCards = useServerFn(generateFlashcards);
  const all = useMemo(() => [...s.customCards, ...ai.cards], [s.customCards, ai.cards]);
  const [topic, setTopic] = useState("All");
  const [manual, setManual] = useState(false);
  const [front, setFront] = useState(""), [back, setBack] = useState(""), [deckName, setDeckName] = useState("");
  const runAi = async () => {
    const r = resolveScope(tree, mode === "subject" ? { ...emptyScope, s: sc.s } : mode === "unit" ? { ...sc, f: "" } : sc);
    if (mode !== "subject" && !sc.u) { toast.error("Choose a chapter / unit."); return; }
    if (mode === "file" && !sc.f) { toast.error("Choose a file."); return; }
    if (!r.files.length) { toast.error("No course files in this selection yet."); return; }
    try {
      setAiBusy("Reading course files…");
      const material = await extractMaterial(r.files, mode === "file" ? 1 : 6, (d, n) => setAiBusy(`Reading course files ${d}/${n}…`));
      if (!material.length) { toast.error("These files have no readable text (they may be scanned or not PDFs)."); return; }
      setAiBusy("Wisen AI is writing your Kapsules…");
      const rows = await genCards({ data: { subject: r.subject, scope: r.label, count: mode === "subject" ? 20 : 12, material } });
      await reloadAi();
      update((st) => ({ ...st, flash: { ...st.flash, source: "ai", cardId: rows[0] ? `aic-${rows[0].id}` : null, flipped: false } }));
      log(`Wisen AI generated ${rows.length} Kapsules · ${r.label}`);
      toast(`${rows.length} Kapsules generated and saved to your account`);
    } catch (e) { toast.error((e as Error).message || "Generation failed"); } finally { setAiBusy(null); }
  };
  const sourceDeck = f.source === "ai" ? ai.cards : f.source === "doc" ? all.filter((c) => c.source === doc.title || (doc.sample && !c.source && seedCards.includes(c))) : f.source === "saved" ? all.filter((c) => s.savedCards.includes(c.id)) : all;
  const deck = sourceDeck.filter(c => (topic === "All" || c.topic === topic) && (view !== "new" || !s.cards[c.id]));
  const now = Date.now();
  const due = deck.filter((c) => (s.cards[c.id]?.due ?? 0) <= now);
  const card = due.find((c) => c.id === f.cardId) ?? due[0];
  const flipped = f.flipped && card?.id === f.cardId;
  const counts = { New: deck.filter((c) => !s.cards[c.id]).length, Learning: deck.filter((c) => s.cards[c.id]?.status === "learning").length, Review: deck.filter((c) => s.cards[c.id]?.status === "review").length };
  const saved = card ? s.savedCards.includes(card.id) : false;

  const rate = (r: (typeof ratings)[number]) => {
    if (!card) return;
    const next = due.filter((c) => c.id !== card.id)[0];
    const box = r.l === "Again" ? 1 : r.l === "Hard" ? Math.max(1, (s.cards[card.id]?.box ?? 1) - 1) : Math.min(5, (s.cards[card.id]?.box ?? 0) + (r.l === "Easy" ? 2 : 1));
    const interval = r.l === "Again" ? 60e3 : r.l === "Hard" ? 6 * 60e3 : 864e5 * ([0, 1, 2, 4, 8, 16][box] ?? 1);
    update((st) => ({ ...st, cards: { ...st.cards, [card.id]: { due: Date.now() + interval, status: r.st, box } }, reviewHistory: [{ id: crypto.randomUUID(), cardId: card.id, topic: card.topic, rating: r.l, t: Date.now() }, ...st.reviewHistory].slice(0, 2000), flash: { ...st.flash, cardId: next?.id ?? null, flipped: false, reviewed: st.flash.reviewed + 1 } }));
    if (due.length === 1) log("Finished today's flashcard queue");
  };

  const generate = (d: Doc) => {
    const made = cardsFrom(d);
    if (!made.length) { toast.error("Not enough readable text to build Kapsules."); return; }
    update((st) => ({ ...st, customCards: [...st.customCards, ...made], flash: { ...st.flash, source: "doc", cardId: made[0]?.id ?? null, flipped: false } }));
    log(`Generated ${made.length} Kapsules from ${d.title}`);
    toast(`${made.length} Kapsules generated from “${d.title}”`);
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    const r = await uploadPdf(file, doc.subject, setBusy);
    if (fileRef.current) fileRef.current.value = "";
    if (r.error) { toast.error(r.error); return; }
    generate(getDoc().doc);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><select aria-label="Kapsule topic" className="study-input" value={topic} onChange={e=>setTopic(e.target.value)}><option>All</option>{[...new Set(all.map(c=>c.topic))].map(t=><option key={t}>{t}</option>)}</select><Button variant="outline" onClick={()=>setManual(!manual)}>Create Kapsule</Button></div>
      {manual && <form className="mb-5 space-y-3 border-b border-border pb-5" onSubmit={e=>{e.preventDefault();addCard(front.trim(),back.trim(),"",deckName.trim() || "My Deck");setManual(false);setFront("");setBack("");toast("Kapsule created");}}><input required aria-label="Deck name" placeholder="Deck name" value={deckName} onChange={e=>setDeckName(e.target.value)} className="study-input w-full"/><textarea required aria-label="Kapsule question" placeholder="Question" value={front} onChange={e=>setFront(e.target.value)} className="study-input w-full"/><textarea required aria-label="Kapsule answer" placeholder="Answer" value={back} onChange={e=>setBack(e.target.value)} className="study-input w-full"/><Button type="submit" disabled={!front.trim() || !back.trim()}>Save Kapsule</Button></form>}
      {view === "reviews" ? <div><h2 className="mb-4 font-bold">Review History</h2>{s.reviewHistory.length ? s.reviewHistory.map(r=><div key={r.id} className="flex justify-between gap-4 border-b border-border py-3 text-sm"><span>{r.topic}<span className="block text-xs text-muted-foreground">{new Date(r.t).toLocaleString()}</span></span><span className="text-primary">{r.rating}</span></div>) : <p className="text-sm text-muted-foreground">No reviews yet</p>}</div> : view === "decks" ? <div className="grid gap-4 sm:grid-cols-2">{[...new Set(all.map(c=>c.topic))].map(t=><div className="dashboard-card" key={t}><h2 className="font-bold">{t}</h2><p className="text-sm text-muted-foreground">{all.filter(c=>c.topic===t).length} Kapsules · {all.filter(c=>c.topic===t && (s.cards[c.id]?.due??0)<=now).length} due</p><Button onClick={()=>{setTopic(t);window.dispatchEvent(new CustomEvent('wisen-review-deck'));}}>Review deck</Button></div>)}{!all.length && <p className="text-sm text-muted-foreground">No decks yet</p>}</div> : <>

      <div className="mb-4 space-y-3 rounded-xl border border-primary/30 bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-semibold"><Wand2 className="size-4 text-primary" /> Generate Kapsules with Wisen AI</p>
        {!signedIn ? <p className="text-sm text-muted-foreground">Sign in to generate Kapsules from your faculty courses.</p> : <>
          <div className="inline-flex gap-1 rounded-lg border border-border p-1 text-xs">
            {([["subject", "Entire subject"], ["unit", "Chapter / unit"], ["file", "Individual file"]] as const).map(([k, l]) => <button key={k} onClick={() => setMode(k)} className={`rounded-md px-2.5 py-1 ${mode === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{l}</button>)}
          </div>
          <ScopePicker tree={tree} value={mode === "subject" ? { ...emptyScope, s: sc.s } : sc} onChange={setSc} fileLevel={mode === "file"} lessonLevel={mode !== "subject"} />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={!sc.s || !!aiBusy} onClick={() => void runAi()}>{aiBusy ? <Loader2 className="animate-spin" /> : <Wand2 />} Generate Kapsules</Button>
            {aiBusy && <span className="text-xs text-muted-foreground">{aiBusy}</span>}
          </div>
        </>}
      </div>
      <div className="mb-4 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Deck" value={f.source} onChange={(e) => setF({ source: e.target.value as FlashSession["source"], cardId: null, flipped: false })} className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary">
            <option value="all">All cards</option>
            <option value="doc">Active document</option>
            <option value="ai">Wisen AI cards</option>
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
            <button onClick={() => setF({ cardId: card.id, flipped: !flipped })} className="group block min-h-80 w-full [perspective:1200px]" aria-label="Flip card">
              <div className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""}`}>
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border border-border bg-card p-8 text-center [backface-visibility:hidden]">
                  <span className="mb-4 font-mono text-[11px] uppercase text-primary">{card.topic}</span>
                  <p className="font-semibold text-xl"><Inline text={card.front} /></p>
                  <span className="mt-6 text-xs text-muted-foreground">Tap to reveal answer</span>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border border-primary/40 bg-card p-8 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <p className="text-lg"><Inline text={card.back} /></p>
                  <p className="mt-5 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">High-yield tip: <Inline text={card.tip} /></p>
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
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="font-semibold text-xl">{deck.length ? "All caught up." : "No cards in this deck yet."}</p>
          <p className="mt-2 text-sm text-muted-foreground">{deck.length ? "Come back later for your next reviews." : "Generate cards from your active document or upload a new PDF."}</p>
          {deck.length > 0 && <Button variant="outline" className="mt-5" onClick={() => update((st) => ({ ...st, cards: {}, flash: { ...st.flash, cardId: null, flipped: false, reviewed: 0 } }))}><RotateCcw /> Reset deck</Button>}
        </div>
      )}
    </>}
    </div>
  );
}
