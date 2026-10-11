import { test } from "node:test";
import assert from "node:assert/strict";

import { draftIssue, parseQuestionJson } from "./qbank-import";

test("accepts correct as an array of indices (QCM)", () => {
  const r = parseQuestionJson(JSON.stringify([{ stem: "S", options: ["a", "b", "c", "d", "e"], correct: [0, 2] }]));
  assert.deepEqual(r.questions[0]!.answers, [0, 2]);
});

test("accepts single answer index or letter (QCU)", () => {
  const r = parseQuestionJson(JSON.stringify([{ stem: "S", options: ["a", "b"], answer: 1 }, { stem: "T", options: ["a", "b", "c"], answer: "C" }]));
  assert.deepEqual(r.questions.map((q) => q.answers), [[1], [2]]);
});

test("rejects more than 5 options and out-of-range answers", () => {
  const r = parseQuestionJson(JSON.stringify([{ stem: "S", options: ["1", "2", "3", "4", "5", "6"], answer: 0 }, { stem: "T", options: ["a", "b"], answer: 4 }]));
  assert.equal(r.questions.length, 0);
  assert.equal(r.errors.length, 2);
});

test("draft without a correct option cannot be saved", () => {
  assert.equal(draftIssue({ stem: "S", options: ["a", "b"], answers: [], explanation: "", difficulty: "Medium" }), "Pick a correct option");
});
