export type AcademicSemester = '' | 'S1' | 'S2';
export function semesterBased(year: number) { return year === 1; }
export function validateSemester(year: number, semester: string) {
  if (!['', 'S1', 'S2'].includes(semester)) throw new Error('Choose S1 or S2.');
  if (semester && !semesterBased(year)) throw new Error('Semesters are available in Year 1 only.');
}
export function academicRoles(year: number) {
  return semesterBased(year) ? { parent: 'Subject', branch: 'Semester' } : { parent: 'Integrated unit', branch: 'Subject' };
}
