import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { examScopeOptions, examScopeValue, type ExamScope } from "@/lib/exam-scope";
import { sel, useHierarchy } from "./team-context";

export function ExamScopePicker({ value, onChange }: { value: ExamScope; onChange: (scope: ExamScope) => void }) {
  const { data: h, error } = useHierarchy();
  const { t } = useLang();
  const selected = h?.subjects.find((s) => s.id === value.subject_id);
  const [department, setDepartment] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const dept = department ?? selected?.department ?? "";
  const level = year ?? selected?.academic_year ?? 0;
  const options = examScopeOptions(h?.subjects ?? [], h?.units ?? []).filter((s) => (!dept || s.department === dept) && (!level || s.academic_year === level));
  const current = examScopeValue(value);
  // Preserve any pre-existing nested selection without rewriting saved exams.
  const legacyUnit = h?.units.find((u) => u.id === value.unit_id && u.subject_id === value.subject_id);
  if (selected && !options.some((s) => s.value === current)) options.push({ ...value, value: current, name: legacyUnit ? `${legacyUnit.name} · ${selected.name}` : selected.name, department: selected.department, academic_year: selected.academic_year });
  return <div className="flex flex-wrap gap-2">
    <label className="min-w-0 text-xs text-muted-foreground">{t("Department")}<select aria-label={t("Department")} className={`${sel} w-full`} value={dept} onChange={(e) => { setDepartment(e.target.value); setYear(0); onChange({ subject_id: "", unit_id: null }); }}><option value="">{t("All departments")}</option>{[...new Set((h?.subjects ?? []).map((s) => s.department))].map((d) => <option key={d}>{d}</option>)}</select></label>
    <label className="min-w-0 text-xs text-muted-foreground">{t("Study year")}<select aria-label={t("Study year")} className={`${sel} w-full`} value={level} onChange={(e) => { setYear(Number(e.target.value)); onChange({ subject_id: "", unit_id: null }); }}><option value={0}>{t("All years")}</option>{[...new Set((h?.subjects ?? []).filter((s) => !dept || s.department === dept).map((s) => s.academic_year))].sort((a, b) => a - b).map((y) => <option key={y} value={y}>{t(`Year ${y}`)}</option>)}</select></label>
    <label className="min-w-0 flex-1 text-xs text-muted-foreground">{t("Subject / Module")}<select aria-label={t("Subject / Module")} className={`${sel} w-full max-w-full`} value={current} disabled={!h} onChange={(e) => { const option = options.find((s) => s.value === e.target.value); onChange(option ? { subject_id: option.subject_id, unit_id: option.unit_id } : { subject_id: "", unit_id: null }); }}><option value="">{t("Choose…")}</option>{options.map((s) => <option key={s.value} value={s.value}>{s.name} · {s.department} Y{s.academic_year}</option>)}</select></label>
    {error && <p className="text-xs text-destructive">{t("Could not load curriculum subjects.")}</p>}
  </div>;
}