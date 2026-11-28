import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createContext, useContext } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ScopePicker } from "@/components/app/ScopePicker";

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

export type Subject = { id: string; name: string; faculty: string; department: string; academic_year: number; position: number };
export type Unit = { id: string; subject_id: string; name: string; semester: string; position: number };
export type Lesson = { id: string; unit_id: string; name: string; position: number };

export function useHierarchy() {
  return useQuery({
    queryKey: ["hierarchy"],
    queryFn: async () => {
      const [s, u, l] = await Promise.all([
        supabase.from("subjects").select("id,name,faculty,department,academic_year,position").order("department").order("academic_year").order("position").order("name"),
        supabase.from("units").select("id,subject_id,name,semester,position").eq("legacy_container", false).order("position").order("created_at"),
        supabase.from("lessons").select("id,unit_id,name,position").order("position").order("created_at"),
      ]);
      if (s.error || u.error || l.error) throw new Error(s.error?.message ?? u.error?.message ?? l.error?.message ?? "Could not load curriculum.");
      return { subjects: (s.data ?? []) as Subject[], units: (u.data ?? []) as Unit[], lessons: (l.data ?? []) as Lesson[] };
    },
  });
}

export function LessonPicker({ value, onChange, allowUnitOnly, department, year }: { value: { s: string; u: string; l: string }; onChange: (v: { s: string; u: string; l: string }) => void; allowUnitOnly?: boolean; department?: string | undefined; year?: number | undefined }) {
  const { data } = useHierarchy();
  if (!data) return null;
  const tree = data.subjects.filter(s => (!department || s.department === department) && (!year || s.academic_year === year)).map(s => ({ ...s, emds: [], units: data.units.filter(u => u.subject_id === s.id).map(u => ({ ...u, lessons: data.lessons.filter(l => l.unit_id === u.id).map(l => ({ ...l, files: [] })) })) }));
  return <ScopePicker tree={tree} value={{ ...value, f: '' }} onChange={v => onChange({ s: v.s, u: v.u, l: v.l })} fileLevel={false}/>;
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
