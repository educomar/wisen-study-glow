import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, Bookmark, BookOpen, ClipboardCheck, Layers, ListChecks, Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";
import { useState } from "react";

import { Exam } from "@/components/app/Exam";
import { Flashcards } from "@/components/app/Flashcards";
import { ProgressView, Saved } from "@/components/app/Progress";
import { QBank } from "@/components/app/QBank";
import { Workspace } from "@/components/app/Workspace";
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

const tabs = [
  { id: "workspace", label: "Parallel Workspace", icon: BookOpen },
  { id: "qbank", label: "Smart EMD QBank", icon: ListChecks },
  { id: "cards", label: "Flashcards", icon: Layers },
  { id: "exam", label: "EMD Exam Mode", icon: ClipboardCheck },
  { id: "progress", label: "Progress & Weak Areas", icon: BarChart3 },
  { id: "saved", label: "Saved & Bookmarks", icon: Bookmark },
] as const;
type Tab = (typeof tabs)[number]["id"];

function AppShell() {
  const { dark, toggle } = useTheme();
  const [tab, setTab] = useState<Tab>("workspace");
  const [collapsed, setCollapsed] = useState(false);
  const [topic, setTopic] = useState<string | undefined>();
  const practice = (t: string) => { setTopic(t); setTab("qbank"); };
  const go = (t: Tab) => { if (t === "qbank") setTopic(undefined); setTab(t); };
  const current = tabs.find((t) => t.id === tab)!;

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
            <div className="mt-2 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Medical student</p>
              <p className="font-mono text-[10px] uppercase text-primary">Faculty of Medicine · Sétif 1</p>
            </div>
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
          <span className="hidden font-mono text-[11px] uppercase text-muted-foreground md:block">Embryology · Chapter 3</span>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === "workspace" && <Workspace />}
          {tab === "qbank" && <QBank key={topic ?? "all"} topic={topic} />}
          {tab === "cards" && <Flashcards />}
          {tab === "exam" && <Exam onReview={() => setTab("workspace")} onPractice={practice} />}
          {tab === "progress" && <ProgressView onPractice={practice} />}
          {tab === "saved" && <Saved />}
        </div>
      </main>
      <Toaster />
    </div>
  );
}
