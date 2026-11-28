import { describe, test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { exploreCurriculum, unitSemester } from './curriculum-explorer';
import type { Tree } from './Curriculum';
const tree: Tree = [
  { id:'a', name:'Anatomie', emds:[], units:[{id:'u1',name:'Upper limb',lessons:[{id:'l1',name:'Articulations du coude',files:[]}]}] },
  { id:'e', name:'Embryologie', emds:[], units:[{id:'u2',name:'Development',lessons:[{id:'l2',name:'Fécondation',files:[]}]}] },
  { id:'h', name:'Histologie', emds:[], units:[{id:'u3',name:'Tissues',lessons:[{id:'l3',name:'Epithelium',files:[]}]}] },
];
describe('academic explorer rules', () => {
  test('Semester 1 includes annual modules and Embryologie, not Histologie', () => { deepStrictEqual(exploreCurriculum(tree,'','1').groups[0]?.subjects.map(s=>s.id), ['a','e']); });
  test('Semester 2 includes annual modules and Histologie, not Embryologie', () => { deepStrictEqual(exploreCurriculum(tree,'','2').groups[0]?.subjects.map(s=>s.id), ['a','h']); });
  test('All Modules counts shared annual content only once', () => { deepStrictEqual(exploreCurriculum(tree,'','all').counts, {modules:3,units:3,lessons:3}); });
  test('Search matches lessons and subjects in real time without accent sensitivity', () => { strictEqual(exploreCurriculum(tree,'embryologie fecondation','all').counts.lessons, 1); strictEqual(exploreCurriculum(tree,'unknown','all').counts.lessons, 0); });
  test('Language-version semester labels retain their semester', () => { strictEqual(unitSemester('S1 — French Version'), '1'); strictEqual(unitSemester('Semestre 2 English'), '2'); });
});
test('annual curricula (Year 2) list modules once without semesters', () => {
  const tree = [{ id: 's', name: 'Système Digestif', units: [{ id: 'u', name: 'Anatomie', lessons: [{ id: 'l', name: 'Foie', files: [] }] }] }] as never;
  const r = exploreCurriculum(tree, '', 'all');
  strictEqual(r.semestered, false);
  deepStrictEqual(r.groups.map(g => g.semester), ["all"]);
  strictEqual(r.counts.modules, 1);
});

test('Year 2 Anatomy labels never enable semesters', () => {
  const annual: Tree = [{ id: 'module', name: 'Anatomy', academic_year: 2, emds: [], units: [{ id: 'discipline', name: 'Semester 1', lessons: [{ id: 'existing-id', name: 'Heart', files: [] }] }] }];
  const r = exploreCurriculum(annual, '', '1');
  strictEqual(r.semestered, false);
  deepStrictEqual(r.groups.map(g => g.semester), ['all']);
  strictEqual(r.groups[0]?.subjects[0]?.units[0]?.lessons[0]?.id, 'existing-id');
});
test('Year 1 explicit semester overrides old folder names', () => {
  const first: Tree = [{ id: 's', name: 'Chemistry', academic_year: 1, emds: [], units: [{ id: 'u1', name: 'Lectures', semester: 'S1', lessons: [{ id: 'atom', name: 'Classical Models of the Atom', files: [] }] }, { id: 'u2', name: 'Lectures', semester: 'S2', lessons: [{ id: 'organic', name: 'Organic Chemistry', files: [] }] }] }];
  deepStrictEqual(exploreCurriculum(first, '', '1').groups[0]?.subjects[0]?.units.flatMap(u => u.lessons.map(l => l.id)), ['atom']);
  deepStrictEqual(exploreCurriculum(first, '', '2').groups[0]?.subjects[0]?.units.flatMap(u => u.lessons.map(l => l.id)), ['organic']);
});
test('the same subject can occur in distinct integrated units without collapsing identifiers', () => {
  const annual: Tree = ['cardio','digestive'].map(id => ({ id, name: id, academic_year: 2, emds: [], units: [{ id: `${id}-anatomy`, name: 'Anatomy', lessons: [{ id: `${id}-lesson`, name: 'Anatomy', files: [] }] }] }));
  const r = exploreCurriculum(annual, 'Anatomy', 'all');
  deepStrictEqual(r.counts, { modules: 2, units: 2, lessons: 2 });
  deepStrictEqual(r.groups[0]?.subjects.flatMap(s => s.units.flatMap(u => u.lessons.map(l => l.id))), ['cardio-lesson','digestive-lesson']);
});
