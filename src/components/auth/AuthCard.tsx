import { translate, useLang, LangSwitch } from '@/lib/i18n';
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Logo } from "@/components/site/Logo";
import { lovable } from "@/integrations/lovable/index";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  useLang();
  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="wisen-ambient" aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card/80 p-7 shadow-2xl backdrop-blur-xl sm:p-9">
        <Link to="/" aria-label={translate("Wisen home")} className="mb-6 inline-block"><Logo /></Link>
        <div className="mb-4 flex justify-end"><LangSwitch /></div>
        <h1 className="font-serif text-4xl">{translate(title)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{translate(subtitle)}</p>
        <div className="mt-6">{children}</div>
        <div className="mt-6 text-center text-sm text-muted-foreground">{translate(footer)}</div>
      </div>
    </div>
  );
}

export async function googleSignIn(setErr: (e: string) => void) {
  const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/onboarding` });
  if (r.error) setErr(r.error.message ?? "Google sign-in failed.");
}

export function GoogleButton({ onError }: { onError: (e: string) => void }) {
  useLang();
  return (
    <>
      <button type="button" onClick={() => googleSignIn(onError)} className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-background text-sm font-medium hover:bg-accent">
        <svg viewBox="0 0 24 24" className="size-4"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" /></svg>
         {translate("Continue with Google")} </button>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />{translate("or")}<span className="h-px flex-1 bg-border" /></div>
    </>
  );
}

export const inputCls = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary";
