import kb from "@/data/ufas1Knowledge.json";

export type KbChunk = { id: string; source: string; kind: "academic" | "student_experience"; text: string; keys: string[] };

const SRC = "UFAS1 — 1ère année médecine";
const ALIASES: Record<string, string[]> = {
  Anatomie: ["anatom", "تشريح", "membre", "limb", "osteolog", "ostéolog", "arthrolog", "kamina"],
  Biochimie: ["biochim", "biochem", "بيوكيمي", "بيوشيمي", "glucide", "lipid", "protein", "protéine", "carbohydrate", "métabolisme", "metabolism"],
  Biophysique: ["biophys", "بيوفيزي", "optique", "optics", "électric", "electric", "dialys", "radiation", "rayonnement", "lentille", "lens", "myop", "ohm"],
  "Biostatistique et informatique": ["biostat", "statisti", "إحصاء", "informatique", "computer", "loi normale", "normal distribution", "test statistique"],
  Cytologie: ["cytolog", "خلية", "cellule", " cell", "organelle", "organite", "bactéri", "bacteri", "virus"],
  Chimie: ["chimie", "chemistry", "كيمياء", "ph ", "periodic", "périodique", "atom", "liaison", "organique"],
  Embryologie: ["embryo", "أجنة", "جنين", "gamét", "gamet", "fécondation", "fertiliz", "oocyt", "ovocyte", "spermat"],
  SSH: ["ssh", "santé, société", "histoire", "history of medicine", "تاريخ الطب", "hôpitaux", "hopitaux"],
  Histologie: ["histolog", "أنسجة", "tissu"],
  Physiologie: ["physiolog", "فيزيولوج", "فيزيو", "action potential", "potentiel d'action"],
};
const UFAS = ["ufas", "setif", "sétif", "سطيف", "fac", "faculté", "faculty", "كلية الطب", "prof", "pr ", "teacher", "enseignant", "أستاذ", "استاذ", "coefficient", "coef", "معامل", "كوف", "emd", "exam", "examen", "امتحان", "إمتحان", "module", "مقياس", "1ère année", "first year", "première année", "سنة أولى", "عام أول", "qcm", "qcs", "qroc"];

const j = (v: unknown) => (Array.isArray(v) ? v.join(", ") : String(v));

