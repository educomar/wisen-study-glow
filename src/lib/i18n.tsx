import { useSyncExternalStore } from "react";

import { supabase } from "@/integrations/supabase/client";

export type Lang = "en" | "fr";
const KEY = "wisen-lang";
let current: Lang = "en";
const subs = new Set<() => void>();

if (typeof window !== "undefined") {
  const saved = localStorage.getItem(KEY);
  if (saved === "fr" || saved === "en") current = saved;
}

export const getLang = () => current;

/** Changes the UI language; persists to local storage and (when signed in) the student's profile. */
export function setLang(l: Lang, persist = true) {
  if (l === current) return;
  current = l;
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, l);
    document.documentElement.lang = l;
  }
  subs.forEach((f) => f());
  if (persist) {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void supabase.from("profiles").update({ language: l }).eq("id", data.user.id);
    });
  }
}

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

const FR: Record<string, string> = {
  "Dashboard": "Tableau de bord",
  "Roadmap": "Programme",
  "Workspace": "Espace de travail",
  "Kapsules": "Kapsules",
  "QBank": "QBank",
  "Library": "Bibliothèque",
  "Sign in": "Se connecter",
  "Log in": "Connexion",
  "Get started": "Commencer",
  "How it works": "Fonctionnement",
  "Features": "Fonctionnalités",
  "Wisen AI": "Wisen AI",
  "Profile settings": "Paramètres du profil",
  "Light mode": "Mode clair",
  "Dark mode": "Mode sombre",
  "Your enrolled level": "Votre niveau d'inscription",
  "Built for Faculty of Medicine · UFA Setif 1": "Conçu pour la Faculté de Médecine · UFA Sétif 1",
  "Study": "Étudiez",
  "smarter.": "mieux.",
  "Score": "Visez",
  "higher.": "plus haut.",
  "Pass.": "Réussissez.",
  "hero.body": "Wisen transforme vos cours de médecine en questions, explications et révisions ciblées — chaque séance vous rapproche de la maîtrise.",
  "See how it works": "Voir comment ça marche",
  "Four steps to": "Quatre étapes vers la",
  "mastery.": "maîtrise.",
  "steps.body": "Une boucle d'étude simple pour transformer le contenu médical en connaissances durables.",
  "Your profile": "Votre profil",
  "Full name": "Nom complet",
  "Sign out": "Se déconnecter",
  "Save changes": "Enregistrer",
  "Saving…": "Enregistrement…",
  "Profile updated": "Profil mis à jour",
  "Language": "Langue",
};
const EN: Record<string, string> = {
  "hero.body": "Wisen turns your medical courses into questions, explanations, and focused study — so every study session takes you one step closer to mastery.",
  "steps.body": "A simple study loop designed to turn medical content into lasting knowledge.",
};

export function translate(key: string, l: Lang = current) {
  return l === "fr" ? FR[key] ?? EN[key] ?? key : EN[key] ?? key;
}

export function useLang() {
  const lang = useSyncExternalStore(subscribe, getLang, () => "en" as Lang);
  return { lang, setLang, t: (k: string) => translate(k, lang) };
}

export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang } = useLang();
  return (
    <div role="group" aria-label="Language" className={`inline-flex items-center rounded-full border border-border bg-background/70 p-0.5 text-xs font-semibold ${className}`}>
      {(["en", "fr"] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={`rounded-full px-2.5 py-1 uppercase transition-colors ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
