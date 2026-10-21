import { describe, expect, it } from "vitest";
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
    expect(examScopeOptions(subjects, units).find((s) => s.subject_id === "y1")).toMatchObject({ academic_year: 1, unit_id: null });
  });
  it("offers all seven Year 2 Medicine subjects without duplicate same-name modules", () => {
    const options = examScopeOptions(subjects, units).filter((s) => s.academic_year === 2);
    expect(options.map((s) => s.name)).toEqual(subjects.filter((s) => s.academic_year === 2 && s.id !== "old").map((s) => s.name));
    expect(options.every((s) => s.unit_id === null)).toBe(true);
  });
  it("selects a Year 3 module using its existing parent subject and unit", () => {
    expect(examScopeOptions(subjects, units).find((s) => s.unit_id === "pharma")).toMatchObject({ subject_id: "y3", unit_id: "pharma", academic_year: 3 });
    expect(() => validateExamScope(subjects.find((s) => s.id === "y3") ?? null, units[0] ?? null, { subject_id: "y3", unit_id: "pharma" })).not.toThrow();
  });
  it("rejects a module belonging to another academic subject/year", () => {
    expect(() => validateExamScope(subjects[0] ?? null, units[0] ?? null, { subject_id: "y1", unit_id: "pharma" })).toThrow("does not belong");
  });
  it("rejects deprecated or missing subjects", () => {
    expect(() => validateExamScope(subjects.find((s) => s.id === "old") ?? null, null, { subject_id: "old", unit_id: null })).toThrow();
    expect(() => validateExamScope(null, null, { subject_id: "missing", unit_id: null })).toThrow();
  });
  it("retains parent/module identity in student exam names", () => {
    expect(examScopeName("Les Modules", "Pharmacologie")).toBe("Pharmacologie · Les Modules");
    expect(examScopeName("Immunologie", "Immunologie")).toBe("Immunologie");
  });
});