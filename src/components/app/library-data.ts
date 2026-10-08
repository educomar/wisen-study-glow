import type { Card } from './data';
import type { Note, CardState } from './store';
import { englishSheetLabel, sheetSections, type StudySheetData } from './sheet-content';

export const SAVED_SHEET_PREFIX = 'WISEN_SHEET_V1\n';

export type LibraryDeck = { name: string; module: string; cards: Card[]; due: number };
export type LibrarySheet = { noteId: string; savedAt: number; sheet: StudySheetData; preview: string };

export function groupLibraryDecks(cards: Card[], states: Record<string, CardState>, now: number): LibraryDeck[] {
  const grouped = new Map<string, Card[]>();
  for (const card of cards) {
    const name = englishSheetLabel(card.topic || 'My Kapsules');
    grouped.set(name, [...(grouped.get(name) ?? []), card]);
  }
  return [...grouped.entries()].map(([name, deckCards]) => ({
    name,
    module: name,
    cards: deckCards,
    due: deckCards.filter(card => (states[card.id]?.due ?? 0) <= now).length,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export function parseLibrarySheets(notes: Note[]): LibrarySheet[] {
  return notes.flatMap(note => {
    if (note.source !== 'Study Sheet' || !note.text.startsWith(SAVED_SHEET_PREFIX)) return [];
    try {
      const sheet = JSON.parse(note.text.slice(SAVED_SHEET_PREFIX.length)) as StudySheetData;
      if (!sheet.id || !sheet.topic || !sheet.sections || !Array.isArray(sheet.cards)) return [];
      const preview = sheet.sections.points || sheet.sections.overview || sheetSections.map(section => sheet.sections[section.id]).find(Boolean) || '';
      return [{ noteId: note.id, savedAt: note.t, sheet, preview: preview.replace(/[#*\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 190) }];
    } catch {
      return [];
    }
  }).sort((a, b) => b.savedAt - a.savedAt);
}