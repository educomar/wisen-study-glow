import { translate, useLang } from '@/lib/i18n';
import type { CurFile, Tree } from "./Curriculum";

export type Scope = { s: string; u: string; l: string; f: string };
export const emptyScope: Scope = { s: "", u: "", l: "", f: "" };
const sel = "h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary";

/** Resolve the chosen scope into labels + the course files it covers. */
export function resolveScope(tree: Tree | null, sc: Scope) {
  const s = tree?.find((x) => x.id === sc.s);
  const u = s?.units.find((x) => x.id === sc.u);
  const l = u?.lessons.find((x) => x.id === sc.l);
  const all: CurFile[] = (l ? [l] : u ? u.lessons : s ? s.units.flatMap((x) => x.lessons) : []).flatMap((x) => x.files);
  const files = sc.f ? all.filter((f) => f.id === sc.f) : all;
  const label = [s?.name, u?.name, l?.name, sc.f ? files[0]?.file_name : ""].filter(Boolean).join(" → ");
  return { subject: s?.name ?? "", unit: u?.name ?? "", lesson: l?.name ?? "", files, label, emds: s?.emds ?? [] };
}

export function ScopePicker({ tree, value, onChange, fileLevel = true, lessonLevel = true, formatLabel = (label: string) => label }: { tree: Tree | null; value: Scope; onChange: (v: Scope) => void; fileLevel?: boolean; lessonLevel?: boolean; formatLabel?: (label: string) => string }) {
  useLang();
  const s = tree?.find((x) => x.id === value.s);
  const u = s?.units.find((x) => x.id === value.u);
  const l = u?.lessons.find((x) => x.id === value.l);
  const files = (l ? [l] : u ? u.lessons : []).flatMap((x) => x.files);
  return (
    <div className="flex flex-wrap gap-2">
      <select aria-label={translate("Subject")} className={sel} value={value.s} onChange={(e) => onChange({ ...emptyScope, s: e.target.value })}>
        <option value="">{translate("Choose subject…")}</option>{tree?.map((x) => <option key={x.id} value={x.id}>{formatLabel(x.name)}</option>)}
      </select>
      {s && <select aria-label={translate("Unit")} className={sel} value={value.u} onChange={(e) => onChange({ ...value, u: e.target.value, l: "", f: "" })}>
        <option value="">{translate("Entire subject")}</option>{s.units.map((x) => <option key={x.id} value={x.id}>{formatLabel(x.name)}</option>)}
      </select>}
      {lessonLevel && u && <select aria-label={translate("Chapter / lesson")} className={sel} value={value.l} onChange={(e) => onChange({ ...value, l: e.target.value, f: "" })}>
        <option value="">{translate("Whole unit")}</option>{u.lessons.map((x) => <option key={x.id} value={x.id}>{formatLabel(x.name)}</option>)}
      </select>}
      {fileLevel && u && files.length > 0 && <select aria-label={translate("File")} className={`${sel} max-w-56`} value={value.f} onChange={(e) => onChange({ ...value, f: e.target.value })}>
        <option value="">{translate("All files")}</option>{files.map((x) => <option key={x.id} value={x.id}>{formatLabel(x.file_name)}</option>)}
      </select>}
    </div>
  );
}
