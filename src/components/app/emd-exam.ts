/** Pure helpers for EMD practice and the real-exam simulator. */
export type Graded = { answer: number; picked: number | null; multi?: boolean };
export type Scoring = "aon" | "partial" | "positive";
export const SCORING: { key: Scoring; label: string; hint: string }[] = [
  { key: "aon", label: "All-or-Nothing", hint: "Strict scoring — all correct answers required." },
  { key: "partial", label: "Partial Scoring", hint: "Partial credit for incomplete answers, but incorrect choices give 0." },
  { key: "positive", label: "Improved / Positive Partial Scoring", hint: "Partial credit with penalties for incorrect choices." },
];

const bits = (n: number) => { let c = 0; for (let x = n; x; x &= x - 1) c++; return c; };

/** Credit (0..1) for one question. Multi answers are bitmasks; single answers are option indexes. */
export function questionCredit(g: Graded, mode: Scoring) {
  if (g.picked === null || g.picked < 0) return 0;
  if (!g.multi) return g.picked === g.answer ? 1 : 0;
  const n = bits(g.answer); if (!n) return 0;
  const hits = bits(g.picked & g.answer), wrong = bits(g.picked & ~g.answer);
  if (mode === "aon") return g.picked === g.answer ? 1 : 0;
  if (mode === "partial") return wrong ? 0 : hits / n;
  return Math.max(0, (hits - wrong) / n);
}

export function scoreWith(items: Graded[], mode: Scoring) {
  const total = items.length;
  const pts = items.reduce((a, g) => a + questionCredit(g, mode), 0);
  return total ? Math.round((pts / total) * 2000) / 100 : 0;
}

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
