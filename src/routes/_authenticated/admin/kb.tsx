import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { AdminOnly, area, inp, PageHead, useAction, useServerFn } from "@/components/admin/team-context";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { deleteContent, saveContent } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/admin/kb")({ component: () => <AdminOnly><KB /></AdminOnly> });

function KB() {
  const [edit, setEdit] = useState<{ id?: string; title: string; category: string; content: string } | null>(null);
  const save = useServerFn(saveContent);
  const del = useServerFn(deleteContent);
  const act = useAction();
  const list = useQuery({ queryKey: ["kb"], queryFn: async () => (await supabase.from("kb_entries").select("*").order("category").order("title")).data ?? [] });
  return (
    <>
      <PageHead title="Wisen AI Knowledge Base" sub="Admin only. Entries that ground Wisen AI's answers about UFAS1." />
      <Button onClick={() => setEdit({ title: "", category: "General", content: "" })}><Plus /> New entry</Button>
      {edit && (
        <div className="mt-4 space-y-2 rounded-xl border border-primary/40 bg-card p-4">
          <div className="flex gap-2"><input className={inp} placeholder="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /><input className={`${inp} max-w-48`} placeholder="Category" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></div>
          <textarea className={area} rows={6} placeholder="Content" value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} />
          <div className="flex gap-2">
            <Button onClick={async () => { if (!edit.title.trim()) return; const r = await act(save({ data: { table: "kb_entries", id: edit.id, values: edit } }), "Saved"); if (r) setEdit(null); }}>Save</Button>
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
          </div>
        </div>
      )}
      <div className="mt-6 space-y-3">
        {list.data?.map((k) => (
          <div key={k.id} className="flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-sm">
            <div className="flex-1"><p className="font-mono text-[11px] uppercase text-primary">{k.category}</p><p className="font-medium">{k.title}</p><p className="mt-1 line-clamp-3 whitespace-pre-wrap text-muted-foreground">{k.content}</p></div>
            <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit({ id: k.id, title: k.title, category: k.category, content: k.content })}><Pencil /></Button>
            <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => confirm("Delete entry?") && act(del({ data: { table: "kb_entries", id: k.id, label: k.title } }), "Deleted")}><Trash2 /></Button>
          </div>
        ))}
        {list.data && !list.data.length && <p className="text-sm text-muted-foreground">No entries yet. The built-in UFAS1 knowledge base still powers Wisen AI.</p>}
      </div>
    </>
  );
}
