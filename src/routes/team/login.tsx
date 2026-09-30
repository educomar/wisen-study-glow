import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { AuthCard, inputCls } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/team/login")({
  validateSearch: z.object({ next: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Wisen Team sign in" },
      { name: "description", content: "Sign in to the Wisen Team workspace for Admins and Editors." },
      { property: "og:title", content: "Wisen Team sign in" },
      { property: "og:description", content: "Team access for Wisen Admins and Editors." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamLogin,
});

export function TeamAuthForm({ next, lockedEmail }: { next: string; lockedEmail?: string }) {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState(lockedEmail ?? "");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const google = async () => {
    sessionStorage.setItem("wisen-team-next", next);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/team/login` });
    if (r.error) setErr(r.error.message ?? "Google sign-in failed.");
    else nav({ to: next });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setMsg(""); setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
      setBusy(false);
      if (error) return setErr(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
      nav({ to: next });
    } else {
      if (pw.length < 8) { setBusy(false); return setErr("Use at least 8 characters."); }
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pw, options: { emailRedirectTo: `${window.location.origin}${next}`, data: { full_name: name.trim() } } });
      setBusy(false);
      if (error) return setErr(error.message);
      if (data.session) nav({ to: next });
      else setMsg("Check your email to confirm your account, then come back to this page.");
    }
  };

  return (
    <>
      <button type="button" onClick={google} className="flex h-11 w-full items-center justify-center rounded-md border border-border bg-background text-sm font-medium hover:bg-accent">Continue with Google</button>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
      <form onSubmit={submit} className="space-y-3">
        {mode === "up" && <input className={inputCls} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />}
        <input className={inputCls} type="email" required placeholder="Email" value={email} readOnly={!!lockedEmail} onChange={(e) => setEmail(e.target.value)} />
        <input className={inputCls} type="password" required placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        {msg && <p className="text-sm text-primary">{msg}</p>}
        <Button type="submit" disabled={busy} className="h-11 w-full">{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</Button>
      </form>
      <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-3 w-full text-center text-sm text-primary hover:underline">
        {mode === "in" ? "New team member? Create an account" : "Already have an account? Sign in"}
      </button>
    </>
  );
}

function TeamLogin() {
  const { next } = Route.useSearch();
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
  return (
    <AuthCard title="Wisen Team" subtitle="For Admins and Editors. Students, use the regular log in." footer={<Link to="/login" className="hover:underline">Student log in</Link>}>
      <TeamAuthForm next={target} />
    </AuthCard>
  );
}
