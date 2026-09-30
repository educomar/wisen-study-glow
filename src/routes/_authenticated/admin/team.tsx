import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Mail } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminOnly, inp, PageHead, sel, useAction, useServerFn, useTeam } from "@/components/admin/team-context";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { createInvite, deleteMember, listTeam, resendInvite, revokeInvite, setMemberRole, setMemberStatus, updateMemberName } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/admin/team")({ component: () => <AdminOnly><TeamPage /></AdminOnly> });

const link = (token: string) => `${window.location.origin}/team/invite/${token}`;
const copy = (token: string) => { void navigator.clipboard.writeText(link(token)); toast.success("Invite link copied — send it to the invited email"); };

function TeamPage() {
  const me = useTeam();
  const get = useServerFn(listTeam);
  const invite = useServerFn(createInvite);
  const resend = useServerFn(resendInvite);
  const revoke = useServerFn(revokeInvite);
  const status = useServerFn(setMemberStatus);
  const remove = useServerFn(deleteMember);
  const role = useServerFn(setMemberRole);
  const rename = useServerFn(updateMemberName);
  const act = useAction();
  const { data } = useQuery({ queryKey: ["team"], queryFn: () => get() });
  const [f, setF] = useState({ email: "", role: "editor" as "editor" | "admin" });
  const [last, setLast] = useState<{ email: string; token: string } | null>(null);

  return (
    <>
      <PageHead title="Team" sub="Invite Editors and Admins, manage access and review activity." />
      <form className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-4" onSubmit={async (e) => {
        e.preventDefault();
        const r = await act(invite({ data: f }), "Invitation created");
        if (r) { setLast({ email: f.email, token: r.token }); setF({ ...f, email: "" }); }
      }}>
        <input className={`${inp} max-w-xs`} type="email" required placeholder="Email address" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <select className={sel} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as "editor" | "admin" })}><option value="editor">Editor</option><option value="admin">Admin</option></select>
        <Button type="submit"><Mail /> Invite by email</Button>
      </form>
      {last && (
        <div className="mt-3 rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">
          <p>Invitation for <b>{last.email}</b>. Email sending isn't connected yet — send this link to them (valid 7 days, one use, only works for that email):</p>
          <div className="mt-2 flex gap-2"><code className="flex-1 truncate rounded bg-background px-2 py-1.5 text-xs">{link(last.token)}</code><Button size="sm" onClick={() => copy(last.token)}><Copy /> Copy</Button></div>
        </div>
      )}

      <h2 className="mt-8 font-semibold">Members</h2>
      <div className="mt-2 divide-y divide-border rounded-xl border border-border bg-card">
        {data?.members.map((m) => (
          <div key={m.user_id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
            <div className="min-w-0 flex-1"><p className="font-medium">{m.full_name || m.email} {m.user_id === me.userId && <span className="text-xs text-muted-foreground">(you)</span>}</p><p className="text-xs text-muted-foreground">{m.email}</p></div>
            <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] uppercase">{m.role}</span>
            <span className={`rounded-md px-2 py-0.5 font-mono text-[11px] uppercase ${m.status === "active" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{m.status}</span>
            {m.user_id !== me.userId && (
              <>
                <Button size="sm" variant="ghost" onClick={() => { const n = prompt("Full name", m.full_name); if (n !== null) void act(rename({ data: { userId: m.user_id, fullName: n } }), "Updated"); }}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => act(status({ data: { userId: m.user_id, status: m.status === "active" ? "frozen" : "active" } }), m.status === "active" ? "Frozen" : "Unfrozen")}>{m.status === "active" ? "Freeze" : "Unfreeze"}</Button>
                <Button size="sm" variant="ghost" onClick={() => confirm(m.role === "admin" ? "Change to Editor?" : "Make this member an Admin?") && act(role({ data: { userId: m.user_id, role: m.role === "admin" ? "editor" : "admin" } }), "Role updated")}>{m.role === "admin" ? "Make Editor" : "Make Admin"}</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => confirm(`Remove ${m.email} from the Team? Their history is kept.`) && act(remove({ data: { userId: m.user_id } }), "Removed")}>Delete</Button>
              </>
            )}
          </div>
        ))}
      </div>

      <h2 className="mt-8 font-semibold">Invitations</h2>
      <div className="mt-2 divide-y divide-border rounded-xl border border-border bg-card">
        {data?.invites.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
            <div className="min-w-0 flex-1"><p>{i.email}</p><p className="text-xs text-muted-foreground">{i.role} · sent {new Date(i.created_at).toLocaleDateString()} · expires {new Date(i.expires_at).toLocaleDateString()}</p></div>
            <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] uppercase">{i.status}</span>
            {(i.status === "pending" || i.status === "expired") && (
              <Button size="sm" variant="ghost" onClick={async () => { const r = await act(resend({ data: { id: i.id } }), "New link created"); if (r) setLast({ email: i.email, token: r.token }); }}>Resend</Button>
            )}
            {i.status === "pending" && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => act(revoke({ data: { id: i.id } }), "Revoked")}>Revoke</Button>}
          </div>
        ))}
        {data && !data.invites.length && <p className="p-4 text-sm text-muted-foreground">No invitations yet.</p>}
      </div>

      <AuditLog />
    </>
  );
}

function AuditLog() {
  const [f, setF] = useState({ actor: "", role: "", action: "", type: "", from: "", to: "" });
  const { data } = useQuery({
    queryKey: ["audit", f],
    queryFn: async () => {
      let q = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(300);
      if (f.actor) q = q.eq("actor_email", f.actor);
      if (f.role) q = q.eq("actor_role", f.role);
      if (f.action) q = q.eq("action", f.action);
      if (f.type) q = q.eq("entity_type", f.type);
      if (f.from) q = q.gte("created_at", new Date(f.from).toISOString());
      if (f.to) q = q.lte("created_at", new Date(`${f.to}T23:59:59`).toISOString());
      return (await q).data ?? [];
    },
  });
  const all = useQuery({ queryKey: ["audit-facets"], queryFn: async () => (await supabase.from("audit_log").select("actor_email, action, entity_type").limit(1000)).data ?? [] });
  const facets = useMemo(() => {
    const u = (k: "actor_email" | "action" | "entity_type") => [...new Set((all.data ?? []).map((r) => r[k]))].sort();
    return { actors: u("actor_email"), actions: u("action"), types: u("entity_type") };
  }, [all.data]);
  const S = ({ k, opts, label }: { k: keyof typeof f; opts: string[]; label: string }) => (
    <select className={sel} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}><option value="">{label}</option>{opts.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}</select>
  );
  return (
    <>
      <h2 className="mt-8 font-semibold">Activity log</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        <S k="actor" opts={facets.actors} label="All members" />
        <S k="role" opts={["admin", "editor"]} label="All roles" />
        <S k="action" opts={facets.actions} label="All actions" />
        <S k="type" opts={facets.types} label="All content types" />
        <input type="date" className={sel} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label="From date" />
        <input type="date" className={sel} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label="To date" />
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border font-mono text-[11px] uppercase text-muted-foreground"><tr><th className="p-3">When</th><th className="p-3">Member</th><th className="p-3">Role</th><th className="p-3">Action</th><th className="p-3">Content</th><th className="p-3">Result</th></tr></thead>
          <tbody className="divide-y divide-border">
            {data?.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap p-3 text-xs">{new Date(a.created_at).toLocaleString()}</td>
                <td className="p-3">{a.actor_email}</td><td className="p-3">{a.actor_role}</td>
                <td className="p-3">{a.action.replace(/_/g, " ")}</td>
                <td className="p-3"><span className="text-muted-foreground">{a.entity_type}</span> {a.entity_label}<br /><span className="font-mono text-[10px] text-muted-foreground">{a.entity_id}</span></td>
                <td className="p-3">{a.result}</td>
              </tr>
            ))}
            {data && !data.length && <tr><td colSpan={6} className="p-4 text-muted-foreground">No matching activity.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
