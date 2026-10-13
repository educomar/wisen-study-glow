import { test } from "node:test";
import assert from "node:assert/strict";
import { emdYear, scoreOn20, toggleOption } from "./emd-exam";

test("score is out of 20 and all-or-nothing", () => {
  const r = scoreOn20([{ answer: 5, picked: 5 }, { answer: 5, picked: 1 }, { answer: 2, picked: null }, { answer: 0, picked: 0 }]);
  assert.equal(r.correct, 2); assert.equal(r.on20, 10); assert.equal(r.accuracy, 50);
});
test("academic year from name or date", () => {
  assert.equal(emdYear("EMD1 Anatomie 2022-2023.pdf"), "2022-2023");
  assert.equal(emdYear("emd 2021_22.pdf"), "2021-2022");
  assert.equal(emdYear("emd.pdf", "2019-05-02T00:00:00Z"), "2019");
  assert.equal(emdYear("emd.pdf"), "Undated");
});
test("multi-answer toggles as bitmask, single replaces", () => {
  assert.equal(toggleOption(toggleOption(null, 0, true), 2, true), 5);
  assert.equal(toggleOption(5, 0, true), 4);
  assert.equal(toggleOption(1, 3, false), 3);
});
import { scoreWith, questionCredit } from "./emd-exam";
const ABC = 0b111;
test("all-or-nothing: A+B 0, A+B+C full, A+B+C+D 0", () => {
  assert.equal(questionCredit({ answer: ABC, picked: 0b011, multi: true }, "aon"), 0);
  assert.equal(questionCredit({ answer: ABC, picked: ABC, multi: true }, "aon"), 1);
  assert.equal(questionCredit({ answer: ABC, picked: 0b1111, multi: true }, "aon"), 0);
});
test("partial: A+B 2/3, any wrong 0", () => {
  assert.equal(Math.floor(questionCredit({ answer: ABC, picked: 0b011, multi: true }, "partial") * 100), 66);
  assert.equal(questionCredit({ answer: ABC, picked: 0b1111, multi: true }, "partial"), 0);
});
test("positive partial: A+B+D 1/3", () => {
  assert.equal(Math.floor(questionCredit({ answer: ABC, picked: 0b1011, multi: true }, "positive") * 100), 33);
  assert.equal(scoreWith([{ answer: ABC, picked: ABC, multi: true }, { answer: ABC, picked: null, multi: true }], "positive"), 10);
});
test("barème dégressif: 0/1/2/3 errors → 1/0.5/0.2/0", () => {
  assert.equal(questionCredit({ answer: ABC, picked: ABC, multi: true }, "degressive"), 1);
  assert.equal(questionCredit({ answer: ABC, picked: 0b011, multi: true }, "degressive"), 0.5);
  assert.equal(questionCredit({ answer: ABC, picked: 0b1011, multi: true }, "degressive"), 0.2);
  assert.equal(questionCredit({ answer: ABC, picked: 0b11001, multi: true }, "degressive"), 0);
  assert.equal(questionCredit({ answer: 2, picked: 1 }, "degressive"), 0);
});
test("negative marking: 0.2 per hit, -0.25 per wrong, floor 0", () => {
  assert.equal(Math.round(questionCredit({ answer: ABC, picked: 0b1011, multi: true }, "negative") * 100), 15);
  assert.equal(questionCredit({ answer: ABC, picked: 0b11001, multi: true }, "negative"), 0);
});
