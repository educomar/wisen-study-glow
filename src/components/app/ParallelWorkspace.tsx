import { BookOpen, Layers, NotebookPen, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { badge, useSession } from '@/lib/profile';
import { CourseReader, type PassageSelection } from './CourseReader';
import { WisenChat } from './WisenChat';
import { ask, useChat } from './chat';
import { jumpToPage, useDoc } from './doc';
import { addCard, addNote, flushStudentData, useAppState } from './store';

export function ParallelWorkspace() {
  const { user, profile } = useSession();
  const { doc } = useDoc();
  const state = useAppState();
  const { typing } = useChat();
  const [tab, setTab] = useState<'ai' | 'notes'>('ai');
  const [card, setCard] = useState<PassageSelection | null>(null);
  const [front, setFront] = useState('');
  const [saving, setSaving] = useState(false);
  const notes = state.notes.filter(n => n.source === doc.title);

  async function action(name: string, selection: PassageSelection) {
    if (name === 'Make Kapsule') {
      if (!user) { toast.error('Sign in to save Kapsules.'); return; }
      setCard(selection); setFront(''); return;
    }
    if (name === 'Save Note') {
      if (!user) { toast.error('Sign in to save your notes.'); return; }
      addNote(selection.text, selection.subject, selection.title, selection.page);
      setTab('notes');
      try { await flushStudentData(); toast.success('Passage saved to your notes.'); }
      catch (e) { toast.error(e instanceof Error ? e.message : 'Your note could not be saved.'); }
      return;
    }
    if (typing) { toast('Wait for the current answer to finish.'); return; }
    setTab('ai');
    const request = name === 'EMD Trap' ? 'Why on EMD?' : name === 'Quiz Me' ? 'Quiz me' : name;
    await ask(request, selection.text, `${name} · ${selection.subject} · Page ${selection.page}\n“${selection.text}”`, selection.page);
  }

  async function saveCard() {
    if (!card || !front.trim() || saving || !user) return;
    setSaving(true);
    addCard(front.trim(), card.text, `Lecture passage · Page ${card.page}`, card.subject, card.title);
    try { await flushStudentData(); setCard(null); toast.success('Kapsule saved and ready to review.'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Your Kapsule could not be saved.'); }
    finally { setSaving(false); }
  }

  return <main className="parallel-workspace">
    <header className="parallel-heading">
      <div><p className="text-xs font-semibold uppercase text-primary">UFAS1 Sétif · Study room</p><h1 className="mt-1 text-3xl font-semibold">Parallel Study Workspace</h1></div>
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><BookOpen className="size-4"/>{profile ? badge(profile) : 'Faculty lectures'}</span>
    </header>
    <div className="parallel-panes">
      <section aria-label="Lecture viewer" className="parallel-lecture"><CourseReader parallel onSelectionAction={(name, selection) => { void action(name, selection); }}/></section>
      <aside aria-label="Contextual study assistant" className="parallel-assistant">
        <div className="flex shrink-0 items-center gap-2 border-b border-border pb-2" role="tablist" aria-label="Workspace tools">
          <Button role="tab" aria-selected={tab === 'ai'} variant={tab === 'ai' ? 'secondary' : 'ghost'} onClick={() => setTab('ai')}><BookOpen/>Wisen AI</Button>
          <Button role="tab" aria-selected={tab === 'notes'} variant={tab === 'notes' ? 'secondary' : 'ghost'} onClick={() => setTab('notes')}><NotebookPen/>Notes ({notes.length})</Button>
        </div>
        <div className={tab === 'ai' ? 'parallel-chat' : 'hidden'}><WisenChat context={profile ? badge(profile) : undefined} onCitation={jumpToPage}/></div>
        {tab === 'notes' && <section aria-label="Lecture notes" className="min-h-0 flex-1 overflow-auto py-3">
          {!notes.length && <p className="py-6 text-sm text-muted-foreground">No saved notes for this lecture yet.</p>}
          {notes.map(note => <article key={note.id} className="mb-3 rounded-lg border border-border bg-card p-4"><div className="mb-3 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{new Date(note.t).toLocaleDateString()}</span>{note.page && <Button size="sm" variant="outline" onClick={() => jumpToPage(note.page ?? 1)}>Page {note.page}</Button>}</div><p className="whitespace-pre-wrap text-sm leading-7">{note.text}</p></article>)}
        </section>}
      </aside>
    </div>
    {card && <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="passage-card-title" className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl">
      <div className="mb-5 flex items-center justify-between"><h2 id="passage-card-title" className="flex items-center gap-2 text-xl font-semibold"><Layers/>Make Kapsule</h2><Button variant="ghost" size="icon" aria-label="Close Kapsule form" disabled={saving} onClick={() => setCard(null)}><X/></Button></div>
      <form onSubmit={e => { e.preventDefault(); void saveCard(); }}>
        <label className="block text-sm font-medium">Recall question<input autoFocus value={front} onChange={e => setFront(e.target.value)} required placeholder="What do you want to remember?" className="mt-2 w-full rounded-md border border-input bg-background px-3 py-3 text-sm"/></label>
        <label className="mt-4 block text-sm font-medium">Answer<textarea value={card.text} onChange={e => setCard({ ...card, text: e.target.value })} required rows={5} className="mt-2 w-full rounded-md border border-input bg-background px-3 py-3 text-sm"/></label>
        <p className="my-4 text-xs text-muted-foreground">{card.subject} · {card.title} · Page {card.page}</p>
        <Button type="submit" disabled={saving || !front.trim() || !card.text.trim()}><Layers/>{saving ? 'Saving…' : 'Save Kapsule'}</Button>
      </form>
    </section></div>}
  </main>;
}