import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, RefreshCw, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { LessonPicker, PageHead, useAction, useHierarchy, useServerFn } from "@/components/admin/team-context";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { deleteResource, resourceDownloadUrl, resourceUploadUrl, saveResource } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/admin/files")({ component: Files });

function Files() {
  const [pick, setPick] = useState({ s: "", u: "", l: "" });
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const replaceId = useRef<string | undefined>(undefined);
  const { data: h } = useHierarchy();
  const getUrl = useServerFn(resourceUploadUrl);
  const save = useServerFn(saveResource);
  const view = useServerFn(resourceDownloadUrl);
  const del = useServerFn(deleteResource);
  const act = useAction();

  const list = useQuery({
    queryKey: ["resources", pick.s, pick.u, pick.l],
    queryFn: async () => {
      let q = supabase.from("lesson_resources").select("*").order("created_at", { ascending: false });
      if (pick.l) q = q.eq("lesson_id", pick.l); else if (pick.u) q = q.eq("unit_id", pick.u); else if (pick.s) q = q.eq("subject_id", pick.s);
      return (await q).data ?? [];
    },
  });

  const onFile = async (file: File) => {
    const existing = replaceId.current ? list.data?.find((r) => r.id === replaceId.current) : undefined;
    const target = existing ? { s: existing.subject_id, u: existing.unit_id, l: existing.lesson_id ?? "" } : pick;
    if (!target.u) return toast.error("Choose a subject and unit first.");
    setBusy(true);
    try {
      const up = await getUrl({ data: { fileName: file.name } });
      const { error } = await supabase.storage.from("resources").uploadToSignedUrl(up.path, up.token, file, { contentType: file.type });
      if (error) throw new Error("Upload failed");
      await act(save({ data: { id: replaceId.current, subject_id: target.s, unit_id: target.u, lesson_id: target.l || null, file_name: file.name, storage_path: up.path, mime_type: file.type, size_bytes: file.size } }), replaceId.current ? "File replaced" : "File uploaded");
    } catch (e) { toast.error((e as Error).message); }
    replaceId.current = undefined; setBusy(false);
  };

  const where = (r: { unit_id: string; lesson_id: string | null }) => {
    const u = h?.units.find((x) => x.id === r.unit_id); const l = h?.lessons.find((x) => x.id === r.lesson_id);
    const s = h?.subjects.find((x) => x.id === u?.subject_id);
    return [s?.name, u?.name, l?.name].filter(Boolean).join(" → ");
  };

  return (
    <>
      <PageHead title="Files & Sources" sub="QBank resource files attached to a unit or lesson. Files are private to the Team." />
      <div className="flex flex-wrap items-center gap-2">
        <LessonPicker value={pick} onChange={setPick} allowUnitOnly />
        <Button disabled={busy || !pick.u} onClick={() => { replaceId.current = undefined; input.current?.click(); }}><Upload /> {busy ? "Uploading…" : "Upload file"}</Button>
        <input ref={input} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onFile(f); }} />
      </div>
      <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
        {list.data?.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{r.file_name}</p><p className="text-xs text-muted-foreground">{where(r)} · {(r.size_bytes / 1024).toFixed(0)} KB · {new Date(r.updated_at).toLocaleDateString()}</p></div>
            <Button size="sm" variant="ghost" onClick={async () => { const x = await act(view({ data: { id: r.id } })); if (x?.url) window.open(x.url, "_blank", "noopener"); }}><Eye /> View</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => { replaceId.current = r.id; input.current?.click(); }}><RefreshCw /> Replace</Button>
            <Button size="sm" variant="ghost" onClick={() => confirm(`Delete ${r.file_name}?`) && act(del({ data: { id: r.id } }), "File deleted")}><Trash2 /></Button>
          </div>
        ))}
        {list.data && !list.data.length && <p className="p-4 text-sm text-muted-foreground">No files here yet.</p>}
      </div>
    </>
  );
}
