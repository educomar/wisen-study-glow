import { translate, useLang } from '@/lib/i18n';
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { AuthCard, GoogleButton, inputCls } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create your account — Wisen" },
      { name: "description", content: "Join Wisen and turn your medical courses into focused practice." },
      { property: "og:title", content: "Create your account — Wisen" },
      { property: "og:description", content: "Study smarter. Score higher. Pass." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Register,
});

function Register() {
  useLang();
  const [f, setF] = useState({ name: "", email: "", pw: "", pw2: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!f.name.trim()) return setErr("Please enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setErr("Please enter a valid email address.");
    if (f.pw.length < 6) return setErr("Password must be at least 6 characters.");
    if (f.pw !== f.pw2) return setErr("Passwords don't match.");
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.pw,
      options: { emailRedirectTo: `${window.location.origin}/onboarding`, data: { full_name: f.name.trim() } },
    });
    setBusy(false);
    if (error) return setErr(/already|registered/i.test(error.message) ? "An account with this email already exists. Try logging in." : error.message);
    if (data.user && data.user.identities?.length === 0) return setErr("An account with this email already exists. Try logging in.");
    if (data.session) window.location.assign("/onboarding");
    else setSent(true);
  };

  if (sent) return (
    <AuthCard title={translate("Check your email")} subtitle={translate("We sent a confirmation link to ") + (f.email) + translate(".")} footer={<Link to="/login" className="text-primary hover:underline">{translate("Back to log in")}</Link>}>
      <p className="text-sm text-muted-foreground">{translate("Open the link to confirm your account — you'll then set up your academic profile.")}</p>
    </AuthCard>
  );

  return (
    <AuthCard title={translate("Create your account")} subtitle={translate("Built for students of the Faculty of Medicine Setif 1.")} footer={<>{translate("Already have an account?")} <Link to="/login" className="text-primary hover:underline">{translate("Log in")}</Link></>}>
      <GoogleButton onError={setErr} />
      <form onSubmit={submit} className="space-y-3" noValidate>
        <input className={inputCls} placeholder={translate("Full name")} value={f.name} onChange={set("name")} autoComplete="name" />
        <input className={inputCls} type="email" placeholder={translate("Email")} value={f.email} onChange={set("email")} autoComplete="email" />
        <input className={inputCls} type="password" placeholder={translate("Password")} value={f.pw} onChange={set("pw")} autoComplete="new-password" />
        <input className={inputCls} type="password" placeholder={translate("Confirm password")} value={f.pw2} onChange={set("pw2")} autoComplete="new-password" />
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <Button type="submit" disabled={busy} className="h-11 w-full">{busy ? translate("Creating account…") : translate("Get started")}</Button>
      </form>
    </AuthCard>
  );
}
