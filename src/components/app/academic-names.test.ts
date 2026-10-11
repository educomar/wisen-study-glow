import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { academicName } from './academic-names';
describe('academic naming compatibility', () => {
  it('preserves older lesson and semester links', () => {
    assert.equal(academicName('intro humain Anatomy  (1)', 'Anatomy'), 'Introduction to Human Anatomy');
    assert.equal(academicName('S1', 'Anatomy'), 'Semester 1');
  });
  it('preserves medical terminology and abbreviations', () => {
    assert.equal(academicName('SNV(Vegetative nervous system)', 'Physiology'), 'Autonomic Nervous System (SNV)');
    assert.equal(academicName('Électrostatique', 'Biophysics'), 'Électrostatique');
  });
  it('never rewrites unrelated subjects or medical prose', () => {
    assert.equal(academicName('S1', 'Unrelated Subject'), 'S1');
    assert.equal(academicName('The S1 nerve root supplies this region.'), 'The S1 nerve root supplies this region.');
  });
});
