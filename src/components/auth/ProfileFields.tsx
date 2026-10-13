import { translate, useLang } from '@/lib/i18n';
import { FACULTIES, ordinal, YEARS, type Department, type Exam } from "@/lib/profile";

export type Fields = { faculty: string; department: Department; academic_year: number; current_target_exam: Exam };
export const DEFAULTS: Fields = { faculty: FACULTIES[0]!, department: "Medicine", academic_year: 1, current_target_exam: "EMD1" };

const chip = (on: boolean) => `rounded-md border px-3 py-2 text-sm transition ${on ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/60"}`;

export function ProfileFields({ v, onChange, locked = false }: { v: Fields; onChange: (v: Fields) => void; locked?: boolean }) {
  useLang();
  if (locked) return (
    <div className="space-y-5">
      <div><span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{translate("Enrolled level")}</span>
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">{v.faculty} · {v.department}  {translate("Department ·")} {ordinal(v.academic_year)}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">{translate("Your department and academic year are fixed once you enrol.")}</p></div>
      <div>
        <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{translate("Currently preparing for")}</span>
        <div className="grid grid-cols-2 gap-2">
          {(["EMD1", "EMD2"] as Exam[]).map((x) => <button type="button" key={x} className={chip(v.current_target_exam === x)} onClick={() => onChange({ ...v, current_target_exam: x })}>{translate(x)}</button>)}
        </div>
      </div>
    </div>
  );
  return (
    <div className="space-y-5">
      <label className="block">
        <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{translate("Faculty")}</span>
        <select value={v.faculty} onChange={(e) => onChange({ ...v, faculty: e.target.value })} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
          {FACULTIES.map((f) => <option key={f}>{f}</option>)}
        </select>
      </label>
      <div>
        <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{translate("Department")}</span>
        <div className="grid grid-cols-2 gap-2">
          {(["Medicine", "Dentistry"] as Department[]).map((d) => (
            <button type="button" key={d} className={chip(v.department === d)} onClick={() => onChange({ ...v, department: d, academic_year: Math.min(v.academic_year, YEARS[d]) })}>{translate(d)}  {translate("Department")}</button>
          ))}
        </div>
      </div>
      <div>
        <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{translate("Academic year")}</span>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: YEARS[v.department] }, (_, i) => i + 1).map((y) => (
            <button type="button" key={y} className={chip(v.academic_year === y)} onClick={() => onChange({ ...v, academic_year: y })}>{ordinal(y)}</button>
          ))}
        </div>
      </div>
      <div>
        <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{translate("Currently preparing for")}</span>
        <div className="grid grid-cols-2 gap-2">
          {(["EMD1", "EMD2"] as Exam[]).map((x) => <button type="button" key={x} className={chip(v.current_target_exam === x)} onClick={() => onChange({ ...v, current_target_exam: x })}>{translate(x)}</button>)}
        </div>
      </div>
    </div>
  );
}
