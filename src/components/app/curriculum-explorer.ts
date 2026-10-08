import type { Tree } from './Curriculum';
import knowledge from '@/data/ufas1Knowledge.json';

export type Semester = 'all' | '1' | '2';
export const normalizeCurriculumText = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function unitSemester(name: string): '1' | '2' | null {
  const match = normalizeCurriculumText(name).match(/(?:\bs\s*|semester\s*|semestre\s*)([12])\b/);
  return match?.[1] === '1' ? '1' : match?.[1] === '2' ? '2' : null;
}
function subjectSemesters(name: string): ('1' | '2')[] {
  const key = normalizeCurriculumText(name);
  for (const semester of ['1', '2'] as const) {
    const modules = knowledge.first_year.semester_modules[semester === '1' ? 'S1' : 'S2'];
    if (modules.some(m => normalizeCurriculumText(m.name) === key || ('english' in m && normalizeCurriculumText(m.english) === key))) return [semester];
  }
  return ['1', '2'];
}
export function exploreCurriculum(tree: Tree, query: string, semester: Semester) {
  const terms = normalizeCurriculumText(query).trim().split(/\s+/).filter(Boolean);
  const matches = (...parts: string[]) => terms.every(term => normalizeCurriculumText(parts.join(' ')).includes(term));
  const groups = (semester === 'all' ? ['1', '2'] as const : [semester]).map(s => ({
    semester: s,
    subjects: tree.flatMap(subject => {
      const units = subject.units.flatMap(unit => {
        const assigned = unitSemester(unit.name);
        if (assigned ? assigned !== s : !subjectSemesters(subject.name).includes(s)) return [];
        const alias = Object.entries(knowledge.modules).find(([name, module]) => normalizeCurriculumText(name) === normalizeCurriculumText(subject.name) || ('english' in module && normalizeCurriculumText(module.english) === normalizeCurriculumText(subject.name)))?.[0] ?? '';
        const lessons = unit.lessons.filter(lesson => matches(subject.name, alias, unit.name, lesson.name, ...lesson.files.map(f => f.file_name)));
        return lessons.length || matches(subject.name, alias, unit.name) ? [{ ...unit, lessons }] : [];
      });
      return units.length ? [{ ...subject, units }] : [];
    }),
  }));
  const subjects = new Set<string>(), units = new Set<string>(), lessons = new Set<string>();
  groups.forEach(group => group.subjects.forEach(subject => { subjects.add(subject.id); subject.units.forEach(unit => { units.add(unit.id); unit.lessons.forEach(lesson => lessons.add(lesson.id)); }); }));
  return { groups, counts: { modules: subjects.size, units: units.size, lessons: lessons.size } };
}