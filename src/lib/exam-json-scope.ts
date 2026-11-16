import aliases from "@/data/academic-name-aliases.json";
import type { ExamDraftQuestion, JsonPaper } from "./exam-ingestion";
import { validateSemester } from "./exam-ingestion";

const normalize = (text: string) => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/^\s*\d+[.)-]?\s*/, "").replace(/[^a-z0-9]+/g, " ").trim();
const lessonKey = (text: string) => normalize(text).replace(/^cytology practical /, "").replace(/\btd\s*(\d+)\b/g, "").replace(/\bparts?\s*\d+(\s*\d+)?\b/g, "").replace(/\s+/g, " ").trim();
export function linkJsonLessons(questions: ExamDraftQuestion[], lessons: { id: string; name: string }[], subjectName: string) {
  return questions.map((q) => {
    const label = q.source_data?.["Lesson"];
    if (typeof label !== "string") return q;
    const names = new Set([normalize(label)]);
    for (const alias of aliases) if (normalize(alias.subject) === normalize(subjectName) && (names.has(normalize(alias.old)) || names.has(normalize(alias.name)))) {
      names.add(normalize(alias.old)); names.add(normalize(alias.name));
    }
    const exact = lessons.filter((l) => names.has(normalize(l.name)));
    const matched = exact.length ? exact : lessons.filter((l) => lessonKey(l.name) === lessonKey(label));
    return { ...q, lesson_ids: matched.length === 1 ? [matched[0]?.id ?? ""].filter(Boolean) : q.lesson_ids };
  });
}
export function scopeJsonPapers(papers: JsonPaper[], subject: { id: string; name: string; academic_year: number }, semester: "" | "S1" | "S2", unitId: string | null) {
  validateSemester(subject.academic_year, semester);
  if (subject.academic_year === 1 && !semester) throw new Error("Choose a semester before uploading.");
  return papers.map((p) => {
    const fileSubject = p.source_metadata?.["Subject"];
    if (typeof fileSubject === "string" && normalize(fileSubject) !== normalize(subject.name)) throw new Error(`File subject ${fileSubject} does not match ${subject.name}.`);
    const fileLevel = p.source_metadata?.["Level"];
    if (fileLevel === "First Year Medicine" && subject.academic_year !== 1) throw new Error("This archive is for First Year Medicine.");
    return { ...p, subject_id: subject.id, unit_id: unitId, semester };
  });
}