export type DraftQ = { stem: string; options: string[]; answers: number[]; explanation: string; difficulty: "Easy" | "Medium" | "Hard"; aiKey?: boolean };

const LETTERS = "ABCDE";
const toIndex = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string") {
    const t = v.trim().toUpperCase();
    if (/^[A-E]$/.test(t)) return LETTERS.indexOf(t);
    if (/^\d+$/.test(t)) return Number(t);
  }
  return null;
};

/** Parse a pasted JSON array of questions. Accepts `correct: [indices|letters]` or `answer: index|letter`. */
export function parseQuestionJson(raw: string): { questions: DraftQ[]; errors: string[] } {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return { questions: [], errors: ["Invalid JSON — check commas, quotes and brackets."] }; }
  const list = Array.isArray(data) ? data : Array.isArray((data as { questions?: unknown })?.questions) ? (data as { questions: unknown[] }).questions : null;
  if (!list) return { questions: [], errors: ["Expected a JSON array of questions."] };
  const questions: DraftQ[] = [];
  const errors: string[] = [];
  list.forEach((item, i) => {
    const q = (item ?? {}) as { [K in "stem" | "question" | "options" | "correct" | "answers" | "answer" | "difficulty" | "explanation" | "why"]?: unknown };
    const stem = String(q.stem ?? q.question ?? "").trim();
    const options = (Array.isArray(q.options) ? q.options : []).map((o) => String(o).trim()).filter(Boolean);
    const rawAns = q.correct ?? q.answers ?? q.answer;
    const answers = [...new Set((Array.isArray(rawAns) ? rawAns : [rawAns]).map(toIndex).filter((n): n is number => n !== null && n >= 0 && n < options.length))].sort();
    if (!stem) { errors.push(`Question ${i + 1}: missing stem.`); return; }
    if (options.length < 2 || options.length > 5) { errors.push(`Question ${i + 1}: needs 2–5 options (A–E).`); return; }
    if (!answers.length) { errors.push(`Question ${i + 1}: no valid correct option.`);
    const d = String(q.difficulty ?? "Medium");
    questions.push({ stem, options, answers, explanation: String(q.explanation ?? q.why ?? ""), difficulty: d === "Easy" || d === "Hard" ? d : "Medium" });
  });
  return { questions, errors };
}

export const draftIssue = (q: DraftQ) =>
  !q.stem.trim() ? "Missing stem" : q.options.length < 2 || q.options.some((o) => !o.trim()) ? "Fill every option" : !q.answers.length ? "Pick a correct option" : null;
