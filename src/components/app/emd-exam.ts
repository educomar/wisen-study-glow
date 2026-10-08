/** Pure helpers for EMD practice and the real-exam simulator. */
export type Graded = { answer: number; picked: number | null };

/** All-or-nothing per question (an MCQ answer is a bitmask), scaled to the faculty's /20 mark. */
export function scoreOn20(items: Graded[]) {
  const correct = items.filter((x) => x.picked !== null && x.picked === x.answer).length;
  const total = items.length;
  return { correct, total, on20: total ? Math.round((correct / total) * 2000) / 100 : 0, accuracy: total ? Math.round((correct / total) * 100) : 0 };
}

/** Academic year of a past EMD: "2022-2023" / "2022/23" in the file name, else a single year, else the file date. */
export function emdYear(name: string, date?: string | null) {
  const pair = name.match(/(20\d{2})\s*[-_/]\s*(20)?(\d{2})/);
  if (pair) return `${pair[1]}-${pair[2] ? pair[2] + pair[3] : "20" + pair[3]}`;
  const one = name.match(/20\d{2}/);
  if (one) return one[0];
  return date ? String(new Date(date).getUTCFullYear()) : "Undated";
}

/** Toggle option k in an answer: radio for single answer, bitmask for multi. */
export const toggleOption = (cur: number | null, k: number, multi: boolean) => (multi ? ((cur ?? 0) ^ (1 << k)) || null : cur === k ? null : k);
export const isPicked = (cur: number | null, k: number, multi: boolean) => (multi ? cur !== null && ((cur >> k) & 1) === 1 : cur === k);
