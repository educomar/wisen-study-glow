export type DocPage = { pageNumber: number; text: string };
export type Mcq = { stem: string; options?: string[]; answer: string; explain: string };
export type AiMsg = { role: "ai"; text: string; points?: string[]; cite?: number; mcq?: Mcq; route?: string; routeNote?: string; sources?: string[]; studentExp?: boolean; rich?: boolean };

const STOP = new Set("this that with from have were been their there which what when where these those into also than then they them such about more most other some very your only each over under after before between during because while through being does done make made will would could should shall must upon within without explain simplify summarize quiz page lecture course".split(" "));

export const sentences = (t: string) =>
  t.replace(/\s+/g, " ").split(/(?<=[.!?;:])\s+/).map((s) => s.trim()).filter((s) => s.length > 20 && s.length < 420);
const words = (t: string) => (t.toLowerCase().match(/[a-zà-ÿ0-9-]{4,}/g) ?? []).filter((w) => !STOP.has(w));

function rank(query: string, pages: DocPage[], prefer: number) {
  const q = new Set(words(query));
  return pages
    .flatMap((p) => sentences(p.text).map((s) => ({ s, p: p.pageNumber, score: words(s).filter((w) => q.has(w)).length + (p.pageNumber === prefer ? 0.6 : 0) })))
    .sort((a, b) => b.score - a.score);
}

export function rankPages(query: string, pages: DocPage[], prefer: number) {
  const hits = rank(query, pages, prefer);
  const ids = [prefer, ...hits.filter((h) => h.score > 0).map((h) => h.p)].filter((n, i, a) => a.indexOf(n) === i).slice(0, 3);
  return ids.map((n) => pages.find((p) => p.pageNumber === n)).filter((p): p is DocPage => !!p && !!p.text.trim());
}

function terms(text: string, n = 8) {
  const f = new Map<string, number>();
  for (const w of words(text)) if (w.length >= 7) f.set(w, (f.get(w) ?? 0) + 1);
  return [...f.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
}
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const cut = (s: string, n = 90) => (s.length > n ? s.slice(0, n) + "…" : s);

export function respond(action: string, query: string, pages: DocPage[], page: number, subject: string): AiMsg {
  const current = pages.find((p) => p.pageNumber === page);
  if (!pages.some((p) => p.text.trim())) return { role: "ai", text: "This document has no readable text (it may be a scanned image), so I can't ground answers in it yet." };
  const hits = rank(query, pages, page).filter((h) => h.score > 0);
  const best = hits[0] ?? { s: sentences(current?.text ?? "")[0] ?? "", p: page, score: 0 };
  const cite = best.p;
  const top = hits.filter((h) => h.p === cite).slice(0, 3).map((h) => h.s);
  const ctx = top.length ? top : sentences(pages.find((p) => p.pageNumber === cite)?.text ?? "").slice(0, 3);
  const src = `[Source: Page ${cite}]`;

  if (!hits.length && action === "Ask") return { role: "ai", text: `I couldn't find that in this ${subject} document. Try selecting a passage or rephrasing with terms from the course.`, cite: page };

  switch (action) {
    case "Simplify":
      return { role: "ai", text: `In plain words ${src}:`, points: [cut(best.s.split(/,|;| which | because /)[0]!, 140) + ".", `Key idea: ${terms(query, 3).join(", ") || "see the highlighted passage"}.`], cite };
    case "Summarize": {
      const sum = sentences(current?.text ?? "").slice(0, 4);
      return { role: "ai", text: `Summary of page ${page} ${src.replace(String(cite), String(page))}:`, points: sum.length ? sum : ctx, cite: page };
    }
    case "Why on EMD?":
      return { role: "ai", text: `Why this is examinable in ${subject} ${src}:`, points: [...ctx.slice(0, 2), `Likely EMD targets: ${terms(ctx.join(" "), 4).join(", ")}.`, "EMDs favour definitions, derivatives, timing and exceptions — know each term exactly."], cite };
    case "Quiz me": {
      const t = terms(best.s, 1)[0];
      return { role: "ai", text: `Quick recall check ${src}:`, cite, mcq: { stem: t ? `In your own words: what does the course say about “${t}”?` : "Explain the selected passage from memory.", answer: best.s, explain: "Compare your answer with the course sentence above." } };
    }
    case "Generate EMD Question": {
      const t = terms(best.s, 1)[0];
      const pool = terms(pages.map((p) => p.text).join(" "), 20).filter((w) => w !== t);
      if (!t || pool.length < 3) return { role: "ai", text: "There isn't enough distinct content here to build a good question. Try a longer passage.", cite };
      const stem = best.s.replace(new RegExp(t, "i"), "_____");
      return { role: "ai", text: `EMD-style single best answer ${src}:`, cite, mcq: { stem: `Which term best completes this statement? “${stem}”`, options: shuffle([t, ...shuffle(pool).slice(0, 3)]), answer: t, explain: best.s } };
    }
    case "Explain":
      return { role: "ai", text: `Explanation grounded in page ${cite} ${src}:`, points: [...ctx, ...(terms(query, 3).length ? [`Focus terms: ${terms(query, 3).join(", ")}.`] : [])], cite };
    default:
      return { role: "ai", text: `From your ${subject} document ${src}:`, points: hits.slice(0, 3).map((h) => `${h.s} (p. ${h.p})`), cite };
  }
}
