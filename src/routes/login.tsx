import { translate, useLang } from '@/lib/i18n';
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { AuthCard, GoogleButton, inputCls } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — Wisen" },
      { name: "description", content: "Log in to your Wisen study workspace." },
      { property: "og:title", content: "Log in — Wisen" },
      { property: "og:description", content: "Continue studying smarter with Wisen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  useLang();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) return setErr(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
    nav({ to: "/onboarding" });
  };

  return (
    <AuthCard title={translate("Welcome back")} subtitle={translate("Log in to continue your study session.")} footer={<>{translate("New to Wisen?")} <Link to="/register" className="text-primary hover:underline">{translate("Create an account")}</Link> · <Link to="/app" className="hover:underline">{translate("Browse as guest")}</Link></>}>
      <GoogleButton onError={setErr} />
      <form onSubmit={submit} className="space-y-3">
        <input className={inputCls} type="email" required placeholder={translate("Email")} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <input className={inputCls} type="password" required placeholder={translate("Password")} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <Button type="submit" disabled={busy} className="h-11 w-full">{busy ? translate("Signing in…") : translate("Log in")}</Button>
      </form>
    </AuthCard>
  );
}
