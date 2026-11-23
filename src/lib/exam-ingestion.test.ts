import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyEnrichment, markAllQuestionsVerified, parseExamJson, questionDraftSchema, TRAP_PHRASES, uniqueQuestions, validateSemester } from "./exam-ingestion";
import { validateExamFile } from "./exam-files";
import { linkJsonLessons, scopeJsonPapers } from "./exam-json-scope";

const make = () => questionDraftSchema.parse({ stem: "Choose the correct propositions", options: ["A", "B", "C"], answers: [0, 2], answer_source: "official" });
describe("central exam ingestion", () => {
  it("never replaces an official AC correction with AI answers", () => {
    const q = applyEnrichment(make(), { answers: [1], stem: "changed", option_comments: ["Correct", "Incorrect", "Correct"] }, new Set());
    assert.deepEqual(q.answers, [0, 2]); assert.equal(q.stem, "Choose the correct propositions"); assert.equal(q.answer_source, "official");
  });
  it("labels an AI-filled missing correction as AI answer, never official", () => {
    const q = applyEnrichment({ ...make(), answers: [], answer_source: "missing" }, { answers: [0] }, new Set());
    assert.deepEqual(q.answers, [0]); assert.equal(q.answer_source, "generated"); assert.equal(q.source_data?.["AIAnswer"], "A");
  });
  it("permits multiple real lessons but removes invented IDs", () => {
    const a = "11111111-1111-4111-8111-111111111111", b = "22222222-2222-4222-8222-222222222222", c = "33333333-3333-4333-8333-333333333333";
    assert.deepEqual(applyEnrichment(make(), { lesson_ids: [a, b, c] }, new Set([a, b])).lesson_ids, [a, b]);
  });
  it("rejects S1/S2 for second-year annual Medicine", () => { assert.throws(() => validateSemester(2, "S1")); assert.throws(() => validateSemester(2, "S2")); assert.doesNotThrow(() => validateSemester(2, "")); assert.doesNotThrow(() => validateSemester(1, "S2")); });
  it("retains separate subjects and calendar years in mixed JSON archives", () => {
    const parsed = parseExamJson(JSON.stringify({ papers: [{ title: "Anatomy 2015", exam_year: "2015", questions: [make()] }, { title: "Biophysics 2020", exam_year: "2020", questions: [make()] }] }));
    assert.deepEqual(parsed.papers.map((p) => [p.title, p.exam_year]), [["Anatomy 2015", "2015"], ["Biophysics 2020", "2020"]]);
  });
  it("marks every question verified in one action, including missing keys and warnings", () => {
    const questions = [make(), questionDraftSchema.parse({ ...make(), answers: [], answer_source: "missing" }), questionDraftSchema.parse({ ...make(), review_note: "Requires diagram" })];
    const result = markAllQuestionsVerified(questions);
    assert.deepEqual(result.map((q) => q.verified), [true, true, true]);
    result.forEach((q) => assert.equal(questionDraftSchema.safeParse(q).success, true));
    assert.deepEqual(result.map((q) => ({ ...q, verified: false })), questions);
    assert.equal(questions.every((q) => !q.verified), true);
  });
  it("keeps exact Darija trap phrases and rejects rewritten warnings", () => {
    assert.deepEqual(TRAP_PHRASES, ["رد بالك تتخدع", "رد بالك تطيح في الفخ", "هنا وين يغلطو الطلبة", "غلطة تافهة بزاااف حذاري", "ركز مليح متتخدعش"]);
    assert.equal(questionDraftSchema.safeParse({ ...make(), trap_phrase: "Be careful" }).success, false);
  });
  it("enforces single-choice QCS and valid option indices", () => { assert.equal(questionDraftSchema.safeParse({ ...make(), format: "QCS" }).success, false); assert.equal(questionDraftSchema.safeParse({ ...make(), answers: [4] }).success, false); });
  it("deduplicates repeated question content", () => { assert.equal(uniqueQuestions([make(), { ...make(), stem: "  Choose the correct propositions  " }]).length, 1); });
  it("accepts supported uploads and enforces 50 MB", () => { for (const name of ["exam.pdf", "exam.docx", "exam.pptx", "exam.potx", "exam.json"]) assert.doesNotThrow(() => validateExamFile({ name, size: 50 * 1024 * 1024 })); assert.throws(() => validateExamFile({ name: "exam.pdf", size: 50 * 1024 * 1024 + 1 })); assert.throws(() => validateExamFile({ name: "exam.doc", size: 500 })); });
  const source = { QuestionNumber: 7, QuestionText: "  Exact question\n", Options: { A: " First ", B: "Second", C: "Third", D: "Fourth", E: "Last" }, OfficialAnswer: "BD/B", AIAnswer: "C", Lesson: "11. The Knee Joint", OptionExplanations: { A: { Correct: false, Explanation: " Exact comment " } } };
  const archive = (q = source) => JSON.stringify({ Faculty: "Setif", Level: "First Year Medicine", Subjects: [{ Subject: "Anatomy", Year: "2022/2023", Questions: [q, q] }] });
  it("preserves every source field, whitespace and repeated questions", () => {
    const paper = parseExamJson(archive()).papers[0]; assert.ok(paper);
    assert.equal(paper.questions.length, 2); assert.equal(paper.questions[0]?.stem, "  Exact question\n");
    assert.equal(paper.questions[0]?.options[0], " First "); assert.equal(paper.questions[0]?.option_comments[0], " Exact comment ");
    assert.deepEqual(paper.questions[0]?.source_data, source); assert.deepEqual(paper.source_metadata, { Faculty: "Setif", Level: "First Year Medicine", Subject: "Anatomy", Year: "2022/2023" });
  });
  it("preserves BD/B as two separate official variants, never a merged answer", () => {
    const q = parseExamJson(archive()).papers[0]?.questions[0]; assert.ok(q);
    assert.deepEqual(q.answers, [1, 3]); assert.deepEqual(q.answer_variants, [[1, 3], [1]]); assert.equal(q.source_data?.["OfficialAnswer"], "BD/B");
  });
  it("rejects changed imported official answers or comments when saving", () => {
    const q = parseExamJson(archive()).papers[0]?.questions[0]; assert.ok(q);
    assert.equal(questionDraftSchema.safeParse({ ...q, answers: [2] }).success, false);
    assert.equal(questionDraftSchema.safeParse({ ...q, option_comments: ["rewritten"] }).success, false);
  });
  it("retains an empty source stem without inventing a question", () => {
    assert.equal(parseExamJson(archive({ ...source, QuestionText: "" })).papers[0]?.questions[0]?.stem, "");
  });
  it("uses supplied AIAnswer only when OfficialAnswer is unavailable", () => {
    const q = parseExamJson(archive({ ...source, OfficialAnswer: "Not available", AIAnswer: "AE" })).papers[0]?.questions[0]; assert.ok(q);
    assert.equal(q.answer_source, "generated"); assert.deepEqual(q.answers, [0, 4]); assert.equal(q.source_data?.["OfficialAnswer"], "Not available");
  });
  it("requires selected S1/S2 and rejects mismatched enrolled year or subject", () => {
    const ps = parseExamJson(archive()).papers; const subject = { id: "11111111-1111-4111-8111-111111111111", name: "Anatomy", academic_year: 1 };
    assert.throws(() => scopeJsonPapers(ps, subject, "", null));
    assert.equal(scopeJsonPapers(ps, subject, "S1", null)[0]?.semester, "S1");
    assert.throws(() => scopeJsonPapers(ps, { ...subject, academic_year: 2 }, "", null));
    assert.throws(() => scopeJsonPapers(ps, { ...subject, name: "Biochemistry" }, "S1", null));
  });
  it("links numbered source lessons without changing source prose during enrichment", () => {
    const q = parseExamJson(archive()).papers[0]?.questions[0]; assert.ok(q);
    const id = "11111111-1111-4111-8111-111111111111";
    const linked = linkJsonLessons([q], [{ id, name: "The Knee Joint" }], "Anatomy")[0]; assert.ok(linked);
    assert.deepEqual(linked.lesson_ids, [id]);
    const enriched = applyEnrichment(linked, { stem: "changed", answers: [2], explanation: "changed", option_comments: ["changed"], lesson_ids: [id] }, new Set([id]));
    assert.deepEqual({ ...enriched, verified: q.verified, lesson_ids: [] }, q);
  });
  it("links existing oogenesis parts and reordered TD labels without new lessons", () => {
    const q = parseExamJson(archive()).papers[0]?.questions[0]; assert.ok(q);
    const id = "11111111-1111-4111-8111-111111111111";
    assert.deepEqual(linkJsonLessons([{ ...q, source_data: { ...q.source_data, Lesson: "10. Oogenesis" } }], [{ id, name: "Oogenesis (Parts 1 & 2)" }], "Embryology")[0]?.lesson_ids, [id]);
    assert.deepEqual(linkJsonLessons([{ ...q, source_data: { ...q.source_data, Lesson: "8. Microscopy & Cell Measurement TD 1" } }], [{ id, name: "Cytology Practical TD 1 — Microscopy & Cell Measurement" }], "Cytology")[0]?.lesson_ids, [id]);
  });
});
import { applyEnrichment as __apply, questionDraftSchema as __q } from "./exam-ingestion";
import { test as __test } from "node:test";
import __assert from "node:assert/strict";
__test("AI answer never replaces an official key, but fills a missing one", () => {
  const base = __q.parse({ stem: "S", options: ["a", "b", "c"], answers: [0], answer_source: "official" });
  const kept = __apply(base, { answers: [1, 2] }, new Set());
  __assert.deepEqual(kept.answers, [0]); __assert.equal(kept.answer_source, "official"); __assert.equal(kept.source_data?.["AIAnswer"], "BC");
  const filled = __apply(__q.parse({ ...base, answers: [], answer_source: "missing" }), { answers: [2] }, new Set());
  __assert.deepEqual(filled.answers, [2]); __assert.equal(filled.answer_source, "generated");
});
