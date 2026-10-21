export type ExamSubject = { id: string; name: string; department: string; academic_year: number };
export type ExamUnit = { id: string; name: string; subject_id: string };
export type ExamScope = { subject_id: string; unit_id: string | null };
export type ExamScopeOption = ExamScope & { value: string; name: string; department: string; academic_year: number };

export const examScopeValue = (scope: ExamScope) => scope.unit_id ? `${scope.subject_id}:${scope.unit_id}` : scope.subject_id;

/** A module remains linked to its existing parent subject; no synthetic subjects. */
export function examScopeOptions(subjects: ExamSubject[], units: ExamUnit[]): ExamScopeOption[] {
  return subjects.filter((s) => !/deprecated/i.test(s.name)).flatMap((s) => {
    const children = units.filter((u) => u.subject_id === s.id);
    const parent = { subject_id: s.id, unit_id: null, value: s.id, name: s.name, department: s.department, academic_year: s.academic_year };
    const modules = children.filter((u) => u.name.trim().toLocaleLowerCase() !== s.name.trim().toLocaleLowerCase()).map((u) => ({ ...parent, unit_id: u.id, value: `${s.id}:${u.id}`, name: `${u.name} · ${s.name}` }));
    return [parent, ...modules];
  });
}

export function validateExamScope(subject: ExamSubject | null, unit: ExamUnit | null, scope: ExamScope) {
  if (!subject || subject.id !== scope.subject_id || /deprecated/i.test(subject.name)) throw new Error("Choose a valid curriculum subject.");
  if (scope.unit_id && (!unit || unit.id !== scope.unit_id || unit.subject_id !== subject.id)) throw new Error("The selected module does not belong to this subject.");
}

export function examScopeName(subjectName: string, unitName?: string) {
  return unitName && unitName !== subjectName ? `${unitName} · ${subjectName}` : subjectName;
}