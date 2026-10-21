import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { examScopeName, examScopeOptions, validateExamScope } from "./exam-scope";

const subjects = [
  { id: "y1", name: "Anatomy", department: "Medicine", academic_year: 1 },
  ...["Appareil Cardiovasculaire et Respiratoire", "Système Digestif", "Appareil Urinaire et Génital Masculin", "Système Endocrinien et Génital Féminin", "Système Nerveux", "Immunologie", "Génétique"].map((name, i) => ({ id: `y2-${i}`, name, department: "Medicine", academic_year: 2 })),
  { id: "y3", name: "Les Modules", department: "Medicine", academic_year: 3 },
  { id: "old", name: "Cours (Deprecated — see module subjects)", department: "Medicine", academic_year: 2 },
];
const units = [{ id: "pharma", name: "Pharmacologie", subject_id: "y3" }, { id: "same", name: "Immunologie", subject_id: "y2-5" }];
describe("Past EMD academic scopes", () => {
  it("keeps Year 1 subjects available without a lesson", () => {
    const y1 = examScopeOptions(subjects, units).find((s) => s.subject_id === "y1");
    assert.equal(y1?.academic_year, 1); assert.equal(y1?.unit_id, null);
  });
  it("offers all seven Year 2 Medicine subjects without duplicate same-name modules", () => {
    const options = examScopeOptions(subjects, units).filter((s) => s.academic_year === 2);
    assert.deepEqual(options.map((s) => s.name), subjects.filter((s) => s.academic_year === 2 && s.id !== "old").map((s) => s.name));
    assert.equal(options.every((s) => s.unit_id === null), true);
  });
  it("selects a Year 3 module using its existing parent subject and unit", () => {
    const y3 = examScopeOptions(subjects, units).find((s) => s.unit_id === "pharma");
    assert.equal(y3?.subject_id, "y3"); assert.equal(y3?.academic_year, 3);
    assert.doesNotThrow(() => validateExamScope(subjects.find((s) => s.id === "y3") ?? null, units[0] ?? null, { subject_id: "y3", unit_id: "pharma" }));
  });
  it("rejects a module belonging to another academic subject/year", () => {
    assert.throws(() => validateExamScope(subjects[0] ?? null, units[0] ?? null, { subject_id: "y1", unit_id: "pharma" }), /does not belong/);
  });
  it("rejects deprecated or missing subjects", () => {
    assert.throws(() => validateExamScope(subjects.find((s) => s.id === "old") ?? null, null, { subject_id: "old", unit_id: null }));
    assert.throws(() => validateExamScope(null, null, { subject_id: "missing", unit_id: null }));
  });
  it("retains parent/module identity in student exam names", () => {
    assert.equal(examScopeName("Les Modules", "Pharmacologie"), "Pharmacologie · Les Modules");
    assert.equal(examScopeName("Immunologie", "Immunologie"), "Immunologie");
  });
});