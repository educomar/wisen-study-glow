import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, Bookmark, Layers, NotebookPen, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAi } from './ai-store';
import { groupLibraryDecks } from './library-data';
import { useAppState } from './store';

type LibraryTab = 'all' | 'decks' | 'notes' | 'bookmarks';

export function LibraryPage() {
  const state = useAppState();
  const ai = useAi();
  const navigate = useNavigate();
  const [tab, setTab] = useState<LibraryTab>('all');
  const [query, setQuery] = useState('');
  const now = Date.now();
  const decks = useMemo(() => groupLibraryDecks([...state.customCards, ...ai.cards], state.cards, now), [state.customCards, state.cards, ai.cards, now]);
  const needle = query.trim().toLowerCase();
  const has = (t: string) => !needle || t.toLowerCase().includes(needle);
  const shownDecks = decks.filter(deck => has(`${deck.name} ${deck.module} ${deck.cards.map(card => `${card.front} ${card.back} ${card.source ?? ''}`).join(' ')}`));
  const notes = state.notes.filter(n => has(`${n.text} ${n.subject} ${n.source}`));
  const bookmarked = state.bookmarks.map(id => ai.qs.find(q => q.id === id) ?? state.questionResults[id]?.question ?? state.customQuestions.find(q => q.id === id)).filter((q): q is NonNullable<typeof q> => !!q).filter(q => has(`${q.stem} ${q.subject} ${q.topic}`));
  const tabs: [LibraryTab, string, number | null][] = [['all', 'All', null], ['decks', 'Decks', decks.length], ['notes', 'Notes', state.notes.length], ['bookmarks', 'Bookmarks', bookmarked.length]];

  return <main className="library-page">
    <header className="library-heading"><span className="library-kicker">LIBRARY · EVERYTHING YOU&apos;VE CREATED</span><h1>Your saved study material.</h1><p>Kapsule decks, lecture notes and bookmarked questions — search, reopen, or drill them again.</p></header>
    <section className="library-controls" aria-label="Library controls">
      <div className="library-tabs" role="tablist" aria-label="Library content type">
        {tabs.map(([k, label, n]) => <Button key={k} role="tab" variant="ghost" aria-selected={tab === k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>{label}{n !== null && <span>{n}</span>}</Button>)}
      </div>
      <label className="library-search"><Search/><span className="sr-only">Search your library</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by title, keyword, or module…"/></label>
    </section>

    {(tab === 'all' || tab === 'decks') && <section className="library-section"><div className="library-section-title"><div><span>KAPSULE DECKS</span><h2>Ready for another round.</h2></div><Button asChild variant="ghost"><Link to="/flashcards" search={{deck:''}}><Sparkles/>Create deck</Link></Button></div>
      {shownDecks.length ? <div className="library-grid library-decks">{shownDecks.map(deck => <article className="library-card library-deck" key={deck.name}><div className="library-card-icon"><Layers/></div><div className="library-card-body"><span className="library-card-type">{deck.module}</span><h3>{deck.name}</h3><div className="library-deck-stats"><span><strong>{deck.cards.length}</strong> cards</span><span><strong>{deck.due}</strong> due</span></div></div><Button onClick={() => void navigate({ to: '/flashcards', search: { deck: deck.name } })}>Study Deck<ArrowRight/></Button></article>)}</div> : <Empty filtered={!!needle} icon={<Layers/>} title="No Kapsule decks yet." text="Build your first active-recall deck from a lecture or add a card yourself." to="/flashcards" cta="Create your first deck"/>}
    </section>}

    {(tab === 'all' || tab === 'notes') && <section className="library-section"><div className="library-section-title"><div><span>LECTURE NOTES</span><h2>Passages you saved.</h2></div></div>
      {notes.length ? <div className="library-grid">{notes.map(n => <article className="library-card" key={n.id}><div className="library-card-icon"><NotebookPen/></div><div className="library-card-body"><span className="library-card-type">{n.subject}{n.page ? ` · p.${n.page}` : ''}</span><h3>{n.source}</h3><p className="line-clamp-3 text-sm text-muted-foreground">{n.text}</p><span className="text-xs text-muted-foreground">{new Date(n.t).toLocaleDateString()}</span></div></article>)}</div> : <Empty filtered={!!needle} icon={<NotebookPen/>} title="No lecture notes yet." text="Select a passage in Workspace and choose Save Note." to="/workspace" cta="Open Workspace"/>}
    </section>}

    {(tab === 'all' || tab === 'bookmarks') && <section className="library-section"><div className="library-section-title"><div><span>BOOKMARKED QUESTIONS</span><h2>Questions worth another look.</h2></div></div>
      {bookmarked.length ? <div className="library-grid">{bookmarked.map(q => <article className="library-card" key={q.id}><div className="library-card-icon"><Bookmark/></div><div className="library-card-body"><span className="library-card-type">{q.subject} · {q.topic}</span><p className="line-clamp-3 text-sm">{q.stem}</p></div><Button variant="outline" onClick={() => void navigate({ to: '/qbank' })}>Practice<ArrowRight/></Button></article>)}</div> : <Empty filtered={!!needle} icon={<Bookmark/>} title="No bookmarks yet." text="Bookmark questions while practising to collect them here." to="/qbank" cta="Open QBank"/>}
    </section>}
  </main>;
}

function Empty({ filtered, icon, title, text, to, cta }: { filtered: boolean; icon: React.ReactNode; title: string; text: string; to: '/flashcards' | '/workspace' | '/qbank'; cta: string }) {
  return <div className="library-empty"><span>{icon}</span><h3>{filtered ? 'No matches' : title}</h3><p>{filtered ? 'Try another title, keyword, or module.' : text}</p>{!filtered && <Button asChild>{to === '/flashcards' ? <Link to="/flashcards" search={{deck:''}}>{cta}<ArrowRight/></Link> : to === '/workspace' ? <Link to="/workspace" search={{sheet:''}}>{cta}<ArrowRight/></Link> : <Link to="/qbank">{cta}<ArrowRight/></Link>}</Button>}</div>;
}
