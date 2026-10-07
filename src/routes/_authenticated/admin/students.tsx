import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AdminOnly, inp, PageHead, useServerFn } from "@/components/admin/team-context";
import { listStudents } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/admin/students")({ head: () => ({ meta: [{"title": "Student Management \u2014 Wisen"}, {"name": "description", "content": "Manage Wisen student academic profiles."}, {"property": "og:title", "content": "Student Management \u2014 Wisen"}, {"property": "og:description", "content": "Manage Wisen student academic profiles."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}] }), component: () => <AdminOnly><Students /></AdminOnly> });

function Students() {
  const get = useServerFn(listStudents);
  const { data, isLoading } = useQuery({ queryKey: ["students"], queryFn: () => get() });
  const [q, setQ] = useState("");
  const rows = (data ?? []).filter((s) => `${s.full_name} ${s.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHead title="Students" sub={`${data?.length ?? 0} registered students`} />
      <input className={`${inp} mb-4 max-w-sm`} placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border font-mono text-[11px] uppercase text-muted-foreground">
            <tr><th className="p-3">Full name</th><th className="p-3">Email</th><th className="p-3">Faculty</th><th className="p-3">Department</th><th className="p-3">Year</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((s) => <tr key={s.id}><td className="p-3">{s.full_name || "—"}</td><td className="p-3">{s.email}</td><td className="p-3">{s.faculty}</td><td className="p-3">{s.department}</td><td className="p-3">{s.academic_year}</td></tr>)}
            {!isLoading && !rows.length && <tr><td colSpan={5} className="p-4 text-muted-foreground">No students found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
