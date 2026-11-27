import { createFileRoute } from '@tanstack/react-router';
import { ArrowDown, ArrowUp, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { inp, PageHead, sel, useAction, useHierarchy, useServerFn, type Subject, type Unit } from '@/components/admin/team-context';
import { Button } from '@/components/ui/button';
import { deleteContent, saveContent } from '@/lib/team.functions';
import { FACULTIES, YEARS, type Department } from '@/lib/profile';
import { academicRoles, semesterBased } from '@/lib/academic-structure';
import { useLang } from '@/lib/i18n';
import { studyMeta } from '@/lib/study-meta';
export const Route = createFileRoute('/_authenticated/admin/subjects')({ head: () => studyMeta('Academic Structure Administration', 'Manage Year 1 semesters and integrated units, subjects and lessons for later years.'), component: Subjects });
function Subjects() {
  const { data } = useHierarchy();
  const { t } = useLang();
  const save = useServerFn(saveContent), del = useServerFn(deleteContent), act = useAction();
  const [faculty, setFaculty] = useState(FACULTIES[0] ?? '');
  const [department, setDepartment] = useState<Department>('Medicine');
  const [year, setYear] = useState(1);
  const [semester, setSemester] = useState<'S1' | 'S2'>('S1');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const first = semesterBased(year), roles = academicRoles(year);
  const subjects = (data?.subjects ?? []).filter(s => s.faculty === faculty && s.department === department && s.academic_year === year && !/deprecated/i.test(s.name));
  const branches = (id: string) => (data?.units ?? []).filter(u => u.subject_id === id && (!first || u.semester === semester));
  const visible = subjects.filter(s => !first || branches(s.id).length);
  const rename = (table: 'subjects' | 'units' | 'lessons', id: string, current: string) => {
    const value = prompt(t('New name'), current)?.trim();
    if (value && value !== current) void act(save({ data: { table, id, values: { name: value } } }), t('Renamed'));
  };
  const remove = (table: 'subjects' | 'units' | 'lessons', id: string, label: string) => {
    if (confirm(`${t('Delete')} “${label}”? ${t('All content inside this selection will be deleted.')}`)) void act(del({ data: { table, id, label } }), t('Deleted'));
  };
  const reorder = async (table: 'subjects' | 'units' | 'lessons', rows: { id: string; position: number }[], index: number, delta: number) => {
    const a = rows[index], b = rows[index + delta];
    if (!a || !b || busy) return;
    setBusy(true);
    const ordered = [...rows]; ordered[index] = b; ordered[index + delta] = a;
    await act(Promise.all(ordered.map((row, position) => save({ data: { table, id: row.id, values: { position } } }))), t('Order saved'));
    setBusy(false);
  };
  const addLesson = async (s: Subject, unit?: Unit) => {
    const value = prompt(t('Lesson name'))?.trim(); if (!value) return;
    const branch = unit ?? branches(s.id)[0]; if (!branch) return;
    const count = data?.lessons.filter(l => l.unit_id === branch.id).length ?? 0;
    await act(save({ data: { table: 'lessons', values: { name: value, unit_id: branch.id, position: count } } }), t('Added'));
  };
  const addDiscipline = (s: Subject) => {
    const value = prompt(t('Subject name'))?.trim(); if (!value) return;
    void act(save({ data: { table: 'units', values: { name: value, subject_id: s.id, semester: '', position: branches(s.id).length } } }), t('Subject added'));
  };
  async function addParent(e: React.FormEvent) {
    e.preventDefault(); if (!name.trim() || busy) return; setBusy(true);
    await act((async () => {
      const existing = first ? subjects.find(s => s.name.toLowerCase() === name.trim().toLowerCase()) : undefined;
      const parent = existing ?? await save({ data: { table: 'subjects', values: { name: name.trim(), faculty, department, academic_year: year, position: subjects.length } } });
      if (first && !branches(parent.id).length) await save({ data: { table: 'units', values: { name: `Semester ${semester === 'S1' ? 1 : 2}`, semester, subject_id: parent.id, position: 0 } } });
      setName('');
    })(), t(first ? 'Subject added' : 'Integrated unit added')); setBusy(false);
  }
  function actions(table: 'subjects' | 'units' | 'lessons', rows: { id: string; position: number; name: string }[], i: number) {
    const row = rows[i]; if (!row) return null;
    return <div className="flex shrink-0 items-center gap-1"><Button size="icon" variant="ghost" aria-label={t('Move up')} disabled={i === 0 || busy} onClick={() => void reorder(table, rows, i, -1)}><ArrowUp/></Button><Button size="icon" variant="ghost" aria-label={t('Move down')} disabled={i === rows.length - 1 || busy} onClick={() => void reorder(table, rows, i, 1)}><ArrowDown/></Button><Button size="icon" variant="ghost" aria-label={t('Edit')} onClick={() => rename(table, row.id, row.name)}><Pencil/></Button><Button size="icon" variant="ghost" aria-label={t('Delete')} onClick={() => remove(table, row.id, row.name)}><Trash2/></Button></div>;
  }
  return <>
    <PageHead title={t('Academic structure')}/>
    <div className="mb-5 flex flex-wrap gap-3"><label className="text-sm">{t('Faculty')}<select className={`${sel} block max-w-full`} value={faculty} onChange={e => setFaculty(e.target.value)}>{FACULTIES.map(f => <option key={f}>{f}</option>)}</select></label><label className="text-sm">{t('Department')}<select className={`${sel} block`} value={department} onChange={e => { setDepartment(e.target.value as Department); setYear(1); }}><option>Medicine</option><option>Dentistry</option></select></label><label className="text-sm">{t('Study year')}<select className={`${sel} block`} value={year} onChange={e => { setYear(Number(e.target.value)); setOpen({}); }}>{Array.from({ length: YEARS[department] }, (_, i) => <option key={i} value={i + 1}>{t(`Year ${i + 1}`)}</option>)}</select></label></div>
    {first && <div className="mb-4 flex gap-2" role="tablist" aria-label={t('Semester')}>{(['S1','S2'] as const).map(value => <Button key={value} role="tab" aria-selected={semester === value} variant={semester === value ? 'default' : 'outline'} onClick={() => setSemester(value)}>{value}</Button>)}</div>}
    <form className="mb-5 flex flex-wrap gap-2" onSubmit={e => void addParent(e)}><input className={`${inp} max-w-sm`} aria-label={t(`${roles.parent} name`)} placeholder={t(`${roles.parent} name`)} value={name} onChange={e => setName(e.target.value)}/><Button type="submit" disabled={busy || !name.trim()}><Plus/>{t(first ? 'Add subject' : 'Add integrated unit')}</Button></form>
    <div className="space-y-3">{visible.map((s, i) => <section key={s.id} className="rounded-lg border border-border px-4 py-2"><div className="flex flex-wrap items-center gap-2"><Button variant="ghost" className="min-w-0 flex-1 justify-start whitespace-normal text-left" aria-expanded={!!open[s.id]} onClick={() => setOpen(v => ({ ...v, [s.id]: !v[s.id] }))}><ChevronRight className={open[s.id] ? 'rotate-90' : ''}/>{s.name}</Button>{actions('subjects', subjects, subjects.indexOf(s))}<Button variant="outline" size="sm" onClick={() => first ? void addLesson(s) : addDiscipline(s)}><Plus/>{t(first ? 'Lesson' : 'Subject')}</Button></div>
      {open[s.id] && (first ? <div className="border-t border-border py-2">{branches(s.id).flatMap(u => data?.lessons.filter(l => l.unit_id === u.id) ?? []).map(l => { const rows = data?.lessons.filter(x => x.unit_id === l.unit_id) ?? []; return <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-1"><span className="min-w-0 text-sm">{l.name}</span>{actions('lessons', rows, rows.indexOf(l))}</div>; })}<Button size="sm" variant="ghost" onClick={() => { if (confirm(t('Remove this subject from the selected semester?'))) void act(Promise.all(branches(s.id).map(u => del({ data: { table: 'units', id: u.id, label: u.name } }))), t('Deleted')); }}>{t('Remove from semester')}</Button></div> : <div className="border-t border-border py-2">{branches(s.id).map((u, j) => <section key={u.id} className="border-l border-border pl-3"><div className="flex flex-wrap items-center gap-2"><h3 className="min-w-0 flex-1 text-sm font-semibold">{u.name === s.name ? t('Existing lessons') : u.name}</h3>{actions('units', branches(s.id), j)}<Button variant="outline" size="sm" onClick={() => void addLesson(s, u)}><Plus/>{t('Lesson')}</Button></div>{(data?.lessons.filter(l => l.unit_id === u.id) ?? []).map((l, k, rows) => <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-1 pl-3"><span className="min-w-0 text-sm">{l.name}</span>{actions('lessons', rows, k)}</div>)}</section>)}</div>)}
    </section>)}{!visible.length && <p className="py-6 text-muted-foreground">{t(first ? 'No subjects in this semester yet.' : 'No integrated units yet.')}</p>}</div>
    {first && (data?.units ?? []).some(u => subjects.some(s => s.id === u.subject_id) && !u.semester) && <section className="mt-6 border-t border-border pt-4"><h2 className="mb-3 font-semibold">{t('Unassigned semester')}</h2>{(data?.units ?? []).filter(u => subjects.some(s => s.id === u.subject_id) && !u.semester).map(u => <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{subjects.find(s => s.id === u.subject_id)?.name} · {u.name}</span><select className={sel} aria-label={t('Assign semester')} value="" onChange={e => void act(save({ data: { table: 'units', id: u.id, values: { semester: e.target.value } } }), t('Semester saved'))}><option value="">{t('Choose…')}</option><option>S1</option><option>S2</option></select></div>)}</section>}
  </>;
}
