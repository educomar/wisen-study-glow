export const studyViews = ['courses', 'ai', 'qbank', 'faculty', 'past', 'exam', 'history', 'mistakes', 'cards', 'new', 'decks', 'reviews', 'progress', 'saved'] as const;
export type StudyView = typeof studyViews[number];
export function studySearch(search: Record<string, unknown>): { view?: StudyView; query?: string } {
 const view = studyViews.find(v => v === search['view']);
 return { ...(view ? { view } : {}), ...(typeof search['query'] === 'string' ? { query: search['query'].slice(0, 300) } : {}) };
}