function build(): KbChunk[] {
  const c: KbChunk[] = [];
  const fy = kb.first_year;
  const ms = kb.medical_studies;
  c.push({ id: "cycles", source: `${SRC} · Cursus`, kind: "academic", keys: ["cycle", "cursus", "préclinique", "pre-clinical", "clinique", "clinical", "internat", "سنوات", "مدة", "duration", "7 ans", "how many years", "combien d'années"], text: `Medical studies last ${ms.duration_years} years: pre-clinical cycle years 1–3 (${ms.cycles.pre_clinical.description}), clinical cycle years 4–6 (${ms.cycles.clinical.description}), internat in year 7.` });
  c.push({ id: "exams", source: `${SRC} · EMD`, kind: "academic", keys: ["emd", "exam", "examen", "امتحان", "إمتحان", "date", "janvier", "january", "juin", "june", "semestr", "سداسي", "متى", "quand", "when"], text: `First year is ${fy.system}. EMD1: ${fy.exams.EMD1}. EMD2: ${fy.exams.EMD2}. Dates are time-sensitive; verify with the latest official faculty announcement.` });
  c.push({ id: "modules", source: `${SRC} · Modules & coefficients`, kind: "academic", keys: ["module", "مقياس", "مقاييس", "coefficient", "coef", "معامل", "كوف", "annual", "annuel", "s1", "s2", "semestre", "programme", "curriculum", "subjects", "matières"], text: `Annual modules (coef): ${fy.annual_modules.map((m) => `${m.name} (${m.coefficient})`).join(", ")}. S1: ${fy.semester_modules.S1.map((m) => `${m.name} (${m.coefficient})`).join(", ")}. S2: ${fy.semester_modules.S2.map((m) => `${m.name} (${m.coefficient})`).join(", ")}.` });
  c.push({ id: "language", source: `${SRC} · Langue d'enseignement`, kind: "academic", keys: ["english", "anglais", "langue", "language", "لغة", "انجليزية", "إنجليزية", "français", "french", "فرنسية"], text: `English-taught modules: ${j(fy.english_taught_modules)}. ${fy.language_note}` });
  c.push({ id: "qtypes", source: `${SRC} · Types de questions`, kind: "academic", keys: ["qroc", "qcs", "qcm", "question type", "type de question", "أنواع الأسئلة"], text: Object.entries(kb.assessment.question_types).map(([k, v]) => `${k}: ${v}`).join(". ") });
  c.push({ id: "correction", source: `${SRC} · Correction QCM`, kind: "academic", keys: ["correction", "tout ou rien", "partiel", "barème", "notation", "تصحيح", "scoring", "grading", "note"], text: Object.entries(kb.assessment.qcm_correction).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v.description} Example (correct A,B,C): ${Object.entries(v.example).filter(([x]) => x !== "correct").map(([x, s]) => `${x.replace(/_/g, "+")}=${s}`).join(", ")}`).join(" | ") + `. ${kb.assessment.strategy_note}` });
  c.push({ id: "experience", source: `${SRC} · Expérience étudiante`, kind: "student_experience", keys: ["advantage", "avantage", "difficult", "difficulté", "stress", "صعوبات", "مزايا", "experience", "expérience", "تجربة", "hospital", "hôpital", "students", "étudiants"], text: `Perceived advantages: ${kb.student_experience.perceived_advantages.join(" ")} Perceived difficulties: ${kb.student_experience.perceived_difficulties.join(" ")}` });

  for (const [name, raw] of Object.entries(kb.modules)) {
    const m = raw as Record<string, any>;
    const keys = [name.toLowerCase(), ...(ALIASES[name] ?? [])];
    const src = `${SRC} · Module: ${name}`;
    const topics = m["topics"] ? (Array.isArray(m["topics"]) ? j(m["topics"]) : Object.entries(m["topics"]).map(([k, v]) => `${k}: ${j(v)}`).join("; ")) : m["sections"] ? Object.entries(m["sections"]).map(([k, v]) => `${k}: ${j(v)}`).join("; ") : m["biostatistics"] ? j(m["biostatistics"].topics) : "";
    c.push({ id: `${name}-info`, source: src, kind: "academic", keys, text: `${name}${m["english"] ? ` (${m["english"]})` : m["full_name"] ? ` (${m["full_name"]})` : ""}: ${String(m["type"]).replace(/_/g, " ")} module${m["semester"] ? `, ${m["semester"]}` : ""}, coefficient ${m["coefficient"]}.${m["number_of_courses"] ? ` ${m["number_of_courses"]} courses.` : ""}${m["number_of_TD"] ? ` ${m["number_of_TD"]} TD.` : ""}${topics ? ` Topics: ${topics}.` : ""}${m["status"] ? ` ${m["status"]}` : ""}` });
    const teachers = [...(m["teachers"] ?? []), ...(m["teacher"] ? [m["teacher"]] : []), ...(m["biostatistics"]?.teacher ? [m["biostatistics"].teacher] : [])];
    const exp: string[] = [];
    if (teachers.length) exp.push(`Teachers: ${teachers.map((t: any) => `${t.name}${t.notes ? ` — ${t.notes}` : ""}`).join(" ")}`);
    const method = m["study_method"] ?? m["biostatistics"]?.study_method;
    if (method) exp.push(`Study method: ${j(method)}.`);
    if (m["resources"]) exp.push(`Resources: ${j(m["resources"])}.`);
    if (m["exam"]) exp.push(`Exam (reported): ${Object.entries(m["exam"]).map(([k, v]) => `${k.replace(/_/g, " ")} ${j(v)}`).join("; ")}.`);
    if (m["second_semester_exam_structure_reported"]) exp.push(`S2 exam structure (reported): ${Object.entries(m["second_semester_exam_structure_reported"]).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(", ")}.`);
    if (m["biostatistics"]?.high_frequency_topics_reported) exp.push(`Reported high-frequency topics: ${j(m["biostatistics"].high_frequency_topics_reported)}.`);
    if (m["assessment_notes"]) exp.push(m["assessment_notes"]);
    if (exp.length) c.push({ id: `${name}-exp`, source: src, kind: "student_experience", keys: [...keys, ...teachers.map((t: any) => t.name.toLowerCase().replace(/^(pr|mme)\s+/, "")), "prof", "pr ", "teacher", "أستاذ", "exam", "examen", "امتحان", "study", "réviser", "method", "كيفاش نقرا", "resource", "eliminat", "éliminat", "5/20"], text: exp.join(" ") });
  }
  return c;
}

export const CHUNKS = build();

const norm = (s: string) => ` ${s.toLowerCase()} `;

export function retrieveKb(query: string, limit = 4) {
  const q = norm(query);
  const ufasCue = UFAS.some((w) => q.includes(w));
  const scored = CHUNKS.map((ch) => ({ ch, s: ch.keys.reduce((n, k) => n + (q.includes(k) ? (k.length > 5 ? 2 : 1) : 0), 0) }))
    .filter((x) => x.s > 0 && (ufasCue || x.s >= 2))
    .sort((a, b) => b.s - a.s || (a.ch.kind === "academic" ? -1 : 1));
  return { ufasCue, chunks: scored.slice(0, limit).map((x) => x.ch) };
}

export const KB_RULES = kb.ai_retrieval_rules;
