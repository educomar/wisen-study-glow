import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import type { CurFile, Tree } from './Curriculum';
import { exploreCurriculum, hasSemesters } from './curriculum-explorer';
import { Button } from '@/components/ui/button';
export type Scope = { s: string; u: string; l: string; f: string };
export const emptyScope: Scope = { s: '', u: '', l: '', f: '' };
const sel = 'h-9 min-w-0 max-w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary';
export function resolveScope(tree: Tree | null, sc: Scope) {
  const s = tree?.find(x => x.id === sc.s), u = s?.units.find(x => x.id === sc.u), l = u?.lessons.find(x => x.id === sc.l);
  const all: CurFile[] = (l ? [l] : u ? u.lessons : s ? s.units.flatMap(x => x.lessons) : []).flatMap(x => x.files);
  const files = sc.f ? all.filter(f => f.id === sc.f) : all;
  const label = [s?.name, s?.academic_year === 1 ? '' : u?.name, l?.name, sc.f ? files[0]?.file_name : ''].filter(Boolean).join(' → ');
  return { subject: s?.name ?? '', unit: u?.name ?? '', lesson: l?.name ?? '', files, label, emds: s?.emds ?? [] };
}
export function ScopePicker({ tree, value, onChange, fileLevel = true, lessonLevel = true, formatLabel = (label: string) => label }: { tree: Tree | null; value: Scope; onChange: (v: Scope) => void; fileLevel?: boolean; lessonLevel?: boolean; formatLabel?: (label: string) => string }) {
  const { t } = useLang();
  const [semester, setSemester] = useState<'1' | '2'>('1');
  const first = hasSemesters(tree ?? []);
  const selected = tree?.find(x => x.id === value.s)?.units.find(x => x.id === value.u);
  const activeSemester = selected?.semester === 'S2' ? '2' : selected?.semester === 'S1' ? '1' : semester;
  const options = first ? exploreCurriculum(tree ?? [], '', activeSemester).groups.flatMap(g => g.subjects) : tree ?? [];
  const s = options.find(x => x.id === value.s), u = s?.units.find(x => x.id === value.u), l = u?.lessons.find(x => x.id === value.l);
  const lessons = first ? s?.units.flatMap(branch => branch.lessons.map(lesson => ({ ...lesson, unitId: branch.id }))) ?? [] : u?.lessons.map(lesson => ({ ...lesson, unitId: u.id })) ?? [];
  const files = (l ? [l] : u ? u.lessons : []).flatMap(x => x.files);
  return <div className="flex flex-wrap gap-2">
    {first && <div className="flex w-full gap-2" role="tablist" aria-label={t('Semester')}>{(['1','2'] as const).map(v => <Button key={v} type="button" role="tab" aria-selected={activeSemester === v} variant={activeSemester === v ? 'default' : 'outline'} onClick={() => { setSemester(v); onChange(emptyScope); }}>S{v}</Button>)}</div>}
    <label className="min-w-0 flex-1 text-sm">{t(first ? 'Subject' : 'Integrated unit')}<select aria-label={t(first ? 'Subject' : 'Integrated unit')} className={`${sel} block w-full`} value={value.s} onChange={e => onChange({ ...emptyScope, s: e.target.value })}><option value="">{t('Choose…')}</option>{options.map(x => <option key={x.id} value={x.id}>{formatLabel(x.name)}</option>)}</select></label>
    {!first && s && <label className="min-w-0 flex-1 text-sm">{t('Subject')}<select aria-label={t('Subject')} className={`${sel} block w-full`} value={value.u} onChange={e => onChange({ ...value, u: e.target.value, l: '', f: '' })}><option value="">{t('All subjects')}</option>{s.units.map(x => <option key={x.id} value={x.id}>{formatLabel(x.name === s.name ? t('Existing lessons') : x.name)}</option>)}</select></label>}
    {lessonLevel && s && (first || u) && <label className="min-w-0 flex-1 text-sm">{t('Lesson')}<select aria-label={t('Lesson')} className={`${sel} block w-full`} value={value.l} onChange={e => { const lesson = lessons.find(x => x.id === e.target.value); onChange({ ...value, u: lesson?.unitId ?? (first ? '' : value.u), l: e.target.value, f: '' }); }}><option value="">{t('All lessons')}</option>{lessons.map(x => <option key={x.id} value={x.id}>{formatLabel(x.name)}</option>)}</select></label>}
    {fileLevel && u && files.length > 0 && <select aria-label={t('File')} className={`${sel} max-w-56`} value={value.f} onChange={e => onChange({ ...value, f: e.target.value })}><option value="">{t('All files')}</option>{files.map(x => <option key={x.id} value={x.id}>{formatLabel(x.file_name)}</option>)}</select>}
  </div>;
}
