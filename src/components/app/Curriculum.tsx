import { translate, useLang } from '@/lib/i18n';
import { ChevronRight, FileText, Library, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { fetchMyLevel, inLevel } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { ScopePicker, emptyScope, type Scope } from "./ScopePicker";

export type CurFile = { id: string; file_name: string; subject: string; unit: string; lesson: string; date?: string | null };
export type Tree = { id: string; name: string; academic_year?: number; emds: CurFile[]; units: { id: string; name: string; semester?: string; lessons: { id: string; name: string; files: CurFile[] }[] }[] }[];

/** Subject → Unit → Lesson → File browser, scoped to the student's profile by RLS. */
export function useCurriculum() {
  const [tree, setTree] = useState<Tree | null>(null);
  const [signedIn, setSignedIn] = useState(true);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setSignedIn(false); setTree([]); return; }
      const [lv, s, un, l, r] = await Promise.all([
        fetchMyLevel(u.user.id),
        supabase.from("subjects").select("id,name,position,faculty,department,academic_year").order("position"),
        supabase.from("units").select("id,subject_id,name,position,semester").eq("legacy_container", false).order("position"),
        supabase.from("lessons").select("id,unit_id,name,position").order("position"),
        supabase.from("lesson_resources").select("id,unit_id,lesson_id,file_name,mime_type,kind,subject_id,drive_created_at").order("drive_created_at", { ascending: true, nullsFirst: false }).order("created_at"),
      ]);
      setTree((s.data ?? []).filter((sub) => inLevel(lv, sub) && !/deprecated/i.test(sub.name)).map((sub) => ({
        id: sub.id, name: sub.name, academic_year: sub.academic_year,
        emds: (r.data ?? []).filter((f) => f.subject_id === sub.id && f.kind === "past_emd").map((f) => ({ id: f.id, file_name: f.file_name, subject: sub.name, unit: "", lesson: "", date: f.drive_created_at })),
        units: (un.data ?? []).filter((x) => x.subject_id === sub.id).map((unit) => ({
          id: unit.id, name: unit.name, semester: unit.semester,
          lessons: (l.data ?? []).filter((x) => x.unit_id === unit.id).map((les) => ({
            id: les.id, name: les.name,
            files: (r.data ?? []).filter((f) => f.lesson_id === les.id && f.kind !== "past_emd").map((f) => ({ id: f.id, file_name: f.file_name, subject: sub.name, unit: unit.name, lesson: les.name })),
          })),
        })),
      })));
    })();
  }, []);
  return { tree, signedIn };
}

export async function fetchCurriculumFile(f: CurFile): Promise<File> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sign in to open course files.");
  const res = await fetch(`/api/curriculum-file/${f.id}`, { headers: { Authorization: `Bearer ${data.session.access_token}` } });
  if (!res.ok) {
    const msg = await res.json().then((j: { error?: string }) => j.error).catch(() => null);
    throw new Error(msg ?? `Could not open file (${res.status})`);
  }
  const type = (res.headers.get("content-type") ?? "application/octet-stream").split(";")[0]!;
  const blob = await res.blob();
  // Some Drive files have no extension or a wrong MIME; detect PDFs by their magic bytes.
  const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const isPdf = type === "application/pdf" || String.fromCharCode(...head) === "%PDF-";
  if (isPdf) return new File([blob], /\.pdf$/i.test(f.file_name) ? f.file_name : `${f.file_name}.pdf`, { type: "application/pdf" });
  const ext = type.includes("wordprocessingml") ? ".docx" : type.includes("presentationml") ? ".pptx" : "";
  const name = ext && !f.file_name.toLowerCase().endsWith(ext) ? `${f.file_name}${ext}` : f.file_name;
  return new File([blob], name, { type });
}

/** Save a curriculum file to the student's device in its original format. */
export async function downloadCurriculumFile(f: CurFile) {
  const file = await fetchCurriculumFile(f);
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url; a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CurriculumBrowser({ tree, signedIn, activeTitle, onOpen, onSelectLesson }: { tree: Tree | null; signedIn: boolean; activeTitle: string; onOpen: (f: CurFile) => void; onSelectLesson?: (scope: Scope) => void }) {
  const { t } = useLang();
  const [scope, setScope] = useState(emptyScope);
  if (!tree) return <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin"/>{t("Loading your courses…")}</p>;
  if (!signedIn) return <p className="p-4 text-sm text-muted-foreground">{t("Sign in to browse your faculty courses.")}</p>;
  if (!tree.length) return <p className="p-4 text-sm text-muted-foreground">{t("No courses yet for your year.")}</p>;
  const subject = tree.find(s => s.id === scope.s);
  const lesson = subject?.units.find(u => u.id === scope.u)?.lessons.find(l => l.id === scope.l);
  return <div className="space-y-4 p-3"><ScopePicker tree={tree} value={scope} onChange={setScope} fileLevel={false}/>{lesson && <><h3 className="font-medium">{lesson.name}</h3>{lesson.files.map(f => <Button key={f.id} variant={activeTitle === f.file_name ? "default" : "outline"} className="w-full justify-start whitespace-normal" onClick={() => onOpen(f)}><FileText/>{f.file_name}</Button>)}{onSelectLesson && <Button className="w-full" onClick={() => onSelectLesson(scope)}>{t("Study this lesson")}</Button>}</>}</div>;
}
