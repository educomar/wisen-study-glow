import { describe, expect, test } from 'bun:test';
import { parseSheetCards, sheetSuggestions, sourcePages, splitTeaser } from './sheet-content';

describe('Study Sheet rules', () => {
  test('defaults to UFAS1 Year 1 Medicine topics', () => {
    expect(sheetSuggestions(null, null).map(t => t.topic)).toEqual(['Le Fémur', 'Plexus Brachial', 'Gastrulation & Neurulation', 'Première semaine', 'Tissu Épithélial', 'Structure des Protéines']);
  });
  test('other study years use actual authorized lectures rather than first-year topics', () => {
    expect(sheetSuggestions({ academic_year: 3, department: 'Medicine' }, [{ id: 's', name: 'Cardiologie', emds: [], units: [{ id: 'u', name: 'Cours', lessons: [{ id: 'l', name: 'Insuffisance cardiaque', files: [] }] }] }])).toEqual([{ topic: 'Insuffisance cardiaque', subject: 'Cardiologie' }]);
  });
  test('embedded Kapsules retain the exact generated answers', () => {
    expect(parseSheetCards('Q: Where?\nA: In the femur.\n\nQ: When?\nA: During week three.')).toEqual([{ front: 'Where?', back: 'In the femur.' }, { front: 'When?', back: 'During week three.' }]);
  });
  test('teaser is separated from the overview', () => {
    expect(splitTeaser('TEASER: What changes?\nOverview text')).toEqual({ teaser: 'What changes?', body: 'Overview text' });
  });
  test('faculty source pages come only from extracted page markers', () => {
    expect(sourcePages('[Page 1] text [Page 2] text [Page 1]')).toEqual(['1', '2']);
  });
});