import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyEnrichment, parseExamJson, questionDraftSchema, TRAP_PHRASES, uniqueQuestions, validateSemester } from "./exam-ingestion";
import { validateExamFile } from "./exam-files";

const make = () => questionDraftSchema.parse({ stem: "Choose the correct propositions", options: ["A", "B", "C"], answers: [0, 2], answer_source: "official" });
describe("central exam ingestion", () => {
  it("never replaces an official AC correction with AI answers", () => {
    const q = applyEnrichment(make(), { answers: [1], stem: "changed", option_comments: ["Correct", "Incorrect", "Correct"] }, new Set());
    assert.deepEqual(q.answers, [0, 2]); assert.equal(q.stem, "Choose the correct propositions"); assert.equal(q.answer_source, "official");
  });
  it("keeps a missing correction missing instead of solving it", () => {
    const q = applyEnrichment({ ...make(), answers: [], answer_source: "missing" }, { answers: [0] }, new Set());
    assert.deepEqual(q.answers, []); assert.equal(q.answer_source, "missing");
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
  it("blocks verification with a missing official key or image warning", () => {
    assert.equal(questionDraftSchema.safeParse({ ...make(), verified: true, answers: [], answer_source: "missing" }).success, false);
    assert.equal(questionDraftSchema.safeParse({ ...make(), verified: true, review_note: "Requires diagram" }).success, false);
  });
  it("keeps exact Darija trap phrases and rejects rewritten warnings", () => {
    assert.deepEqual(TRAP_PHRASES, ["رد بالك تتخدع", "رد بالك تطيح في الفخ", "هنا وين يغلطو الطلبة", "غلطة تافهة بزاااف حذاري", "ركز مليح متتخدعش"]);
    assert.equal(questionDraftSchema.safeParse({ ...make(), trap_phrase: "Be careful" }).success, false);
  });
  it("enforces single-choice QCS and valid option indices", () => { assert.equal(questionDraftSchema.safeParse({ ...make(), format: "QCS" }).success, false); assert.equal(questionDraftSchema.safeParse({ ...make(), answers: [4] }).success, false); });
  it("deduplicates repeated question content", () => { assert.equal(uniqueQuestions([make(), { ...make(), stem: "  Choose the correct propositions  " }]).length, 1); });
  it("accepts supported uploads and enforces 50 MB", () => { for (const name of ["exam.pdf", "exam.docx", "exam.pptx", "exam.potx", "exam.json"]) assert.doesNotThrow(() => validateExamFile({ name, size: 50 * 1024 * 1024 })); assert.throws(() => validateExamFile({ name: "exam.pdf", size: 50 * 1024 * 1024 + 1 })); assert.throws(() => validateExamFile({ name: "exam.doc", size: 500 })); });
});