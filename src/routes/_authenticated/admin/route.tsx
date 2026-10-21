import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Archive, BookOpen, Brain, Sparkles, CloudDownload, FileText, GraduationCap, Layers, LayoutDashboard, ListChecks, LogOut, Users } from "lucide-react";
import { useState } from "react";

import { TeamCtx } from "@/components/admin/team-context";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { claimFirstAdmin, getMyTeam } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Wisen Team workspace" },
      { name: "description", content: "Manage Wisen academic content, files and team members." },
      { property: "og:title", content: "Wisen Team workspace" },
      { property: "og:description", content: "Admin and Editor workspace for Wisen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, admin: false },
  { to: "/admin/qbank", label: "QBank", icon: ListChecks, admin: false },
  { to: "/admin/past-emds", label: "Past EMDs", icon: Archive, admin: false },
  { to: "/admin/ai-exams", label: "AI Exams", icon: Sparkles, admin: false },
  { to: "/admin/subjects", label: "Subjects", icon: BookOpen, admin: false },
  { to: "/admin/files", label: "Files & Sources", icon: FileText, admin: false },
  { to: "/admin/drive-import", label: "Drive Importer", icon: CloudDownload, admin: false },
  { to: "/admin/flashcards", label: "Kapsules", icon: Layers, admin: false },
  { to: "/admin/kb", label: "Wisen AI Knowledge Base", icon: Brain, admin: true },
  { to: "/admin/students", label: "Students", icon: GraduationCap, admin: true },
  { to: "/admin/team", label: "Team", icon: Users, admin: true },
] as const;

function AdminLayout() {
  const get = useServerFn(getMyTeam);
  const q = useQuery({ queryKey: ["my-team"], queryFn: () => get() });
  const nav = useNavigate();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/team/login", replace: true });
  };

  if (q.isLoading) return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Loading…</div>;
  const d = q.data;
  if (!d?.team) return <NoAccess adminExists={!!d?.adminExists} email={d?.email ?? ""} onSignOut={signOut} />;
  if (d.team.status !== "active") return (
    <Center title="Account frozen" body="Your Wisen Team access is currently frozen. Contact an Admin to restore it." onSignOut={signOut} />
  );
  const t = d.team;
  return (
    <TeamCtx.Provider value={t}>
      <Toaster />
      <div className="flex min-h-dvh bg-background text-foreground">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card/40 p-4 md:flex">
          <Link to="/" className="mb-6"><Logo /></Link>
          <span className="mb-4 w-fit rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[11px] uppercase text-primary">{t.role === "admin" ? "Admin" : "Editor"}</span>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV.filter((n) => !n.admin || t.role === "admin").map((n) => (
              <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/admin" }} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground" activeProps={{ className: "bg-accent text-foreground" }}>
                <n.icon className="size-4" /> {n.label}
              </Link>
            ))}
          </nav>
          <p className="truncate text-xs text-muted-foreground">{t.email}</p>
          <Button variant="ghost" size="sm" className="mt-2 justify-start" onClick={signOut}><LogOut /> Sign out</Button>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="flex gap-1 overflow-x-auto border-b border-border p-2 md:hidden">
            {NAV.filter((n) => !n.admin || t.role === "admin").map((n) => (
              <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/admin" }} className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs text-muted-foreground" activeProps={{ className: "bg-accent text-foreground" }}>{n.label}</Link>
            ))}
            <button onClick={signOut} className="px-3 text-xs text-muted-foreground">Sign out</button>
          </div>
          <main className="mx-auto max-w-6xl p-5 sm:p-8"><Outlet /></main>
        </div>
      </div>
    </TeamCtx.Provider>
  );
}

function Center({ title, body, children, onSignOut }: { title: string; body: string; children?: React.ReactNode; onSignOut: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <h1 className="font-serif text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        {children}
        <Button variant="ghost" size="sm" className="mt-4" onClick={onSignOut}><LogOut /> Sign out</Button>
      </div>
    </div>
  );
}

function NoAccess({ adminExists, email, onSignOut }: { adminExists: boolean; email: string; onSignOut: () => void }) {
  const claim = useServerFn(claimFirstAdmin);
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (adminExists) return <Center title="No Team access" body={`${email} isn't a Wisen Team member. Team members join through an email invitation from an Admin.`} onSignOut={onSignOut} />;
  return (
    <Center title="Admin setup" body="Enter the Admin registration code to create the first Wisen Admin account." onSignOut={onSignOut}>
      <form className="mt-4 space-y-3" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr("");
        try { const r = await claim({ data: { code } }); if (r.ok) await qc.invalidateQueries({ queryKey: ["my-team"] }); else setErr(r.error ?? "Failed"); }
        catch { setErr("Something went wrong."); }
        setBusy(false);
      }}>
        <input className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" type="password" placeholder="Registration code" value={code} onChange={(e) => setCode(e.target.value)} />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full" disabled={busy || !code}>{busy ? "Checking…" : "Create Admin account"}</Button>
      </form>
    </Center>
  );
}
