import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, BookOpen, Download, FileText, Layers, Play, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAi } from './ai-store';
import { groupLibraryDecks } from './library-data';
import { useAppState } from './store';

type LibraryTab = 'all' | 'decks' | 'sheets';

export function LibraryPage() {
  const state = useAppState();
  const ai = useAi();
  const navigate = useNavigate();
  const [tab, setTab] = useState<LibraryTab>('all');
  const [query, setQuery] = useState('');
  const now = Date.now();
  const decks = useMemo(() => groupLibraryDecks([...state.customCards, ...ai.cards], state.cards, now), [state.customCards, state.cards, ai.cards, now]);
  const showDecks = tab !== 'sheets';

  return <main className="library-page">
    <header className="library-heading"><span className="library-kicker">LIBRARY · EVERYTHING YOU&apos;VE CREATED</span><h1>Your saved Kapsule decks.</h1><p>Every Kapsule deck you built, in one place — search, reopen, or drill them again.</p></header>
    <section className="library-controls" aria-label="Library controls">
      <div className="library-tabs" role="tablist" aria-label="Library content type">
        <Button role="tab" variant="ghost" aria-selected={tab === 'all'} className={tab === 'all' ? 'is-active' : ''} onClick={() => setTab('all')}>All</Button>
        <Button role="tab" variant="ghost" aria-selected={tab === 'decks'} className={tab === 'decks' ? 'is-active' : ''} onClick={() => setTab('decks')}>Decks <span>{decks.length}</span></Button>
      </div>
      <label className="library-search"><Search/><span className="sr-only">Search your library</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by title, keyword, or module…"/></label>
    </section>

    {showDecks && <section className="library-section"><div className="library-section-title"><div><span>KAPSULE DECKS</span><h2>Ready for another round.</h2></div><Button asChild variant="ghost"><Link to="/flashcards" search={{deck:''}}><Sparkles/>Create deck</Link></Button></div>
      {shownDecks.length ? <div className="library-grid library-decks">{shownDecks.map(deck => <article className="library-card library-deck" key={deck.name}><div className="library-card-icon"><Layers/></div><div className="library-card-body"><span className="library-card-type">{deck.module}</span><h3>{deck.name}</h3><div className="library-deck-stats"><span><strong>{deck.cards.length}</strong> cards</span><span><strong>{deck.due}</strong> due</span></div></div><Button onClick={() => void navigate({ to: '/flashcards', search: { deck: deck.name } })}>Study Deck<ArrowRight/></Button></article>)}</div> : <EmptyState filtered={Boolean(needle)} kind="decks"/>}
    </section>}

  </main>;
}

function EmptyState({ kind, filtered }: { kind: 'decks' | 'sheets'; filtered: boolean }) {
  const decks = kind === 'decks';
  return <div className="library-empty"><span>{decks ? <Layers/> : <FileText/>}</span><h3>{filtered ? `No matching ${kind}` : decks ? 'No Kapsule decks yet.' : 'No saved study sheets yet.'}</h3><p>{filtered ? 'Try another title, keyword, or module.' : decks ? 'Build your first active-recall deck from a lecture or add a card yourself.' : 'Turn a faculty lecture into a structured sheet you can revisit here.'}</p>{!filtered && <Button asChild>{decks ? <Link to="/flashcards" search={{deck:''}}>Create your first deck<ArrowRight/></Link> : <Link to="/workspace" search={{sheet:''}}>Open Workspace<ArrowRight/></Link>}</Button>}</div>;
}