import type { CardState } from './store';

export const kapsuleRatings = ['Again', 'Hard', 'Good', 'Easy'] as const;
export type KapsuleRating = typeof kapsuleRatings[number];
export function scheduleKapsule(rating: KapsuleRating, previous: CardState | undefined, now: number): CardState {
  const box = rating === 'Again' ? 1 : rating === 'Hard' ? Math.max(1, (previous?.box ?? 1) - 1) : rating === 'Easy' ? Math.min(5, Math.max(3, (previous?.box ?? 0) + 2)) : Math.min(5, (previous?.box ?? 0) + 1);
  const interval = rating === 'Again' ? 60_000 : rating === 'Hard' ? 360_000 : 86_400_000 * ([0, 1, 2, 4, 8, 16][box] ?? 1);
  return { box, due: now + interval, status: rating === 'Again' || rating === 'Hard' ? 'learning' : 'review' };
}
export function kapsuleRetention(ratings: KapsuleRating[]) {
  return ratings.length ? Math.round(ratings.filter(r => r === 'Good' || r === 'Easy').length / ratings.length * 100) : null;
}