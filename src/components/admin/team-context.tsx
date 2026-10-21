import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createContext, useContext } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

export type Team = { userId: string; email: string; role: "admin" | "editor"; status: string };
export const TeamCtx = createContext<Team | null>(null);
export const useTeam = () => useContext(TeamCtx)!;

export const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary";
export const inp = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary";
export const area = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary";

/** Wrap a server fn call with toast + cache invalidation. */
export function useAction() {
  const qc = useQueryClient();
  return async <T,>(p: Promise<T>, ok?: string): Promise<T | undefined> => {
    try {
      const r = await p;
      if (ok) toast.success(ok);
      await qc.invalidateQueries();
      return r;
    } catch (e) {
      toast.error((e as Error).message.replace(/^Forbidden: /, "") || "Something went wrong");
      return undefined;
    }
  };
}
export { useServerFn };

export type Subject = { id: string; name: string; faculty: string; department: string; academic_year: number };
export type Unit = { id: string; subject_id: string; name: string };
export type Lesson = { id: string; unit_id: string; name: string };

export function useHierarchy() {
  return useQuery({
    queryKey: ["hierarchy"],
    queryFn: async () => {
      const [s, u, l] = await Promise.all([
        supabase.from("subjects").select("id,name,faculty,department,academic_year").order("department").order("academic_year").order("position").order("name"),
        supabase.from("units").select("id,subject_id,name").order("position").order("created_at"),
        supabase.from("lessons").select("id,unit_id,name").order("position").order("created_at"),
      ]);
      if (s.error || u.error || l.error) throw new Error(s.error?.message ?? u.error?.message ?? l.error?.message ?? "Could not load curriculum.");
      return { subjects: (s.data ?? []) as Subject[], units: (u.data ?? []) as Unit[], lessons: (l.data ?? []) as Lesson[] };
    },
  });
}

export function LessonPicker({ value, onChange, allowUnitOnly, department, year }: { value: { s: string; u: string; l: string }; onChange: (v: { s: string; u: string; l: string }) => void; allowUnitOnly?: boolean; department?: string | undefined; year?: number | undefined }) {
  const { data } = useHierarchy();
  if (!data) return null;
  const units = data.units.filter((u) => u.subject_id === value.s);
  const lessons = data.lessons.filter((l) => l.unit_id === value.u);
  return (
    <div className="flex flex-wrap gap-2">
      <select className={sel} value={value.s} onChange={(e) => onChange({ s: e.target.value, u: "", l: "" })}>
        <option value="">Subject…</option>
        {data.subjects.filter((s) => (!department || s.department === department) && (!year || s.academic_year === year)).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.department} Y{s.academic_year}</option>)}
      </select>
      <select className={sel} value={value.u} disabled={!value.s} onChange={(e) => onChange({ ...value, u: e.target.value, l: "" })}>
        <option value="">Unit…</option>
        {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <select className={sel} value={value.l} disabled={!value.u} onChange={(e) => onChange({ ...value, l: e.target.value })}>
        <option value="">{allowUnitOnly ? "Whole unit" : "Lesson…"}</option>
        {lessons.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      {data.subjects.length === 0 && <span className="self-center text-xs text-muted-foreground">Create a subject first in Subjects.</span>}
    </div>
  );
}

export function PageHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-serif text-3xl">{title}</h1>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const t = useTeam();
  if (t.role !== "admin") return <p className="text-sm text-muted-foreground">This section is for Admins only.</p>;
  return <>{children}</>;
}
