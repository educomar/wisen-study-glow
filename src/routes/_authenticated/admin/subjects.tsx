import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { inp, PageHead, sel, useAction, useHierarchy, useServerFn } from "@/components/admin/team-context";
import { Button } from "@/components/ui/button";
import { deleteContent, saveContent } from "@/lib/team.functions";
import { FACULTIES, YEARS, type Department } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/admin/subjects")({ component: Subjects });

function Subjects() {
  const { data } = useHierarchy();
  const save = useServerFn(saveContent);
  const del = useServerFn(deleteContent);
  const act = useAction();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [f, setF] = useState({ name: "", department: "Medicine" as Department, academic_year: 1, faculty: FACULTIES[0]! });

  const rename = (table: "subjects" | "units" | "lessons", id: string, cur: string) => {
    const name = prompt("New name", cur)?.trim();
    if (name && name !== cur) void act(save({ data: { table, id, values: { name } } }), "Renamed");
  };
  const remove = (table: "subjects" | "units" | "lessons", id: string, label: string) => {
    if (confirm(`Delete “${label}” and everything inside it?`)) void act(del({ data: { table, id, label } }), "Deleted");
  };
  const add = (table: "units" | "lessons", parentKey: "subject_id" | "unit_id", parent: string) => {
    const name = prompt(table === "units" ? "Unit name" : "Lesson name")?.trim();
    if (name) void act(save({ data: { table, values: { name, [parentKey]: parent } } }), "Added");
  };

  const Row = ({ label, onEdit, onDel, children }: { label: React.ReactNode; onEdit: () => void; onDel: () => void; children?: React.ReactNode }) => (
    <div className="flex items-center gap-2 py-1.5">
      <div className="min-w-0 flex-1">{label}</div>
      {children}
      <Button size="icon" variant="ghost" aria-label="Edit" onClick={onEdit}><Pencil /></Button>
      <Button size="icon" variant="ghost" aria-label="Delete" onClick={onDel}><Trash2 /></Button>
    </div>
  );

  return (
    <>
      <PageHead title="Subjects" sub="Subject → Unit → Lesson. Students see subjects matching their faculty, department and year." />
      <form className="mb-6 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-4" onSubmit={(e) => {
        e.preventDefault(); if (!f.name.trim()) return;
        void act(save({ data: { table: "subjects", values: { ...f, name: f.name.trim() } } }), "Subject added").then(() => setF({ ...f, name: "" }));
      }}>
        <input className={`${inp} max-w-xs`} placeholder="New subject name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <select className={sel} value={f.department} onChange={(e) => setF({ ...f, department: e.target.value as Department, academic_year: 1 })}>
          <option>Medicine</option><option>Dentistry</option>
        </select>
        <select className={sel} value={f.academic_year} onChange={(e) => setF({ ...f, academic_year: Number(e.target.value) })}>
          {Array.from({ length: YEARS[f.department] }, (_, i) => <option key={i} value={i + 1}>Year {i + 1}</option>)}
        </select>
        <Button type="submit"><Plus /> Add subject</Button>
      </form>
      <div className="space-y-3">
        {data?.subjects.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-card px-4 py-2">
            <Row label={<button className="flex items-center gap-2 font-semibold" onClick={() => setOpen({ ...open, [s.id]: !open[s.id] })}><ChevronRight className={`size-4 transition ${open[s.id] ? "rotate-90" : ""}`} />{s.name} <span className="font-mono text-[11px] font-normal text-muted-foreground">{s.department} · Y{s.academic_year}</span></button>}
              onEdit={() => rename("subjects", s.id, s.name)} onDel={() => remove("subjects", s.id, s.name)}>
              <Button size="sm" variant="outline" onClick={() => add("units", "subject_id", s.id)}><Plus /> Unit</Button>
            </Row>
            {open[s.id] && (
              <div className="ml-6 border-l border-border pl-4">
                {data.units.filter((u) => u.subject_id === s.id).map((u) => (
                  <div key={u.id}>
                    <Row label={<span className="text-sm font-medium">{u.name}</span>} onEdit={() => rename("units", u.id, u.name)} onDel={() => remove("units", u.id, u.name)}>
                      <Button size="sm" variant="outline" onClick={() => add("lessons", "unit_id", u.id)}><Plus /> Lesson</Button>
                    </Row>
                    <div className="ml-4 border-l border-border pl-4">
                      {data.lessons.filter((l) => l.unit_id === u.id).map((l) => (
                        <Row key={l.id} label={<span className="text-sm text-muted-foreground">{l.name}</span>} onEdit={() => rename("lessons", l.id, l.name)} onDel={() => remove("lessons", l.id, l.name)} />
                      ))}
                    </div>
                  </div>
                ))}
                {!data.units.some((u) => u.subject_id === s.id) && <p className="py-2 text-sm text-muted-foreground">No units yet.</p>}
              </div>
            )}
          </div>
        ))}
        {data && !data.subjects.length && <p className="text-sm text-muted-foreground">No subjects yet.</p>}
      </div>
    </>
  );
}
