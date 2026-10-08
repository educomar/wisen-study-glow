import { describe, test } from 'node:test';
import { deepStrictEqual } from 'node:assert';
import { parseSheetCards, sheetSuggestions, sourcePages, splitTeaser } from './sheet-content';

describe('Study Sheet rules', () => {
  test('defaults to UFAS1 Year 1 Medicine topics', () => {
    deepStrictEqual(sheetSuggestions(null, null).map(t => t.topic), ['Femur', 'Brachial Plexus', 'Gastrulation & Neurulation', 'First Week of Development', 'Epithelial Tissue', 'Protein Structure', 'Ionizing Radiation']);
  });
  test('other study years use actual authorized lectures rather than first-year topics', () => {
    deepStrictEqual(sheetSuggestions({ academic_year: 3, department: 'Medicine' }, [{ id: 's', name: 'Cardiologie', emds: [], units: [{ id: 'u', name: 'Cours', lessons: [{ id: 'l', name: 'Insuffisance cardiaque', files: [] }] }] }]), [{ topic: 'Heart Failure', subject: 'Cardiology' }]);
  });
  test('embedded Kapsules retain the exact generated answers', () => {
    deepStrictEqual(parseSheetCards('Q: Where?\nA: In the femur.\n\nQ: When?\nA: During week three.'), [{ front: 'Where?', back: 'In the femur.' }, { front: 'When?', back: 'During week three.' }]);
  });
  test('teaser is separated from the overview', () => {
    deepStrictEqual(splitTeaser('TEASER: What changes?\nOverview text'), { teaser: 'What changes?', body: 'Overview text' });
  });
  test('faculty source pages come only from extracted page markers', () => {
    deepStrictEqual(sourcePages('[Page 1] text [Page 2] text [Page 1]'), ['1', '2']);
  });
});