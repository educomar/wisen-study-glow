import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { PageHead, useTeam } from "@/components/admin/team-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Dashboard });

function Dashboard() {
  const t = useTeam();
  const { data } = useQuery({
    queryKey: ["dash"],
    queryFn: async () => {
      const c = async (tbl: "subjects" | "units" | "lessons" | "qbank_questions" | "team_flashcards" | "lesson_resources") =>
        (await supabase.from(tbl).select("id", { count: "exact", head: true })).count ?? 0;
      const [subjects, units, lessons, questions, flashcards, files] = await Promise.all([c("subjects"), c("units"), c("lessons"), c("qbank_questions"), c("team_flashcards"), c("lesson_resources")]);
      const recent = t.role === "admin" ? (await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(8)).data ?? [] : [];
      return { stats: { subjects, units, lessons, questions, flashcards, files }, recent };
    },
  });
  return (
    <>
      <PageHead title={`Welcome, ${t.role === "admin" ? "Admin" : "Editor"}`} sub={t.email} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(data?.stats ?? {}).map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4">
            <p className="font-mono text-[11px] uppercase text-muted-foreground">{k}</p>
            <p className="mt-1 font-serif text-3xl">{v}</p>
          </div>
        ))}
      </div>
      {t.role === "admin" && (
        <div className="mt-8 rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Recent Team activity</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {data?.recent.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><b>{a.actor_email}</b> · {a.action.replace(/_/g, " ")} · {a.entity_type} {a.entity_label && `“${a.entity_label}”`}</span>
                <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
            {!data?.recent.length && <li className="py-2 text-muted-foreground">No activity yet.</li>}
          </ul>
        </div>
      )}
    </>
  );
}
