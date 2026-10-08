import { Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { BookOpen, Check, ChevronRight, Copy, Download, FileText, HeartPulse, Layers, Lightbulb, List, Loader2, MoreHorizontal, Paperclip, Pencil, Play, Plus, Share2, Sparkles, Stethoscope, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/lib/profile';
import { askWisen } from '@/lib/ai/wisen.functions';
import { generateQuestions } from '@/lib/ai/study.functions';
import { fetchCurriculumFile, useCurriculum } from './Curriculum';
import { emptyScope, resolveScope, ScopePicker } from './ScopePicker';
import { extractMaterial, fileText, reloadAi } from './ai-store';
import { addNote, flushStudentData, update, useAppState } from './store';
import { Inline, RichText } from './RichText';
import { parseSheetCards, readableSheet, sheetSections, sheetSuggestions, sourcePages, splitTeaser, type SheetSource, type StudySheetData } from './sheet-content';

const icons = [BookOpen, Stethoscope, List, Lightbulb, TriangleAlert, Layers];
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const savedPrefix = 'WISEN_SHEET_V1\n';

export function StudySheets() {
  const { user, profile } = useSession();
  const { tree } = useCurriculum();
  const state = useAppState();
  const navigate = useNavigate();
  const ask = useServerFn(askWisen), genQuestions = useServerFn(generateQuestions);
  const [topic, setTopic] = useState(''), [notes, setNotes] = useState('');
  const [scope, setScope] = useState(emptyScope), [level, setLevel] = useState('Fondamental'), [focus, setFocus] = useState('Général');
  const [sheet, setSheet] = useState<StudySheetData | null>(null), [material, setMaterial] = useState<SheetSource[]>([]);
  const [busy, setBusy] = useState(false), [stage, setStage] = useState(''), [prepared, setPrepared] = useState(0), [error, setError] = useState('');
  const [active, setActive] = useState('overview'), [revealed, setRevealed] = useState<number[]>([]), [saving, setSaving] = useState('');
  const [saved, setSaved] = useState(false), [editing, setEditing] = useState(false), [editText, setEditText] = useState('');
  const fileInput = useRef<HTMLInputElement>(null), stopped = useRef(false);
  const resolved = resolveScope(tree, scope);
  const suggestions = sheetSuggestions(profile, tree);
  const done = sheetSections.filter(s => sheet?.sections[s.id] !== undefined).length;
  const savedSheets = state.notes.filter(n => n.source === 'Study Sheet');
  useEffect(() => () => { stopped.current = true; }, []);
  useEffect(() => {
    if (!sheet) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id.replace('sheet-', ''));
    }, { rootMargin: '-110px 0px -45% 0px' });
    document.querySelectorAll('[data-sheet-section]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [sheet?.id, done]);
  const scrollTo = (id: string) => {
    setActive(id);
    document.getElementById(`sheet-${id}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  };
  const chooseTopic = (name: string, subject: string) => {
    setTopic(name);
    const sub = tree?.find(s => normalize(s.name).includes(normalize(subject)));
    const words = normalize(name).split(/\W+/).filter(w => w.length > 3);
    const match = sub?.units.flatMap(u => u.lessons.map(l => ({ u, l }))).find(({ l }) => words.some(w => normalize(l.name).includes(w)));
    setScope(sub ? { s: sub.id, u: match?.u.id ?? '', l: match?.l.id ?? '', f: '' } : emptyScope);
  };
  const attach = async (f?: File) => {
    if (!f) return;
    setStage('Reading attached material…'); setBusy(true); setError('');
    try { setNotes(f.type === 'application/pdf' || /\.pdf$/i.test(f.name) ? await fileText(f) : await f.text()); if (!topic) setTopic(f.name.replace(/\.[^.]+$/, '')); }
    catch { setError('This file could not be read. Please use a readable PDF or text file.'); }
    finally { setBusy(false); setStage(''); }
  };
  const generate = async () => {
    if (!topic.trim() && !resolved.label) return;
    if (!notes.trim() && !resolved.files.length) { setError('Choose a faculty lecture or attach your course notes to ground this sheet.'); return; }
    stopped.current = false; setBusy(true); setError(''); setSaved(false); setPrepared(0); setRevealed([]);
    const title = topic.trim() || resolved.lesson || resolved.subject;
    const draft: StudySheetData = { id: crypto.randomUUID(), topic: title, subject: resolved.subject || title, level, focus, sections: {}, teaser: '', cards: [], sources: [], complete: false, cardsAdded: false };
    setSheet(draft); setMaterial([]); window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      setStage('Reading your course material…');
      const extracted: SheetSource[] = notes.trim() ? [{ name: 'Attached course notes', text: notes.slice(0, 38000) }] : (await extractMaterial(resolved.files, 3, (n, total) => setStage(`Reading faculty lectures · ${n}/${total}`))).map(m => ({ ...m, fileId: resolved.files.find(f => f.file_name === m.name)?.id }));
      const perSource = Math.floor(37500 / Math.max(1, extracted.length));
      const sources = extracted.map(s => ({ ...s, text: s.text.slice(0, perSource) }));
      if (!sources.length) throw new Error('No readable faculty passages were found. Attach a readable lecture or choose another file.');
      if (stopped.current) return;
      setPrepared(2); setMaterial(sources);
      draft.sources = sources.map(s => ({ name: s.name, fileId: s.fileId, pages: sourcePages(s.text) }));
      setSheet({ ...draft });
      const attachment = { name: sources.map(s => s.name).join(', ').slice(0, 200), text: sources.map(s => `FILE: ${s.name.slice(0, 200)}\n${s.text}`).join('\n\n') };
      for (const section of sheetSections) {
        if (stopped.current) return;
        setStage(`Writing ${section.title}…`);
        const response = await ask({ data: {
          action: 'Summarize', message: `Create ONLY the ${section.title} section of a medical Study Sheet on ${title.slice(0, 200)}. Student: ${profile?.department || 'Medicine'}, year ${profile?.academic_year || 1}, UFAS1 Sétif. Level: ${level}. Focus: ${focus}. Respond in the topic/material language (French by default). Use only the attached faculty material. If the material does not support a requested fact, say so. No USMLE, Board Style, invented sources or professor tricks. ${section.instruction} Cite actual file names and page markers for facts where available. Do not repeat a section heading.`,
          subject: draft.subject.slice(0, 60), title: title.slice(0, 200), page: 1, excerpts: [], history: [], attachment,
        } });
        if (!response.ok) throw new Error(response.error === 'credits' ? 'Wisen AI credits are unavailable. Please try after credits are restored.' : response.error === 'busy' ? 'Wisen AI is busy. Please try again later.' : 'Wisen AI is unavailable. Your completed sections remain below.');
        if (stopped.current) return;
        setPrepared(3);
        if (section.id === 'overview') { const parsed = splitTeaser(response.text); draft.teaser = parsed.teaser; draft.sections.overview = parsed.body; }
        else draft.sections[section.id] = response.text;
        if (section.id === 'cards') { draft.cards = parseSheetCards(response.text); if (!draft.cards.length) throw new Error('The Kapsules could not be read. Your other sections are still available.'); }
        setSheet({ ...draft, sections: { ...draft.sections } });
      }
      draft.complete = true; setSheet({ ...draft, sections: { ...draft.sections } }); setStage('Sheet ready');
    } catch (e) { if (!stopped.current) setError(e instanceof Error ? e.message : 'Could not create your sheet.'); }
    finally { if (!stopped.current) setBusy(false); }
  };
  const saveSheet = async (value = sheet) => {
    if (!value || !user) { toast.error('Sign in to save your sheet.'); return; }
    setSaving('sheet');
    try {
      const text = savedPrefix + JSON.stringify(value);
      const existing = state.notes.find(n => n.source === 'Study Sheet' && n.text.startsWith(savedPrefix) && n.text.includes(value.id));
      if (existing) update(s => ({ ...s, notes: s.notes.map(n => n.id === existing.id ? { ...n, text } : n) }));
      else addNote(text, value.topic, 'Study Sheet');
      await flushStudentData(); setSaved(true); toast.success('Study sheet saved');
    } catch { toast.error('Your sheet could not be saved. Please try again.'); } finally { setSaving(''); }
  };
  const addCards = async () => {
    if (!sheet || sheet.cardsAdded || !sheet.cards.length) return;
    if (!user) { toast.error('Sign in to save Kapsules to your deck.'); return; }
    setSaving('cards');
    try {
      const { error: err } = await supabase.from('ai_flashcards').insert(sheet.cards.map(c => ({ user_id: user.id, subject: sheet.subject, scope_label: sheet.topic, front: c.front, back: c.back, tip: sheet.sources.map(s => s.name).join(', ') })));
      if (err) throw err;
      const next = { ...sheet, cardsAdded: true }; setSheet(next); await reloadAi(); await saveSheet(next); toast.success(`${sheet.cards.length} Kapsules added to your deck`);
    } catch { toast.error('Could not save your Kapsules. Please try again.'); } finally { setSaving(''); }
  };
  const practice = async () => {
    if (!sheet) return;
    if (!user) { toast.error('Sign in to create a practice set.'); return; }
    setSaving('questions');
    try {
      const source = material.length ? material : [{ name: sheet.topic, text: readableSheet(sheet) }];
      const rows = await genQuestions({ data: { mode: 'qbank', qtype: 'SCQ', difficulty: sheet.level === 'Fondamental' ? 'Easy' : sheet.level === 'Approfondi' ? 'Medium' : 'Hard', count: 8, subject: sheet.subject.slice(0, 120), unit: resolved.unit.slice(0, 120), lesson: sheet.topic.slice(0, 200), material: source.map(m => ({ name: m.name.slice(0, 200), text: m.text.slice(0, 55000) })), pastEmds: [] } });
      await reloadAi(); update(s => ({ ...s, qbank: { subject: sheet.subject, lesson: sheet.topic, difficulty: 'All', order: rows.map(r => `ai-${r.id}`), i: 0, answers: {}, startedAt: Date.now() } }));
      await navigate({ to: '/app', search: { view: 'qbank' } });
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not start QBank.'); } finally { setSaving(''); }
  };
  const exportWord = async () => {
    if (!sheet) return;
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
      const doc = new Document({ styles: { default: { document: { run: { font: 'Arial', size: 24 } } } }, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } }, children: [new Paragraph({ heading: HeadingLevel.TITLE, text: sheet.topic }), ...readableSheet(sheet).split('\n').map(t => new Paragraph({ children: [new TextRun(t.replace(/\*\*/g, ''))] }))] }] });
      const url = URL.createObjectURL(await Packer.toBlob(doc)); const a = document.createElement('a'); a.href = url; a.download = `${sheet.topic}.docx`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { toast.error('Word export failed. Please try again.'); }
  };
  const share = async () => {
    if (!sheet) return;
    try { if (navigator.share) await navigator.share({ title: sheet.topic, text: readableSheet(sheet) }); else { await navigator.clipboard.writeText(readableSheet(sheet)); toast.success('Sheet copied for sharing'); } } catch { /* User cancelled sharing. */ }
  };
  const newSheet = () => { if (busy) return; setSheet(null); setError(''); setStage(''); setSaved(false); setMaterial([]); setRevealed([]); };
  const loadSaved = (text: string, title: string) => {
    try { if (text.startsWith(savedPrefix)) { const data = JSON.parse(text.slice(savedPrefix.length)) as StudySheetData; if (!data.sections || !Array.isArray(data.cards)) throw new Error(); setSheet(data); setSaved(true); setMaterial([]); setError(''); } else { setTopic(title); setNotes(text); setSheet(null); } } catch { toast.error('This saved sheet could not be opened.'); }
  };
  return <main className={`wisen-sheets ${sheet ? 'has-sheet' : ''}`}>
    <input type="file" accept=".pdf,.txt,.md" hidden ref={fileInput} onChange={e => void attach(e.target.files?.[0])} />
    {!sheet ? <>
      <header className="ws-intro"><span className="ws-eyebrow"><Sparkles />STUDY SHEETS · UFAS1 SÉTIF</span><h1>Your lectures.<br /><em>Made unforgettable.</em></h1><p>Une fiche claire, les notions essentielles et les pièges d’EMD — à partir de vos cours.</p></header>
      <form className="ws-composer" onSubmit={e => { e.preventDefault(); void generate(); }}>
        <label htmlFor="sheet-topic">What are you studying?</label><input id="sheet-topic" placeholder="Le Fémur, Gastrulation, Structure des Protéines…" value={topic} onChange={e => setTopic(e.target.value)} />
        <div className="ws-composer-options"><select aria-label="EMD level" value={level} onChange={e => setLevel(e.target.value)}>{['Fondamental', 'Approfondi', 'Spécial EMD'].map(l => <option key={l}>{l}</option>)}</select><select aria-label="Study focus" value={focus} onChange={e => setFocus(e.target.value)}>{['Général', 'Mécanismes', 'Anatomie clinique', 'Révision EMD'].map(f => <option key={f}>{f}</option>)}</select><span><BookOpen />Faculty-grounded</span><Button type="button" variant="ghost" size="icon" title="Attach course material" aria-label="Attach course material" onClick={() => fileInput.current?.click()}><Paperclip /></Button><Button type="submit" disabled={busy || (!topic.trim() && !resolved.label)}><Sparkles />{busy ? stage : 'Generate sheet'}<ChevronRight /></Button></div>
        <details className="ws-material" open={!!scope.s}><summary><BookOpen />Choose from course lectures <ChevronRight /></summary><ScopePicker tree={tree} value={scope} onChange={setScope} /><textarea aria-label="Course notes" placeholder="Or paste your faculty lecture notes…" value={notes} onChange={e => setNotes(e.target.value)} /></details>
        {notes && <span className="ws-source-hint"><Paperclip />Course notes attached · {notes.length.toLocaleString()} characters</span>}
      </form>
      <section className="ws-suggestions"><span className="ws-eyebrow">FOR YOUR YEAR · {profile?.department || 'Medicine'} · YEAR {profile?.academic_year || 1}</span><div>{suggestions.map(t => <Button key={t.topic} variant="outline" onClick={() => chooseTopic(t.topic, t.subject)}><Sparkles /><span>{t.topic}<small>{t.subject}</small></span></Button>)}</div></section>
      {!user && <p className="ws-signin"><BookOpen />Sign in to access faculty lectures and save your sheets.<Link to="/login">Sign in <ChevronRight /></Link></p>}
      {!!savedSheets.length && <section className="ws-library"><h2>Your sheets</h2>{savedSheets.map(n => <Button key={n.id} variant="outline" onClick={() => loadSaved(n.text, n.subject)}><FileText />{n.subject}<ChevronRight /></Button>)}</section>}
    </> : <div className="ws-reader-layout"><div className="ws-reader">
      <header className="ws-sheet-header"><div className="ws-sheet-title"><h1><HeartPulse />{sheet.topic}</h1><div className="ws-header-actions"><Button variant="outline" disabled={busy} onClick={() => scrollTo('approach')}><Stethoscope />Deep dives</Button><Button variant="outline" disabled={busy} onClick={() => { setEditing(!editing); setEditText(sheet.sections[active as keyof typeof sheet.sections] || ''); }}><Pencil />Edit</Button><Button variant="outline" disabled={busy || !!saving || !user} onClick={() => void saveSheet()}><FileText />{saved ? 'Saved' : 'Save'}</Button><details className="ws-more"><summary aria-label="More sheet actions"><MoreHorizontal /></summary><div><Button variant="ghost" onClick={newSheet} disabled={busy}><Plus />New sheet</Button><Button variant="ghost" onClick={() => void exportWord()} disabled={busy}><Download />Export Word</Button><Button variant="ghost" onClick={() => void share()} disabled={busy}><Share2 />Share</Button></div></details></div></div><div className="ws-sheet-meta"><span>{sheet.focus} · {sheet.level} · High-yield</span><span aria-live="polite">{busy && <Loader2 className="animate-spin" />}{stage || 'Sheet ready'}</span><span>{sheet.sources.length} sources · {done}/6 sections</span></div><progress aria-label="Study sheet generation progress" max={6} value={done} /></header>
      {(busy || prepared > 0 || sheet.teaser) && <section className="ws-preparation"><h2><Sparkles />Preparing your sheet</h2><ul>{['Read topic from course material', 'Found faculty lecture passages', 'Thinking it through before writing'].map((label, i) => <li key={label}><span className={prepared > i ? 'is-done' : ''}>{prepared > i ? <Check /> : busy ? <Loader2 className="animate-spin" /> : <span>•</span>}</span><div>{label}{i === 1 && sheet.sources.map(s => <small key={s.name}>{s.name}</small>)}</div></li>)}</ul>{sheet.teaser && <div className="ws-teaser"><span className="ws-eyebrow">BEFORE YOU READ</span><p><Inline text={sheet.teaser} /></p><small>Répondez d’abord de mémoire, puis comparez avec votre cours.</small></div>}</section>}
      {editing && <section className="ws-edit"><label>Edit {sheetSections.find(s => s.id === active)?.title || 'section'}<textarea value={editText} onChange={e => setEditText(e.target.value)} /></label><Button onClick={() => { if (sheetSections.some(s => s.id === active)) setSheet({ ...sheet, sections: { ...sheet.sections, [active]: editText }, ...(active === 'cards' ? { cards: parseSheetCards(editText), cardsAdded: false } : {}) }); setEditing(false); setSaved(false); }}>Apply</Button><Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></section>}
      {sheetSections.map((section, i) => { const Icon = icons[i] || BookOpen; const content = sheet.sections[section.id]; return <section key={section.id} id={`sheet-${section.id}`} data-sheet-section className={`ws-section ${content !== undefined ? 'is-ready' : 'is-pending'}`}><header><h2><span className="ws-icon"><Icon /></span>{section.title}</h2><div>{content && <Button variant="ghost" size="icon" aria-label={`Copy ${section.title}`} title={`Copy ${section.title}`} onClick={() => void navigator.clipboard.writeText(content).then(() => toast.success('Copied'))}><Copy /></Button>}{content ? <Check className="ws-complete" /> : <span className="ws-pending-dot" />}</div></header>{content === undefined ? <div className="ws-skeleton" aria-label={`Waiting for ${section.title}`}><span /><span /><span /><span /></div> : section.id === 'cards' ? <><div className="ws-card-toolbar"><span>{sheet.cards.length} Kapsules</span><Button variant="outline" disabled={!!saving || sheet.cardsAdded} onClick={() => void addCards()}><Layers />{sheet.cardsAdded ? 'Added to my deck' : `Add ${sheet.cards.length} cards to my deck`}</Button></div><Button className="ws-reveal-all" variant="ghost" onClick={() => setRevealed(revealed.length === sheet.cards.length ? [] : sheet.cards.map((_, n) => n))}>{revealed.length === sheet.cards.length ? 'Hide answers' : 'Show all answers'}</Button><div className="ws-embedded-cards">{sheet.cards.map((c, n) => <Button key={n} variant="outline" className="ws-kapsule" aria-expanded={revealed.includes(n)} onClick={() => setRevealed(r => r.includes(n) ? r.filter(x => x !== n) : [...r, n])}><span><strong>Q:</strong> <Inline text={c.front} /></span>{revealed.includes(n) ? <div className="ws-answer"><RichText text={c.back} /></div> : <small>Click to reveal answer</small>}</Button>)}</div></> : <><div className="ws-section-body">{section.id === 'traps' && <div className="ws-warning"><TriangleAlert />Pièges d’EMD · Vérifiez les nuances dans votre cours.</div>}{content.split(/\n+/).filter(l => l.trim()).map((line, n) => { const tag = line.match(/\[(VS|MEC|DDX)\]/)?.[1]; const number = line.match(/^\s*(\d+)[.)]\s*/)?.[1]; return <div className={`ws-content-line ${number ? 'is-numbered' : ''}`} key={n}>{number && <span className="ws-number">{number}.</span>}<p>{tag && <span className={`ws-tag ws-tag-${tag.toLowerCase()}`}>{tag}</span>}<Inline text={line.replace(/^\s*\d+[.)]\s*/, '').replace(/\[(VS|MEC|DDX)\]/g, '').replace(/^#+\s*/, '')} /></p></div>; })}</div></>}</section>; })}
      <section id="sheet-sources" data-sheet-section className="ws-section ws-sources"><header><h2><span className="ws-icon"><FileText /></span>Sources</h2></header><p>Faculty lecture material used for this sheet</p>{sheet.sources.map(s => <details key={s.name}><summary><BookOpen /><span>{s.name}<small>{s.pages.length ? `${s.pages.length} extracted pages` : 'Course notes'}</small></span><ChevronRight /></summary><p>Source pages: {s.pages.join(', ') || 'Unpaginated notes'}</p>{s.fileId && <Button variant="outline" onClick={async () => { const f = tree?.flatMap(s => s.units.flatMap(u => u.lessons.flatMap(l => l.files))).find(f => f.id === s.fileId); if (!f) return; try { const { uploadPdf, openPage } = await import('./doc'); const opened = await uploadPdf(await fetchCurriculumFile(f), f.subject, () => undefined); if (opened.error) throw new Error(opened.error); openPage(1); await navigate({ to: '/app', search: { view: 'courses' } }); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not open source.'); } }}><BookOpen />Open faculty lecture</Button>}</details>)}</section>
      <p className="ws-disclaimer"><TriangleAlert />AI-generated · Verify against your faculty lectures · Not a substitute for clinical judgement</p>
      {sheet.complete && <section className="ws-conversion"><span className="ws-eyebrow">END OF SHEET</span><h2>Now make {sheet.topic} stick.</h2><div className="ws-conversion-buttons"><Button disabled={!!saving || sheet.cardsAdded} onClick={() => void addCards()}>{saving === 'cards' ? <Loader2 className="animate-spin" /> : <Layers />}{sheet.cardsAdded ? 'Added to my deck' : `Add ${sheet.cards.length} cards to my deck`}</Button><Button variant="outline" disabled={!!saving} onClick={() => void practice()}>{saving === 'questions' ? <Loader2 className="animate-spin" /> : <Play />}Practice QBank</Button></div><div className="ws-export-actions"><Button variant="ghost" onClick={() => window.print()}><Download />Export PDF</Button><Button variant="ghost" onClick={() => void exportWord()}><FileText />Export Word</Button><Button variant="ghost" onClick={() => void share()}><Share2 />Share</Button><Button variant="ghost" onClick={newSheet}><Plus />New sheet</Button></div></section>}
      {!busy && !sheet.complete && <Button variant="outline" onClick={newSheet}><Plus />New sheet</Button>}
    </div><aside className="ws-rail"><span className="ws-eyebrow">ON THIS SHEET</span>{[...sheetSections, { id: 'sources', title: 'Sources' }].map(s => <Button key={s.id} variant="ghost" className={active === s.id ? 'is-active' : ''} onClick={() => scrollTo(s.id)}><span>{s.title}</span>{s.id === 'sources' ? null : sheet.sections[s.id as keyof typeof sheet.sections] !== undefined ? <Check /> : <span className="ws-rail-dot" />}</Button>)}</aside></div>}
    {error && <div className="ws-error" role="alert"><TriangleAlert /><span>{error}</span><Button variant="ghost" size="icon" aria-label="Dismiss error" onClick={() => setError('')}><X /></Button></div>}
  </main>;
}