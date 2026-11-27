import { useLang } from '@/lib/i18n';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { BookOpen, ChevronDown, GraduationCap, Layers, ListChecks, Loader2, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurriculum, type Tree } from '@/components/app/Curriculum';
import { exploreCurriculum, type Semester } from '@/components/app/curriculum-explorer';
import { studyMeta } from '@/lib/study-meta';
export const Route = createFileRoute('/roadmap')({ head: () => studyMeta('Academic Curriculum Roadmap', 'Explore Year 1 semesters or integrated units, subjects and lessons in your enrolled medical curriculum.'), component: Roadmap });
function Roadmap() {
  const { t } = useLang(); const { tree, signedIn } = useCurriculum(); const navigate = useNavigate();
  const [query, setQuery] = useState(''), [semester, setSemester] = useState<Semester>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { groups, semestered, counts } = exploreCurriculum(tree ?? [], query, semester);
  const toggle = (key: string) => setExpanded(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  function lessons(s: Tree[number], units: Tree[number]['units']) {
    return <ul>{units.flatMap(u => u.lessons.map(l => <li key={l.id} className="curriculum-lesson"><div className="curriculum-lesson-name"><BookOpen/><span>{l.name}</span></div><div className="curriculum-lesson-actions"><Button variant="outline" onClick={() => void navigate({ to: '/workspace', search: { sheet: '', s: s.id, u: u.id, l: l.id } })}><BookOpen/>{t('Study')}</Button><Button variant="ghost" onClick={() => void navigate({ to: '/qbank', search: { s: s.id, u: u.id, l: l.id } })}><ListChecks/>{t('Practice')}</Button></div></li>))}</ul>;
  }
  return <main className="reference-page curriculum-page"><header className="tool-page-heading"><span className="tool-kicker">{t('ACADEMIC CURRICULUM')}</span><h1>{t('Roadmap')}</h1></header>
    <div className="curriculum-search"><Search/><Input aria-label={t('Search curriculum')} placeholder={t('Search subjects, units, lessons or keywords…')} value={query} onChange={e => setQuery(e.target.value)}/>{query && <Button variant="ghost" size="icon" aria-label={t('Clear search')} onClick={() => setQuery('')}><X/></Button>}</div>
    <div className="curriculum-toolbar">{semestered ? <div className="curriculum-filters" role="tablist" aria-label={t('Semester')}>{([['all','All'],['1','S1'],['2','S2']] as const).map(([v,label]) => <Button key={v} role="tab" aria-selected={semester === v} variant={semester === v ? 'default' : 'outline'} onClick={() => setSemester(v)}>{t(label)}</Button>)}</div> : <div/>}<div className="curriculum-counts"><span><GraduationCap/>{counts.modules} {t(semestered ? 'subjects' : 'integrated units')}</span>{!semestered && <span><Layers/>{counts.units} {t('subjects')}</span>}<span><BookOpen/>{counts.lessons} {t('lessons')}</span></div></div>
    {!tree ? <div role="status" className="curriculum-empty"><Loader2 className="animate-spin"/>{t('Loading curriculum…')}</div> : !signedIn ? <div className="tool-signin"><strong>{t('Sign in to see your curriculum')}</strong><Button asChild><Link to="/login">{t('Sign in')}</Link></Button></div> : !counts.modules ? <div className="curriculum-empty"><h2>{t(query ? 'No matching lessons' : 'No modules available')}</h2></div> : groups.filter(g => g.subjects.length).map(g => <section className="curriculum-semester" key={g.semester}><div className="curriculum-group-heading"><h2>{g.semester === 'all' ? t('Integrated units') : `S${g.semester}`}</h2><span>{g.subjects.length} {t(semestered ? 'subjects' : 'integrated units')}</span></div><div className="curriculum-subjects">{g.subjects.map(s => { const key = `${g.semester}-${s.id}`, open = expanded.has(key) || !!query.trim(); return <article key={key} className="curriculum-subject"><h3><Button variant="ghost" className="curriculum-subject-toggle" aria-expanded={open} onClick={() => toggle(key)}><span className="curriculum-icon">{semestered ? <GraduationCap/> : <Layers/>}</span><span className="curriculum-subject-name">{t(s.name)}</span><span className="curriculum-subject-count">{s.units.reduce((n,u) => n + u.lessons.length, 0)} {t('lessons')}</span><ChevronDown className={open ? 'curriculum-chevron is-open' : 'curriculum-chevron'}/></Button></h3>{open && <div className="curriculum-units">{semestered ? lessons(s, s.units) : s.units.map(u => <section key={u.id} className="curriculum-unit"><h4><BookOpen/>{u.name === s.name ? t('Existing lessons') : t(u.name)}<span>{u.lessons.length} {t('lessons')}</span></h4>{lessons(s,[u])}</section>)}</div>}</article>; })}</div></section>)}
  </main>;
}
