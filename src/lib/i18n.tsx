import { useSyncExternalStore } from "react";

import { supabase } from "@/integrations/supabase/client";
import french from "./translations.fr.json";
import { Button } from "@/components/ui/button";

export type Lang = "en" | "fr";
const KEY = "wisen-lang";
let current: Lang = "en";
const subs = new Set<() => void>();

export function syncClientLanguage() {
  const saved = localStorage.getItem(KEY);
  if (saved === "fr" || saved === "en") setLang(saved, false);
  document.documentElement.lang = current;
}

export const getLang = () => current;
export const getLocale = () => current === "fr" ? "fr-FR" : "en-GB";

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
  ...french,
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

export function translate(value: string | number | undefined, l: Lang = current): string {
  const key = value === undefined ? "" : String(value);
  if (l === "en") return EN[key] ?? key;
  const trimmed = key.trim();
  const exact = FR[trimmed];
  if (exact) return key.replace(trimmed, exact);
  const progress = trimmed.match(/^(\d+) (questions this week|due today)(.*)$/);
  if (progress) return progress[1] + " " + (progress[2] === "due today" ? "à réviser aujourd’hui" : "questions cette semaine") + progress[3];
  const year = trimmed.match(/^(\d+)(?:st|nd|rd|th) Year$/);
  if (year) return `${year[1]}${year[1] === "1" ? "re" : "e"} année`;
  const reading = trimmed.match(/^Reading (course files|lecture material) (\d+)\/(\d+)…$/);
  if (reading) return `Lecture ${reading[1] === "course files" ? "des fichiers de cours" : "du cours"} ${reading[2]}/${reading[3]}…`;
  const saved = trimmed.match(/^(\d+) (Kapsules saved — ready to study|mistakes saved to Kapsules|questions generated and saved to your account)$/);
  if (saved) return `${saved[1]} ${saved[2] === "mistakes saved to Kapsules" ? "erreurs enregistrées en Kapsules" : saved[2] === "questions generated and saved to your account" ? "questions générées et enregistrées dans votre compte" : "Kapsules enregistrées — prêtes à réviser"}`;
  const unanswered = trimmed.match(/^(\d+) question\(s\) are still unanswered\.$/);
  if (unanswered) return `${unanswered[1]} question(s) restent sans réponse.`;
  const confirmation = trimmed.match(/^We sent a confirmation link to (.+)\.$/);
  if (confirmation) return `Nous avons envoyé un lien de confirmation à ${confirmation[1]}.`;
  return EN[key] ?? key;
}

export function useLang() {
  const lang = useSyncExternalStore(subscribe, getLang, () => "en" as Lang);
  return { lang, setLang, t: (k: string | number | undefined) => translate(k, lang) };
}

export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang } = useLang();
  return (
    <div role="group" aria-label={translate("Language", lang)} className={`inline-flex items-center rounded-full border border-border bg-background/70 p-0.5 text-xs font-semibold ${className}`}>
      {(["en", "fr"] as const).map((l) => (
        <Button
          key={l}
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={`h-auto rounded-full px-2.5 py-1 text-xs uppercase transition-colors ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {l}
        </Button>
      ))}
    </div>
  );
}
