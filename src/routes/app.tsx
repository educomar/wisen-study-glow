import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, Bookmark, BookOpen, ClipboardCheck, Layers, ListChecks, MessageSquareText, Moon, PanelLeftClose, PanelLeftOpen, Pencil, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { ProfileDialog } from "@/components/app/ProfileDialog";
import { badge, useSession } from "@/lib/profile";

import { Exam } from "@/components/app/Exam";
import { Flashcards } from "@/components/app/Flashcards";
import { ProgressView, Saved } from "@/components/app/Progress";
import { QBank } from "@/components/app/QBank";
import { Workspace } from "@/components/app/Workspace";
import { WisenAI } from "@/components/app/WisenAI";
import { setTab as saveTab, useAppState, type Tab } from "@/components/app/store";
import { useRemoteQuestions } from "@/components/app/remote";
import { Logo } from "@/components/site/Logo";
import { useTheme } from "@/components/site/theme";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Wisen Workspace — Study app" },
      { name: "description", content: "Your Wisen study workspace: lecture reader with AI, EMD QBank, flashcards, exam mode and progress." },
      { property: "og:title", content: "Wisen Workspace — Study app" },
      { property: "og:description", content: "Read, practice, and review medical courses in one focused workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppShell,
});

const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
  { id: "qbank", label: "QBank", icon: ListChecks },
  { id: "ai", label: "Wisen AI", icon: MessageSquareText },
  { id: "workspace", label: "Parallel Workspace", icon: BookOpen },
  { id: "cards", label: "Flashcards", icon: Layers },
  { id: "exam", label: "EMD Exam Mode", icon: ClipboardCheck },
  { id: "progress", label: "Progress & Weak Areas", icon: BarChart3 },
  { id: "saved", label: "Saved & Bookmarks", icon: Bookmark },
];

function AppShell() {
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const { user, profile, setProfile, loading } = useSession();
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!loading && user && profile && !profile.onboarded) navigate({ to: "/onboarding" }); }, [loading, user, profile, navigate]);
  const app = useAppState();
  useRemoteQuestions();
  const tab = app.tab;
  const [collapsed, setCollapsed] = useState(false);
  const go = (t: Tab) => saveTab(t);
  const current = tabs.find((t) => t.id === tab) ?? tabs[0]!;
  const ctx = profile ? badge(profile) : undefined;

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground md:flex-row">
      <aside className={`flex shrink-0 flex-col border-b border-border bg-card/60 md:border-b-0 md:border-r ${collapsed ? "md:w-16" : "md:w-64"} transition-[width]`}>
        <div className="flex h-14 items-center justify-between gap-2 px-3">
          {!collapsed && <Link to="/" aria-label="Wisen home"><Logo /></Link>}
          <button onClick={() => setCollapsed(!collapsed)} className="hidden rounded-md p-2 hover:bg-accent md:block" aria-label="Toggle sidebar">
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-1 md:flex-col md:overflow-visible">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => go(t.id)} title={t.label} className={`flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm transition ${tab === t.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
              <t.icon className="size-4 shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{t.label}</span>}
            </button>
          ))}
        </nav>
        <div className="hidden space-y-1 border-t border-border p-2 md:block">
          <button onClick={toggle} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />} {!collapsed && (dark ? "Light mode" : "Dark mode")}
          </button>
          <Link to="/" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
            <ArrowLeft className="size-4" /> {!collapsed && "Back to landing"}
          </Link>
          {!collapsed && (
            <button onClick={() => profile && setEditing(true)} className="mt-2 w-full rounded-lg border border-border p-3 text-left">
              <p className="truncate text-sm font-medium">{profile?.full_name || "Guest student"}</p>
              <p className="font-mono text-[10px] uppercase text-primary">Faculty of Medicine · Sétif 1</p>
            </button>
          )}
        </div>
      </aside>
      <main className="flex min-h-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
          <h1 className="font-semibold">{current.label}</h1>
          <div className="flex items-center gap-2 md:hidden">
            <button onClick={toggle} className="rounded-md p-2 hover:bg-accent" aria-label="Toggle theme">{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
            <Link to="/" className="rounded-md p-2 hover:bg-accent" aria-label="Back to landing"><ArrowLeft className="size-4" /></Link>
          </div>
          {user && profile ? (
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 hover:border-primary" aria-label="Edit profile">
              <span className="grid size-7 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{(profile.full_name || user.email || "?").charAt(0).toUpperCase()}</span>
              <span className="hidden text-sm font-medium sm:inline">{profile.full_name || user.email}</span>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">{badge(profile)}</span>
              <Pencil className="size-3.5 text-muted-foreground" />
            </button>
          ) : !loading && (
            <div className="flex items-center gap-2">
              <span className="hidden font-mono text-[10px] uppercase text-muted-foreground sm:inline">Guest preview</span>
              <Link to="/login" className="rounded-md border border-border px-3 py-1.5 text-sm hover:border-primary">Log in</Link>
              <Link to="/register" className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">Sign up</Link>
            </div>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {tabs.map((t) => (
            <div key={t.id} className={tab === t.id ? (t.id === "workspace" || t.id === "ai" ? "lg:h-full" : "") : "hidden"}>
              {t.id === "qbank" && <QBank context={ctx} />}
              {t.id === "ai" && <WisenAI context={ctx} />}
              {t.id === "workspace" && <Workspace context={ctx} />}
              {t.id === "cards" && <Flashcards />}
              {t.id === "exam" && <Exam />}
              {t.id === "progress" && <ProgressView />}
              {t.id === "saved" && <Saved />}
            </div>
          ))}
        </div>
      </main>
      {user && profile && <ProfileDialog open={editing} onOpenChange={setEditing} user={user} profile={profile} onSaved={setProfile} />}
      <Toaster />
    </div>
  );
}
