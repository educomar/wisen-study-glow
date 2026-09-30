import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvite } from "@/lib/team.functions";
import { TeamAuthForm } from "./login";

export const Route = createFileRoute("/team/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Join Wisen Team" },
      { name: "description", content: "Accept your invitation to the Wisen Team." },
      { property: "og:title", content: "Join Wisen Team" },
      { property: "og:description", content: "Accept your Wisen Team invitation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Invite,
});

function Invite() {
  const { token } = Route.useParams();
  const nav = useNavigate();
  const accept = useServerFn(acceptInvite);
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const run = async () => {
    setBusy(true); setErr("");
    try {
      const r = await accept({ data: { token } });
      if (r.ok) nav({ to: "/admin" }); else setErr(r.error ?? "Could not accept the invitation.");
    } catch { setErr("Could not accept the invitation."); }
    setBusy(false);
  };

  useEffect(() => { if (email) void run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [email]);

  if (email === undefined) return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Loading…</div>;
  if (!email) return (
    <AuthCard title="Join Wisen Team" subtitle="Sign in or create an account with the email address this invitation was sent to." footer={<Link to="/" className="hover:underline">Back to Wisen</Link>}>
      <TeamAuthForm next={`/team/invite/${token}`} />
    </AuthCard>
  );
  return (
    <AuthCard title="Join Wisen Team" subtitle={`Signed in as ${email}`} footer={<button className="hover:underline" onClick={() => supabase.auth.signOut()}>Use a different account</button>}>
      {busy && <p className="text-sm text-muted-foreground">Checking your invitation…</p>}
      {err && <><p role="alert" className="text-sm text-destructive">{err}</p><Button className="mt-4 w-full" onClick={run}>Try again</Button></>}
    </AuthCard>
  );
}
