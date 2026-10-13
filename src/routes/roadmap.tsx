import { translate, useLang } from '@/lib/i18n';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Activity, Atom, Bone, BookOpen, ChevronDown, Dna, FileText, FlaskConical, GraduationCap, HeartPulse, Layers, ListChecks, Loader2, Microscope, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurriculum, type CurFile } from '@/components/app/Curriculum';


import { exploreCurriculum, normalizeCurriculumText, type Semester } from '@/components/app/curriculum-explorer';
import { studyMeta } from '@/lib/study-meta';
export const Route = createFileRoute('/roadmap')({ head: () => studyMeta('Curriculum Roadmap', 'Explore your medical modules, units and lessons by semester. Find lecture material and subject questions.'), component: Roadmap });
function subjectIcon(name: string) {
  const n = normalizeCurriculumText(name);
  if (/anatom/.test(n)) return Bone;
  if (/physiolog/.test(n)) return HeartPulse;
  if (/embry|genet/.test(n)) return Dna;
  if (/histo|cyto/.test(n)) return Microscope;
  if (/biochim|biochem|chimi|chem/.test(n)) return FlaskConical;
  if (/biophys/.test(n)) return Atom;
  if (/stat|informat/.test(n)) return Activity;
  return GraduationCap;
}
function Roadmap() {
  const { t: translate } = useLang();
  const { tree, signedIn } = useCurriculum();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [semester, setSemester] = useState<Semester>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { groups, semestered, counts } = exploreCurriculum(tree ?? [], query, semester);
  const toggle = (key: string) => setExpanded(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  function openMaterial(file: CurFile) {
    void navigate({ to: '/workspace', search: { sheet: '', file: file.id } });
  }
  function practice(s: string, u: string, l: string) {
    void navigate({ to: '/qbank', search: { s, u, l } });
  }
  return <main className="reference-page curriculum-page">
    <header className="tool-page-heading"><span className="tool-kicker">{translate("ACADEMIC CURRICULUM")}</span><h1>{translate("Roadmap")}</h1></header>
    <div className="curriculum-search"><Search aria-hidden="true"/><Input aria-label={translate("Search curriculum")} placeholder={translate("Search subjects, units, lessons or keywords…")} value={query} onChange={e => setQuery(e.target.value)}/>{query && <Button variant="ghost" size="icon" aria-label={translate("Clear search")} onClick={() => setQuery('')}><X/></Button>}</div>
    <div className="curriculum-toolbar">{semestered ? <div className="curriculum-filters" aria-label={translate("Semester filters")}>{([['all', 'All Modules'], ['1', 'Semester 1'], ['2', 'Semester 2']] as const).map(([value, label]) => <Button key={value} variant={semester === value ? 'default' : 'outline'} aria-pressed={semester === value} onClick={() => setSemester(value)}>{translate(label)}</Button>)}</div> : <div/>}<div className="curriculum-counts" aria-live="polite"><span><GraduationCap/>{counts.modules}  {translate("modules")}</span><span><Layers/>{counts.units}  {translate("units")}</span><span><BookOpen/>{counts.lessons}  {translate("lessons")}</span></div></div>
    {error && <div role="alert" className="curriculum-error">{error}<Button variant="ghost" size="icon" aria-label={translate("Dismiss error")} onClick={() => setError('')}><X/></Button></div>}
    {!tree ? <div role="status" className="curriculum-empty"><Loader2 className="animate-spin"/>{translate("Loading curriculum…")}</div> : !signedIn ? <div className="tool-signin"><strong>{translate("Sign in to see your curriculum")}</strong><Button asChild><Link to="/login">{translate("Sign in")}</Link></Button></div> : !counts.modules ? <div className="curriculum-empty"><Search/><h2>{query ? translate('No matching lessons') : translate('No modules available')}</h2>{query && <Button variant="outline" onClick={() => { setQuery(''); setSemester('all'); }}>{translate("Clear filters")}</Button>}</div> : groups.filter(group => group.subjects.length).map(group => <section className="curriculum-semester" key={group.semester} aria-labelledby={`semester-${group.semester}`}>
      <div className="curriculum-group-heading"><h2 id={`semester-${group.semester}`}>{group.semester === 'all' ? translate('Modules') : translate("Semester ") + (group.semester)}</h2><span>{group.subjects.length}  {translate("modules")}</span></div>
      <div className="curriculum-subjects">{group.subjects.map(subject => {
        const key = `${group.semester}-${subject.id}`; const isOpen = expanded.has(key) || !!query.trim(); const Icon = subjectIcon(subject.name);
        return <article key={key} className="curriculum-subject"><h3><Button variant="ghost" className="curriculum-subject-toggle" aria-expanded={isOpen} aria-controls={`content-${key}`} onClick={() => { if (query.trim()) setQuery(''); toggle(key); }}><span className="curriculum-icon"><Icon/></span><span className="curriculum-subject-name">{translate(subject.name)}</span>{group.semester !== 'all' && <span className="curriculum-semester-tag">{translate("Semester")} {group.semester}</span>}<span className="curriculum-subject-count">{subject.units.length}  {translate("units ·")} {subject.units.reduce((n, u) => n + u.lessons.length, 0)}  {translate("lessons")}</span><ChevronDown className={isOpen ? 'curriculum-chevron is-open' : 'curriculum-chevron'}/></Button></h3>
          {isOpen && <div id={`content-${key}`} className="curriculum-units">{subject.units.map(unit => <section key={unit.id} className="curriculum-unit"><h4><Layers/>{unit.name}<span>{unit.lessons.length}  {translate("lessons")}</span></h4><ul>{unit.lessons.map(lesson => <li key={lesson.id} className="curriculum-lesson"><div className="curriculum-lesson-name"><FileText/><span>{lesson.name}</span></div><div className="curriculum-lesson-actions">{lesson.files.length === 1 && lesson.files[0] ? <Button variant="outline" disabled={opening !== null} onClick={() => void openMaterial(lesson.files[0] as CurFile)} aria-label={translate("Open lecture: ") + (lesson.name)}>{opening === lesson.files[0].id ? <Loader2 className="animate-spin"/> : <BookOpen/>}{translate("Lecture")}</Button> : lesson.files.length > 1 ? <details className="curriculum-file-menu"><summary><BookOpen/>{translate("Lectures (")}{lesson.files.length})<ChevronDown/></summary><div>{lesson.files.map(file => <Button key={file.id} variant="ghost" disabled={opening !== null} onClick={() => void openMaterial(file)}>{opening === file.id ? <Loader2 className="animate-spin"/> : <FileText/>}{file.file_name}</Button>)}</div></details> : <span className="curriculum-no-file">{translate("No lecture file")}</span>}<Button variant="ghost" onClick={() => practice(subject.id, unit.id, lesson.id)} aria-label={translate("Practice questions: ") + (lesson.name)}><ListChecks/>{translate("Practice")}</Button></div></li>)}</ul></section>)}</div>}
        </article>;
      })}</div>
    </section>)}
  </main>;
}