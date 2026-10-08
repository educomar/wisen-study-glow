import { describe, expect, test } from 'bun:test';
import { exploreCurriculum, unitSemester } from './curriculum-explorer';
import type { Tree } from './Curriculum';
const tree: Tree = [
  { id:'a', name:'Anatomie', emds:[], units:[{id:'u1',name:'Upper limb',lessons:[{id:'l1',name:'Articulations du coude',files:[]}]}] },
  { id:'e', name:'Embryologie', emds:[], units:[{id:'u2',name:'Development',lessons:[{id:'l2',name:'Fécondation',files:[]}]}] },
  { id:'h', name:'Histologie', emds:[], units:[{id:'u3',name:'Tissues',lessons:[{id:'l3',name:'Epithelium',files:[]}]}] },
];
describe('academic explorer rules', () => {
  test('Semester 1 includes annual modules and Embryologie, not Histologie', () => { expect(exploreCurriculum(tree,'','1').groups[0]?.subjects.map(s=>s.id)).toEqual(['a','e']); });
  test('Semester 2 includes annual modules and Histologie, not Embryologie', () => { expect(exploreCurriculum(tree,'','2').groups[0]?.subjects.map(s=>s.id)).toEqual(['a','h']); });
  test('All Modules counts shared annual content only once', () => { expect(exploreCurriculum(tree,'','all').counts).toEqual({modules:3,units:3,lessons:3}); });
  test('Search matches lessons and subjects in real time without accent sensitivity', () => { expect(exploreCurriculum(tree,'embryologie fecondation','all').counts.lessons).toBe(1); expect(exploreCurriculum(tree,'unknown','all').counts.lessons).toBe(0); });
  test('Language-version semester labels retain their semester', () => { expect(unitSemester('S1 — French Version')).toBe('1'); expect(unitSemester('Semestre 2 English')).toBe('2'); });
});