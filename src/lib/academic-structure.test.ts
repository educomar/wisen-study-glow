import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { academicRoles, semesterBased, validateSemester } from './academic-structure';
describe('year-specific academic organization', () => {
  it('Year 1 uses semester branches only', () => {
    assert.equal(semesterBased(1), true);
    assert.deepEqual(academicRoles(1), { parent: 'Subject', branch: 'Semester' });
    assert.doesNotThrow(() => validateSemester(1, 'S1'));
    assert.doesNotThrow(() => validateSemester(1, 'S2'));
  });
  for (const year of [2,3,4,5,6]) it(`Year ${year} uses integrated units, subjects and no semesters`, () => {
    assert.equal(semesterBased(year), false);
    assert.deepEqual(academicRoles(year), { parent: 'Integrated unit', branch: 'Subject' });
    assert.throws(() => validateSemester(year, 'S1'), /Year 1 only/);
    assert.throws(() => validateSemester(year, 'S2'), /Year 1 only/);
  });
  it('rejects nonexistent semesters', () => assert.throws(() => validateSemester(1, 'S3'), /S1 or S2/));
});
