import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AuthCard } from "@/components/auth/AuthCard";
import { DEFAULTS, ProfileFields, type Fields } from "@/components/auth/ProfileFields";
import { Button } from "@/components/ui/button";
import { saveProfile, useSession } from "@/lib/profile";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set up your profile — Wisen" },
      { name: "description", content: "Tell Wisen your department, year and exam target." },
      { property: "og:title", content: "Set up your profile — Wisen" },
      { property: "og:description", content: "Personalize Wisen to your academic year." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const nav = useNavigate();
  const { user, profile, loading } = useSession();
  const [v, setV] = useState<Fields>(DEFAULTS);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (profile?.onboarded) nav({ to: "/dashboard" });
  }, [loading, user, profile, nav]);

  if (loading || !user || profile?.onboarded) return <div className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">Loading…</div>;

  const finish = async () => {
    setBusy(true); setErr("");
    try {
      await saveProfile(user, { ...v, full_name: profile?.full_name || (user.user_metadata?.["full_name"] as string) || (user.user_metadata?.["name"] as string) || "", onboarded: true });
      nav({ to: "/dashboard" });
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <AuthCard title="Your academic profile" subtitle="So Wisen can focus on what you're studying now. You can change this anytime." footer={<span>Signed in as {user.email}</span>}>
      <ProfileFields v={v} onChange={setV} />
      {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
      <Button onClick={finish} disabled={busy} className="mt-6 h-11 w-full">{busy ? "Saving…" : "Start studying"}</Button>
    </AuthCard>
  );
}
