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
