import { KB_RULES, retrieveKb, type KbChunk } from "./knowledge";
import { MODELS, routeRequest, type Lang, type Route } from "./router";

export type WisenRequest = {
  message: string;
  action: string;
  subject: string;
  title: string;
  page: number;
  excerpts: { page: number; text: string }[];
  history: { role: "user" | "assistant"; text: string }[];
  image?: string | undefined;
  outputLanguage?: 'english' | 'french' | undefined;
  level?: { department: 'Medicine' | 'Dentistry'; year: number } | undefined;
};

const ord = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
/** Student audience phrase, e.g. "2nd-year Medicine students"; generic when the level is unknown. */
export function audience(level?: WisenRequest['level']) {
  return level ? `${ord(level.year)}-year ${level.department} students` : 'medical and dental students';
}
const faculty = (level?: WisenRequest['level']) => level?.department === 'Dentistry' ? 'Faculté de Médecine (Département de Médecine Dentaire)' : 'Faculté de Médecine';

const LANG_RULE: Record<Lang, string> = {
  darija: "Reply in Algerian Darija written in Arabic script, the way Sétif students talk. Keep medical terms in French/English (e.g. potentiel d'action, notochord) as students use them.",
  arabic: "Reply in Modern Standard Arabic. Keep key medical terms in French/English in parentheses.",
  french: "Réponds en français, au niveau de l'étudiant.",
  english: "Reply in English. Add the French term in parentheses for key medical terms when helpful.",
};
const EXP_PHRASE: Record<Lang, string> = {
  darija: "حسب تجارب الطلبة المذكورة...",
  arabic: "حسب تجارب الطلبة المذكورة...",
  french: "D'après les retours d'étudiants...",
  english: "Based on reported student experience...",
};

const TASK: Record<string, string> = {
  Explain: "Explain the selected passage clearly, then give the key mechanism and one clinical/EMD link.",
  Simplify: "Rewrite the selected passage in very simple words, like to a friend, in 3–5 short bullets.",
  Summarize: "Summarise the current page in 4–6 high-yield bullets.",
  "Why on EMD?": "Explain why this content is examinable in an EMD: definitions, timings, derivatives, exceptions and classic traps. Do not guarantee it will appear.",
  "Quiz me": "Write ONE recall question on this content, then the mcq block.",
  "Generate EMD Question": "Write ONE EMD-style single best answer (QCS) question with 4 plausible medical options, then the mcq block.",
};

export function prepare(req: WisenRequest): { route: Route; kb: KbChunk[]; system: string; user: string } {
  const route = routeRequest(req.message, { action: req.action, hasImage: !!req.image });
  if (req.outputLanguage) route.lang = req.outputLanguage;
  const { chunks, ufasCue } = retrieveKb(req.message + " " + (req.action === "Ask" ? "" : req.subject));
  const kb = ufasCue || req.action === "Ask" ? chunks : [];
  const m = MODELS[route.primary];
  const mcq = req.action === "Quiz me" || req.action === "Generate EMD Question";
  const system = [
    `You are Wisen AI, the study companion of ${audience(req.level)} at the ${faculty(req.level)}, Université Ferhat Abbas Sétif 1 (UFAS1). You are one unified assistant; never mention model names, routing or technical details.`,
    `Active expertise profile: ${m.profile} Pitch depth, vocabulary and examples at the level of ${audience(req.level)}; build on what earlier years already covered.`,
    req.outputLanguage === 'english'
      ? 'Language: Respond exclusively in English, regardless of the topic, source material or student language. Translate all medical terms, headings, tags, mnemonics, questions and answers into English. Do not add French translations in parentheses. Preserve proper names and source identifiers only.'
      : req.outputLanguage === 'french'
      ? 'Language: The student chose French. Respond exclusively in French (explanations, rationales, questions, answers, headings), regardless of the source material language. Keep standard French medical terminology.'
      : `Language: ${LANG_RULE[route.lang]} Understand Arabic, Algerian Darija (Arabic script or Latin/Arabizi like "wach", "kifach", "3lach"), French and English.`,
    `Rules:
- Ground answers in the course excerpts and UFAS1 knowledge below when relevant; otherwise use sound, standard medical knowledge pitched for ${audience(req.level)}.
- UFAS1 excerpts are labelled [academic] or [student_experience]. Anything from [student_experience] MUST be introduced with "${EXP_PHRASE[route.lang]}" and never presented as an official faculty rule.
- ${KB_RULES.exam_prediction_rule} Never claim a specific teacher will ask a specific question.
- If UFAS1-specific information is missing, say (in the reply language): "${KB_RULES.missing_information_response}" Never invent teachers, dates, coefficients or rules. Mention that dates/coefficients should be checked against official faculty announcements when you give them.
- When you use a course excerpt, cite it inline as [Source: Page N].
- Format: plain text, short paragraphs, "- " bullets, **bold** for key terms only. No headings, no tables. Keep under ~250 words unless the student asks for more.`,
    mcq ? `After your text, append exactly one fenced block:\n\`\`\`mcq\n{"stem":"...","options":["...","...","...","..."],"answer":0,"explain":"..."}\n\`\`\`\n("answer" is the 0-based index of the correct option; for a recall question options may be omitted and "answer" is the expected answer text.)` : "",
    kb.length ? `UFAS1 Knowledge Base excerpts:\n${kb.map((c, i) => `[K${i + 1}] [${c.kind}] (${c.source}) ${c.text}`).join("\n")}` : "",
    req.excerpts.length ? `Course document "${req.title}" (${req.subject}). The student is on page ${req.page}. Excerpts:\n${req.excerpts.map((e) => `[Page ${e.page}] ${e.text}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
  const user = req.action === "Ask" ? req.message : `${TASK[req.action] ?? req.action} (page ${req.page})\n\nSelected / requested: ${req.message}`;
  return { route, kb, system, user };
}
