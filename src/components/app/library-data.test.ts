import assert from 'node:assert/strict';
import test from 'node:test';
import { groupLibraryDecks, parseLibrarySheets, SAVED_SHEET_PREFIX } from './library-data';

test('groups cards into decks and counts cards due now', () => {
  const cards = [{ id: 'a', topic: 'Anatomy', front: 'F', back: 'B', tip: '' }, { id: 'b', topic: 'Anatomie', front: 'F2', back: 'B2', tip: '' }];
  const decks = groupLibraryDecks(cards, { a: { due: 10, status: 'review' }, b: { due: 999, status: 'review' } }, 100);
  assert.equal(decks.length, 1);
  assert.equal(decks[0]?.name, 'Anatomy');
  assert.equal(decks[0]?.cards.length, 2);
  assert.equal(decks[0]?.due, 1);
});

test('parses only structured saved sheets and keeps their saved date', () => {
  const sheet = { id: 'sheet-1', topic: 'Femur', subject: 'Anatomy', level: 'Fundamental', focus: 'General', sections: { points: '1. Head and neck' }, teaser: '', cards: [], sources: [], complete: true, cardsAdded: false };
  const rows = parseLibrarySheets([{ id: 'n1', text: SAVED_SHEET_PREFIX + JSON.stringify(sheet), subject: 'Femur', source: 'Study Sheet', t: 123 }, { id: 'n2', text: 'ordinary note', subject: 'Other', source: 'Study Sheet', t: 999 }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.savedAt, 123);
  assert.match(rows[0]?.preview ?? '', /Head and neck/);
});