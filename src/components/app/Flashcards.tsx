import { translate, useLang, getLocale } from '@/lib/i18n';
import { Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowRight, Bookmark, BookmarkCheck, Check, History, Layers, Loader2, Maximize2, Minimize2, Plus, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { generateFlashcards } from '@/lib/ai/study.functions';
import { extractMaterial, reloadAi, useAi } from './ai-store';
import { useCurriculum } from './Curriculum';
import { Inline } from './RichText';
import { englishSheetLabel } from './sheet-content';
import { kapsuleRatings, kapsuleRetention, scheduleKapsule, type KapsuleRating } from './kapsule-review';
import { addCard, flushStudentData, log, toggle, update, useAppState } from './store';

export function Flashcards({ view = 'cards', initialDeck }: { view?: 'cards' | 'new' | 'decks' | 'reviews'; initialDeck?: string | undefined }) {
  useLang();
  const s = useAppState();
  const ai = useAi();
  const { tree, signedIn } = useCurriculum();
  const navigate = useNavigate();
  const generateCards = useServerFn(generateFlashcards);
  const [tab, setTab] = useState(view);
  const [deck, setDeck] = useState('All Decks');
  const [manual, setManual] = useState(false);
  const [front, setFront] = useState(''), [back, setBack] = useState(''), [deckName, setDeckName] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [moduleId, setModuleId] = useState(''), [lectureId, setLectureId] = useState('');
  const [count, setCount] = useState(12);
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [focus, setFocus] = useState(false);
  const [session, setSession] = useState<{ ratings: KapsuleRating[]; subject: string; lesson: string }>({ ratings: [], subject: '', lesson: '' });
  const [now, setNow] = useState(0);
  const ratingLock = useRef(false);
  useEffect(() => setTab(view), [view]);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const all = useMemo(() => [...s.customCards, ...ai.cards], [s.customCards, ai.cards]);
  const decks = useMemo(() => [...new Set([...(tree ?? []).map(m => englishSheetLabel(m.name)), ...all.map(c => englishSheetLabel(c.topic))])], [tree, all]);
  const selected = all.filter(c => deck === 'All Decks' || englishSheetLabel(c.topic) === deck);
  const due = selected.filter(c => (s.cards[c.id]?.due ?? 0) <= now && (tab !== 'new' || !s.cards[c.id]));
  const card = due.find(c => c.id === s.flash.cardId) ?? due[0];
  const flipped = Boolean(card && s.flash.cardId === card.id && s.flash.flipped);
  const stats = { due: selected.filter(c => (s.cards[c.id]?.due ?? 0) <= now).length, new: selected.filter(c => !s.cards[c.id]).length, mastered: selected.filter(c => (s.cards[c.id]?.box ?? 0) >= 4).length };
  const facultyModule = tree?.find(m => m.id === moduleId);
  const lectures = facultyModule?.units.flatMap(u => u.lessons.filter(l => l.files.length).map(l => ({ ...l, unit: u.name }))) ?? [];
  const lecture = lectures.find(l => l.id === lectureId);
  const resetSession = () => setSession({ ratings: [], subject: '', lesson: '' });
  const changeDeck = (name: string) => { setDeck(name); resetSession(); update(st => ({ ...st, flash: { ...st.flash, cardId: null, flipped: false } })); };
  useEffect(() => { if (initialDeck && all.some(card => englishSheetLabel(card.topic) === initialDeck)) changeDeck(initialDeck); }, [initialDeck, all.length]);
  const changeTab = (next: typeof tab) => { setTab(next); setFocus(false); resetSession(); };
  const flip = useCallback(() => { if (card) update(st => ({ ...st, flash: { ...st.flash, cardId: card.id, flipped: !flipped } })); }, [card, flipped]);
  const rate = useCallback(async (rating: KapsuleRating) => {
    if (!card || !flipped || ratingLock.current) return;
    ratingLock.current = true;
    setSaving(true);
    const time = Date.now();
    const next = due.find(c => c.id !== card.id);
    update(st => ({ ...st, cards: { ...st.cards, [card.id]: scheduleKapsule(rating, st.cards[card.id], time) }, reviewHistory: [{ id: crypto.randomUUID(), cardId: card.id, topic: card.topic, rating, t: time }, ...st.reviewHistory].slice(0, 2000), flash: { ...st.flash, cardId: next?.id ?? null, flipped: false, reviewed: st.flash.reviewed + 1 } }));
    setSession(prev => ({ ratings: [...prev.ratings, rating], subject: card.topic, lesson: card.source ?? '' }));
    setNow(time);
    if (!next) log('Finished today’s Kapsule queue');
    try { await flushStudentData(); } catch (e) { toast.error(e instanceof Error ? e.message : translate('Your review could not be saved.')); }
    finally { ratingLock.current = false; setSaving(false); }
  }, [card, flipped, due]);
  useEffect(() => {
    if (manual || aiOpen || (tab !== 'cards' && tab !== 'new')) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      if (target instanceof HTMLElement && (target.closest('input,textarea,select,button,[contenteditable="true"],[role="dialog"]'))) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      if (e.key === 'Escape') { setFocus(false); return; }
      if (card && (e.code === 'Space' || e.key === 'Enter')) { e.preventDefault(); flip(); }
      const rating = kapsuleRatings[Number(e.key) - 1];
      if (rating && flipped && /^[1-4]$/.test(e.key)) { e.preventDefault(); void rate(rating); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [manual, aiOpen, tab, card, flipped, flip, rate]);
  const saveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim() || !deckName.trim() || !signedIn) return;
    setSaving(true);
    addCard(front.trim(), back.trim(), '', deckName.trim());
    changeDeck(englishSheetLabel(deckName.trim())); setTab('cards'); setNow(Date.now());
    setFront(''); setBack(''); setManual(false); resetSession();
    try { await flushStudentData(); toast.success(translate('Kapsule saved to your deck')); }
    catch (e) { toast.error(e instanceof Error ? e.message : translate('Your Kapsule could not be saved.')); }
    finally { setSaving(false); }
  };
  const runAi = async () => {
    if (!facultyModule || !lecture || !signedIn || busy) return;
    setError('');
    try {
      setBusy('Reading lecture material…');
      const material = await extractMaterial(lecture.files, 6, (done, total) => setBusy(`Reading lecture material ${done}/${total}…`));
      if (!material.length) throw new Error('This lecture has no readable text. Choose another lecture.');
      setBusy('Writing your Kapsules…');
      const rows = await generateCards({ data: { subject: facultyModule.name, scope: lecture.name, count, material } });
      await reloadAi();
      changeDeck(englishSheetLabel(facultyModule.name)); setTab('cards'); setNow(Date.now());
      update(st => ({ ...st, flash: { ...st.flash, source: 'all', cardId: rows[0] ? `aic-${rows[0].id}` : null, flipped: false } }));
      log(`Generated ${rows.length} Kapsules · ${englishSheetLabel(lecture.name)}`);
      setAiOpen(false); toast.success((rows.length) + translate(" Kapsules saved — ready to study"));
    } catch (e) { setError(e instanceof Error ? e.message : 'Generation failed.'); }
    finally { setBusy(''); }
  };
  const goPractice = () => { void navigate({ to: '/app', search: { view: 'qbank', subject: session.subject || 'All', lesson: session.lesson || 'All' } }); };
  const retention = kapsuleRetention(session.ratings);
  const nextDue = selected.map(c => s.cards[c.id]?.due).filter((t): t is number => typeof t === 'number' && t > now).sort((a, b) => a - b)[0];

  return <main className={`kapsules-hub ${focus ? 'kh-focused' : ''}`}>
    {!focus && <>
      <header className="kh-header"><div><span className="kh-eyebrow">{translate("ACTIVE RECALL · SPACED REPETITION")}</span><h1>{translate("Kapsules")}</h1><div className="kh-stats" aria-label={translate("Deck statistics")}><span><strong>{stats.due}</strong>  {translate("Due Today")}</span><i>·</i><span><strong>{stats.new}</strong>  {translate("New")}</span><i>·</i><span><strong>{stats.mastered}</strong>  {translate("Mastered")}</span></div></div><div className="kh-actions"><Button variant="outline" onClick={() => { setManual(!manual); setDeckName(deck === 'All Decks' ? '' : deck); }}><Plus/>{translate("Quick New Card")}</Button><Button onClick={() => { setError(''); setAiOpen(true); }}><Sparkles/>{translate("Generate with AI")}</Button></div></header>
      <nav className="kh-deck-filters" aria-label={translate("Filter decks")}>{['All Decks', ...decks].map(name => <Button key={name} variant={deck === name ? 'default' : 'outline'} aria-pressed={deck === name} onClick={() => changeDeck(name)}>{translate(name)}</Button>)}</nav>
      {manual && <section className="kh-manual"><div className="kh-section-heading"><h2>{translate("Quick New Card")}</h2><Button variant="ghost" size="icon" aria-label={translate("Close new card form")} onClick={() => setManual(false)}><X/></Button></div>{!signedIn ? <Button asChild><Link to="/login">{translate("Sign in to save Kapsules")}</Link></Button> : <form onSubmit={e => void saveManual(e)}><label>{translate("Question")}<textarea autoFocus required value={front} onChange={e => setFront(e.target.value)} placeholder={translate("What do you want to remember?")}/></label><label>{translate("Answer")}<textarea required value={back} onChange={e => setBack(e.target.value)} placeholder={translate("A concise answer")}/></label><label className="kh-manual-deck">{translate("Deck")}<input required list="kapsule-deck-names" value={deckName} onChange={e => setDeckName(e.target.value)} placeholder={translate("Choose or name a deck")}/><datalist id="kapsule-deck-names">{decks.map(d => <option key={d} value={d}/>)}</datalist></label><Button type="submit" disabled={saving || !front.trim() || !back.trim() || !deckName.trim()}>{saving ? <Loader2 className="animate-spin"/> : <Plus/>}{translate("Save Kapsule")}</Button></form>}</section>}
      <nav className="kh-tabs" aria-label={translate("Kapsule views")}>{([['cards', 'Due Today', Layers], ['new', 'New', Plus], ['decks', 'Decks', Layers], ['reviews', 'Review History', History]] as const).map(([key, label, Icon]) => <Button key={key} variant="ghost" aria-pressed={tab === key} className={tab === key ? 'is-active' : ''} onClick={() => changeTab(key)}><Icon/>{translate(label)}</Button>)}</nav>
    </>}
    {tab === 'decks' ? <section className="kh-deck-grid">{decks.map(name => { const cards = all.filter(c => englishSheetLabel(c.topic) === name); return <article className="kh-deck" key={name}><span className="kh-deck-icon"><Layers/></span><h2>{translate(name)}</h2><p>{cards.length}  {translate("Kapsules")} <span>· {cards.filter(c => (s.cards[c.id]?.due ?? 0) <= now).length}  {translate("due")}</span></p><Button variant="outline" disabled={!cards.length} onClick={() => { changeDeck(name); setTab('cards'); }}>{translate("Review deck")}<ArrowRight/></Button></article>; })}{!decks.length && <p className="kh-empty-text">{translate("No decks yet.")}</p>}</section>
    : tab === 'reviews' ? <section className="kh-history"><h2>{translate("Review History")}</h2>{s.reviewHistory.length ? [...s.reviewHistory].sort((a, b) => b.t - a.t).filter(r => deck === 'All Decks' || translate(englishSheetLabel(r.topic)) === deck).map(r => <div className="kh-history-row" key={r.id}><div><strong>{englishSheetLabel(r.topic)}</strong><span>{all.find(c => c.id === r.cardId)?.front ?? 'Kapsule review'}</span><time>{new Date(r.t).toLocaleString(getLocale())}</time></div><span className={`kh-history-rating kh-${r.rating.toLowerCase()}`}>{translate(r.rating)}</span></div>) : <p className="kh-empty-text">{translate("No reviews yet.")}</p>}</section>
    : <section className="kh-study" aria-label={translate("Active recall session")}>
      <div className="kh-session-bar"><span>{deck === 'All Decks' ? translate('Daily review') : deck} <i>·</i> {session.ratings.length}  {translate("reviewed")} <i>·</i> {due.length}  {translate("remaining")}</span><Button variant="ghost" size="icon" aria-label={focus ? translate('Exit focus mode') : translate('Enter focus mode')} title={focus ? translate('Exit focus mode') : translate('Focus mode')} onClick={() => setFocus(!focus)}>{focus ? <Minimize2/> : <Maximize2/>}</Button></div>
      {!tree || !now ? <div className="kh-empty"><Loader2 className="animate-spin"/><h2>{translate("Loading your Kapsules…")}</h2></div> : card ? <>
        <div className="kh-card-wrap"><Button variant="ghost" aria-label={translate("Flip Kapsule")} aria-pressed={flipped} onClick={flip} className="kh-flip"><div className={`kh-flip-inner ${flipped ? 'is-flipped' : ''}`}><div className="kh-card-face" aria-hidden={flipped}><span className="kh-eyebrow">{translate(englishSheetLabel(card.topic))}  {translate("· QUESTION")}</span><div className="kh-card-copy"><Inline text={card.front}/></div><span className="kh-card-foot">{card.source ? englishSheetLabel(card.source) : translate('My Kapsules')}</span></div><div className="kh-card-face kh-card-back" aria-hidden={!flipped}><span className="kh-eyebrow">{translate("ANSWER")}</span><div className="kh-card-copy"><Inline text={card.back}/></div>{card.tip && <div className="kh-tip"><Inline text={card.tip}/></div>}</div></div></Button><Button variant="ghost" size="icon" className="kh-bookmark" aria-label={s.savedCards.includes(card.id) ? translate('Unsave Kapsule') : translate('Save Kapsule')} onClick={() => { update(st => ({ ...st, savedCards: toggle(st.savedCards, card.id) })); void flushStudentData().catch(e => toast.error(e instanceof Error ? e.message : translate('Could not save bookmark.'))); }}>{s.savedCards.includes(card.id) ? <BookmarkCheck/> : <Bookmark/>}</Button></div>
        <div className="kh-ratings">{kapsuleRatings.map(r => { const dueAt = scheduleKapsule(r, s.cards[card.id], now).due - now; const label = r === 'Again' ? '<1m' : r === 'Hard' ? '6m' : `${Math.round(dueAt / 86400000)}d`; return <Button key={r} variant="outline" className={`kh-rating kh-${r.toLowerCase()}`} disabled={!flipped || saving} onClick={() => void rate(r)}><strong>{translate(r)}</strong><span>{translate(label)}</span></Button>; })}</div>
      </> : <div className="kh-empty">{session.ratings.length ? <><span className="kh-complete-icon"><Check/></span><span className="kh-eyebrow">{translate("SESSION COMPLETE")}</span><h2>{translate("Good work. Let it settle.")}</h2><div className="kh-summary-stats"><div><strong>{session.ratings.length}</strong><span>{translate("Kapsules reviewed")}</span></div><div><strong>{retention}%</strong><span>{translate("Retention this session")}</span></div></div><p>{translate("Keep the momentum with related EMD practice.")}</p><Button onClick={goPractice}>{translate("Practice QBank")}<ArrowRight/></Button></> : <><span className="kh-complete-icon"><Layers/></span><h2>{all.length && selected.length ? tab === 'new' ? translate('No new Kapsules in this deck.') : translate('You’re all caught up.') : translate('Your next study session starts here.')}</h2>{!signedIn ? <Button asChild><Link to="/login">{translate("Sign in to open your decks")}<ArrowRight/></Link></Button> : !selected.length ? <div className="kh-actions"><Button variant="outline" onClick={() => { setFocus(false); setManual(true); }}><Plus/>{translate("Quick New Card")}</Button><Button onClick={() => { setFocus(false); setError(''); setAiOpen(true); }}><Sparkles/>{translate("Generate with AI")}</Button></div> : <Button variant="outline" onClick={() => changeTab('decks')}>{translate("View decks")}<ArrowRight/></Button>}</>}{nextDue && <p className="kh-next-review">{translate("Next review:")} {new Date(nextDue).toLocaleString('en-GB')}</p>}</div>}
    </section>}
    <Dialog open={aiOpen} onOpenChange={open => { if (!busy) setAiOpen(open); }}><DialogContent className="kh-ai-dialog reference-theme study-theme" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => { if (busy) e.preventDefault(); }}><DialogHeader><DialogTitle>{translate("Generate Kapsules")}</DialogTitle><DialogDescription>{!signedIn ? translate('Sign in to use your faculty lectures.') : translate('Faculty lecture → your study deck')}</DialogDescription></DialogHeader>{!signedIn ? <Button asChild><Link to="/login">{translate("Sign in")}</Link></Button> : <form onSubmit={e => { e.preventDefault(); void runAi(); }}><label>{translate("Faculty Module")}<select aria-label={translate("Faculty Module")} required value={moduleId} disabled={!!busy || !tree} onChange={e => { setModuleId(e.target.value); setLectureId(''); }}><option value="">{tree ? translate('Select a module') : translate('Loading modules…')}</option>{tree?.map(m => <option key={m.id} value={m.id}>{englishSheetLabel(m.name)}</option>)}</select></label><label>{translate("Lecture")}<select aria-label={translate("Lecture")} required value={lectureId} disabled={!!busy || !moduleId} onChange={e => setLectureId(e.target.value)}><option value="">{moduleId && !lectures.length ? translate('No lecture files available') : translate('Select a lecture')}</option>{lectures.map(l => <option key={l.id} value={l.id}>{englishSheetLabel(l.name)}</option>)}</select></label><fieldset><legend>{translate("Card count")}</legend><div className="kh-counts">{[8, 12, 20].map(n => <Button key={n} type="button" disabled={!!busy} aria-pressed={count === n} variant={count === n ? 'default' : 'outline'} onClick={() => setCount(n)}>{n}</Button>)}</div></fieldset>{error && <p className="kh-error" role="alert">{translate(error)}</p>}{busy && <p role="status" className="kh-generation-status"><Loader2 className="animate-spin"/>{translate(busy)}</p>}<Button className="kh-generate" type="submit" disabled={!lecture || !!busy}>{busy ? <Loader2 className="animate-spin"/> : <Sparkles/>}{busy ? translate('Generating…') : translate('Generate')}</Button></form>}</DialogContent></Dialog>
  </main>;
}
