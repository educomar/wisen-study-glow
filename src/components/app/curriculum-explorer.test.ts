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