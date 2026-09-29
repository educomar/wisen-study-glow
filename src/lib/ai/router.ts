// Wisen AI Router: analyses language + subject + complexity and picks a model with a fallback chain.
export type ModelKey = "qwen" | "medgemma" | "gemma27" | "mistral" | "gemma4";
export type Lang = "darija" | "arabic" | "french" | "english";

export const MODELS: Record<ModelKey, { label: string; remote: string; profile: string }> = {
  qwen: { label: "Qwen3", remote: "qwen/qwen3-235b-a22b", profile: "Multilingual generalist (Arabic, Algerian Darija, French, English). Warm, clear study explanations, translation and rephrasing." },
  medgemma: { label: "MedGemma 27B", remote: "google/medgemma-27b-it", profile: "Medical specialist for anatomy, physiology, biochemistry, histology, embryology, pathology and pharmacology. Precise terminology and sound biomedical reasoning pitched at a 1st-year student." },
  gemma27: { label: "Gemma 3 27B", remote: "google/gemma-3-27b-it", profile: "Multimodal analyst. Carefully describe and interpret images, diagrams, charts and tables before explaining them." },
  mistral: { label: "Mistral Small", remote: "mistralai/mistral-small-3.2-24b-instruct", profile: "Structured reasoner for complex, multi-step and comparative questions. Break the problem into clear numbered steps." },
  gemma4: { label: "Gemma 3 4B", remote: "google/gemma-3-4b-it", profile: "Fast responder for simple definitions, short explanations and quick translations. Be brief: 1–4 sentences." },
};

const CHAINS: Record<ModelKey, ModelKey[]> = {
  qwen: ["qwen", "mistral", "gemma4"],
  medgemma: ["medgemma", "mistral", "qwen"],
  gemma27: ["gemma27", "qwen", "mistral"],
  mistral: ["mistral", "qwen", "medgemma"],
  gemma4: ["gemma4", "qwen"],
};

const DARIJA_AR = ["واش", "كيفاش", "علاش", "شحال", "وين", "نقراو", "نقرا", "اشرحلي", "فهمني", "راني", "راك", "بزاف", "ماشي", "هاذ", "هذي", "كاين", "نتاع", "تاع", "ديال", "شنو", "واشنو", "نحب", "خويا", "درك", "بصح", "مليح"];
const DARIJA_LAT = ["wach", "wech", "kifach", "kifech", "3lach", "chhal", "bzaf", "rani", "rak", "khoya", "nta3", "ta3", "kayen", "mlih", "drk", "bsah", "fhamni", "nqraw", "ch7al"];
const FR = ["le", "la", "les", "est", "des", "du", "une", "qu", "quel", "quelle", "pourquoi", "comment", "c'est", "qu'est", "expliquer", "explique", "cours", "différence", "avec", "pour", "dans", "sont"];

const MEDICAL = ["anatom", "physiolog", "biochim", "biochem", "histolog", "embryo", "patholog", "pharmac", "cytolog", "cell", "cellul", "neuron", "nerf", "nerve", "heart", "cœur", "coeur", "muscle", "enzyme", "hormon", "action potential", "potentiel d'action", "notochord", "notochorde", "neural", "glucose", "protein", "protéine", "lipid", "lipide", "disease", "maladie", "syndrome", "drug", "médicament", "blood", "sang", "kidney", "rein", "artery", "artère", "vertebra", "vertèbre", "bone", "os ", "gamet", "oocyte", "fécondation", "fertiliz", "membrane", "metabol", "métabol", "tissu", "tissue", "organ", "somite", "crest", "folate", "teratog",
  "تشريح", "فيزيولوج", "خلية", "خلايا", "قلب", "عضلة", "عصب", "دم", "مرض", "دواء", "إنزيم", "انزيم", "هرمون", "كلية", "عظم", "أجنة", "جنين", "أنسجة", "بروتين", "غلوكوز", "كمون"];
const COMPLEX = ["compare", "comparer", "comparaison", " vs ", "versus", "difference", "différence", "why does", "pourquoi", "mechanism", "mécanisme", "step by step", "étape", "relationship", "relation entre", "analyse", "analyze", "قارن", "الفرق", "علاش", "لماذا", "آلية", "كيفاش يخدم"];
const SIMPLE = ["what is", "define", "definition", "définition", "c'est quoi", "qu'est-ce", "meaning", "ما هو", "ما هي", "واش هو", "واش هي", "شنو", "wach howa", "translate", "traduire", "traduis", "ترجم", "rephrase", "reformule"];
const TRANSLATE = ["translate", "tradui", "ترجم", "rephrase", "reformul", "أعد صياغة"];

const has = (t: string, list: string[]) => list.some((w) => t.includes(w));

export function detectLanguage(text: string): Lang {
  const arabic = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const t = ` ${text.toLowerCase()} `;
  if (arabic > 3) return has(t, DARIJA_AR) ? "darija" : "arabic";
  const words = t.split(/[^a-zà-ÿ0-9']+/).filter(Boolean);
  if (words.some((w) => DARIJA_LAT.includes(w))) return "darija";
  const fr = words.filter((w) => FR.includes(w)).length;
  return fr >= 2 || /[éèêàçù]/.test(t) && fr >= 1 ? "french" : "english";
}

export type Route = { primary: ModelKey; chain: ModelKey[]; lang: Lang; medical: boolean; complexity: "simple" | "normal" | "complex"; reason: string };

export function routeRequest(message: string, opts: { action?: string; hasImage?: boolean } = {}): Route {
  const t = ` ${message.toLowerCase()} `;
  const lang = detectLanguage(message);
  const lectureAction = !!opts.action && opts.action !== "Ask";
  const medical = lectureAction || has(t, MEDICAL);
  const words = message.trim().split(/\s+/).length;
  const complexity = has(t, COMPLEX) || words > 60 || (message.match(/\?/g) ?? []).length > 1 || opts.action === "Generate EMD Question" ? "complex" : words <= 9 && has(t, SIMPLE) ? "simple" : "normal";
  let primary: ModelKey;
  let reason: string;
  if (opts.hasImage) { primary = "gemma27"; reason = "image / diagram request"; }
  else if (complexity === "complex") { primary = "mistral"; reason = "multi-step or comparative reasoning"; }
  else if (has(t, TRANSLATE)) { primary = words <= 25 ? "gemma4" : "qwen"; reason = "translation / rephrasing"; }
  else if (complexity === "simple" && !lectureAction) { primary = "gemma4"; reason = "short definition / quick answer"; }
  else if (medical) { primary = "medgemma"; reason = "biomedical topic"; }
  else { primary = "qwen"; reason = lang === "english" ? "general study conversation" : `general conversation in ${lang}`; }
  return { primary, chain: CHAINS[primary], lang, medical, complexity, reason };
}
