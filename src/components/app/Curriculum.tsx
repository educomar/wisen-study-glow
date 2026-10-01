import { ChevronRight, FileText, Library, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type CurFile = { id: string; file_name: string; subject: string; unit: string; lesson: string };
type Tree = { id: string; name: string; units: { id: string; name: string; lessons: { id: string; name: string; files: CurFile[] }[] }[] }[];

/** Subject → Unit → Lesson → File browser, scoped to the student's profile by RLS. */
export function useCurriculum() {
  const [tree, setTree] = useState<Tree | null>(null);
  const [signedIn, setSignedIn] = useState(true);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setSignedIn(false); setTree([]); return; }
      const [s, un, l, r] = await Promise.all([
        supabase.from("subjects").select("id,name,position").order("position"),
        supabase.from("units").select("id,subject_id,name,position").order("position"),
        supabase.from("lessons").select("id,unit_id,name,position").order("position"),
        supabase.from("lesson_resources").select("id,unit_id,lesson_id,file_name,mime_type").order("drive_created_at", { ascending: true, nullsFirst: false }).order("created_at"),
      ]);
      setTree((s.data ?? []).map((sub) => ({
        id: sub.id, name: sub.name,
        units: (un.data ?? []).filter((x) => x.subject_id === sub.id).map((unit) => ({
          id: unit.id, name: unit.name,
          lessons: (l.data ?? []).filter((x) => x.unit_id === unit.id).map((les) => ({
            id: les.id, name: les.name,
            files: (r.data ?? []).filter((f) => f.lesson_id === les.id).map((f) => ({ id: f.id, file_name: f.file_name, subject: sub.name, unit: unit.name, lesson: les.name })),
          })),
        })),
      })));
    })();
  }, []);
  return { tree, signedIn };
}

export async function fetchCurriculumFile(f: CurFile): Promise<File> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`/api/curriculum-file/${f.id}`, { headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
  if (!res.ok) throw new Error(String(res.status));
  const name = f.file_name.toLowerCase().endsWith(".pdf") ? f.file_name : `${f.file_name}.pdf`;
  return new File([await res.blob()], name, { type: "application/pdf" });
}

export function CurriculumBrowser({ tree, signedIn, activeTitle, onOpen }: { tree: Tree | null; signedIn: boolean; activeTitle: string; onOpen: (f: CurFile) => void }) {
  const [sub, setSub] = useState<string | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  if (!tree) return <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading your courses…</p>;
  if (!signedIn) return <p className="p-4 text-sm text-muted-foreground">Sign in to browse your faculty courses.</p>;
  if (!tree.length) return <p className="p-4 text-sm text-muted-foreground">No courses yet for your year.</p>;
  const s = tree.find((x) => x.id === sub);
  const u = s?.units.find((x) => x.id === unit);
  const crumb = "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground";
  const row = "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent";
  return (
    <div className="space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-1 px-1">
        <button className={crumb} onClick={() => { setSub(null); setUnit(null); }}><Library className="size-3.5" /> Courses</button>
        {s && <><ChevronRight className="size-3 text-muted-foreground" /><button className={crumb} onClick={() => setUnit(null)}>{s.name}</button></>}
        {u && <><ChevronRight className="size-3 text-muted-foreground" /><span className="text-xs">{u.name}</span></>}
      </div>
      {!s && tree.map((x) => <button key={x.id} className={row} onClick={() => setSub(x.id)}><span>{x.name}</span><span className="font-mono text-[10px] text-muted-foreground">{x.units.length} units <ChevronRight className="inline size-3" /></span></button>)}
      {s && !u && s.units.map((x) => <button key={x.id} className={row} onClick={() => setUnit(x.id)}><span>{x.name}</span><span className="font-mono text-[10px] text-muted-foreground">{x.lessons.length} lessons <ChevronRight className="inline size-3" /></span></button>)}
      {u && u.lessons.map((les) => (
        <div key={les.id} className="rounded-md border border-border p-2">
          <p className="px-1 text-sm font-medium">{les.name}</p>
          {les.files.length ? les.files.map((f) => (
            <button key={f.id} onClick={() => onOpen(f)} className={`mt-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent ${activeTitle === f.file_name.replace(/\.pdf$/i, "") ? "bg-primary/10 text-primary" : ""}`}>
              <FileText className="size-3.5 shrink-0 text-primary" /><span className="truncate">{f.file_name}</span>
            </button>
          )) : <p className="px-1 text-xs text-muted-foreground">No file yet</p>}
        </div>
      ))}
    </div>
  );
}
