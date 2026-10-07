import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { area, LessonPicker, PageHead, useAction, useServerFn } from "@/components/admin/team-context";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { deleteContent, saveContent } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/admin/flashcards")({ component: FlashAdmin });

function FlashAdmin() {
  const [pick, setPick] = useState({ s: "", u: "", l: "" });
  const [edit, setEdit] = useState<{ id?: string; front: string; back: string } | null>(null);
  const save = useServerFn(saveContent);
  const del = useServerFn(deleteContent);
  const act = useAction();
  const cards = useQuery({
    queryKey: ["flash", pick.l], enabled: !!pick.l,
    queryFn: async () => (await supabase.from("team_flashcards").select("*").eq("lesson_id", pick.l).order("created_at")).data ?? [],
  });
  return (
    <>
      <PageHead title="Kapsules" sub="Kapsules attached to a lesson." />
      <LessonPicker value={pick} onChange={setPick} />
      {pick.l && (
        <div className="mt-6 space-y-3">
          <Button onClick={() => setEdit({ front: "", back: "" })}><Plus /> New card</Button>
          {edit && (
            <div className="space-y-2 rounded-xl border border-primary/40 bg-card p-4">
              <textarea className={area} rows={2} placeholder="Front" value={edit.front} onChange={(e) => setEdit({ ...edit, front: e.target.value })} />
              <textarea className={area} rows={3} placeholder="Back" value={edit.back} onChange={(e) => setEdit({ ...edit, back: e.target.value })} />
              <div className="flex gap-2">
                <Button onClick={async () => {
                  if (!edit.front.trim() || !edit.back.trim()) return;
                  const r = await act(save({ data: { table: "team_flashcards", id: edit.id, values: { front: edit.front, back: edit.back, lesson_id: pick.l } } }), "Saved");
                  if (r) setEdit(null);
                }}>Save</Button>
                <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
              </div>
            </div>
          )}
          {cards.data?.map((c) => (
            <div key={c.id} className="flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-sm">
              <div className="flex-1"><p className="font-medium">{c.front}</p><p className="mt-1 text-muted-foreground">{c.back}</p></div>
              <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit({ id: c.id, front: c.front, back: c.back })}><Pencil /></Button>
              <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => confirm("Delete card?") && act(del({ data: { table: "team_flashcards", id: c.id, label: c.front.slice(0, 120) } }), "Deleted")}><Trash2 /></Button>
            </div>
          ))}
          {cards.data && !cards.data.length && <p className="text-sm text-muted-foreground">No cards yet.</p>}
        </div>
      )}
    </>
  );
}
