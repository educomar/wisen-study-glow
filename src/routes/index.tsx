import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BrainCircuit, Check, Moon, Sparkles, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import darkLogo from "@/assets/wisen-logo-dark.png.asset.json";
import lightLogo from "@/assets/wisen-logo-light.png.asset.json";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wisen — Study smarter. Remember longer." },
      {
        name: "description",
        content:
          "Focused medical practice, clear AI explanations, and lasting knowledge for medical students.",
      },
      { property: "og:title", content: "Wisen — Study smarter. Remember longer." },
      {
        property: "og:description",
        content: "Turn your medical study time into focused practice and lasting knowledge.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const specialties = [
  "Cardiology",
  "Pharmacology",
  "Pathology",
  "Microbiology",
  "Surgery",
  "Anatomy",
];

const answers = [
  "Anterior STEMI",
  "Inferior STEMI",
  "Posterior STEMI",
  "Unstable angina",
];

function Index() {
  const [dark, setDark] = useState(false);
  const [answer, setAnswer] = useState(1);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(preferred);
    document.documentElement.classList.toggle("dark", preferred);
  }, []);

  const toggleTheme = () => {
    setDark((current) => {
      document.documentElement.classList.toggle("dark", !current);
      return !current;
    });
  };

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="wisen-ambient" aria-hidden="true" />

      <header className="relative z-20 border-b border-border/70">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <a href="#top" aria-label="Wisen home" className="shrink-0">
            <picture>
              <source media="(prefers-color-scheme: dark)" srcSet={dark ? darkLogo.url : lightLogo.url} />
              <img src={dark ? darkLogo.url : lightLogo.url} alt="Wisen" className="h-10 w-auto sm:h-12" />
            </picture>
          </a>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              title={dark ? "Light mode" : "Dark mode"}
              className="rounded-full border border-border bg-background/70 shadow-sm backdrop-blur"
            >
              {dark ? <Sun /> : <Moon />}
            </Button>
            <Button asChild className="hidden h-10 rounded-md px-5 sm:inline-flex">
              <a href="#question">Get started <ArrowRight /></a>
            </Button>
          </div>
        </div>
      </header>

      <main id="top" className="relative z-10">
        <section className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16 lg:py-20">
          <div className="max-w-2xl animate-fade-in">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground shadow-sm backdrop-blur">
              <Sparkles className="size-3.5 text-primary" /> Built for medical students
            </div>
            <h1 className="font-display text-[clamp(4rem,8vw,7.6rem)] leading-[0.82] tracking-[0] text-foreground">
              Study <em className="text-primary">smarter.</em>
              <br />Remember <em className="text-primary">longer.</em>
            </h1>
            <p className="mt-8 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Turn your medical study time into focused practice, clearer understanding, and lasting knowledge.
            </p>
            <Button asChild size="lg" className="mt-8 h-12 rounded-md px-7 shadow-lg shadow-primary/15">
              <a href="#question">Get started <ArrowRight /></a>
            </Button>
          </div>

          <div id="question" className="relative mx-auto w-full max-w-2xl animate-fade-in lg:rotate-[1.2deg]">
            <div className="absolute -left-5 -top-5 z-10 hidden items-center gap-3 rounded-md border border-border bg-background px-4 py-3 shadow-xl sm:flex">
              <span className="grid size-8 place-items-center rounded-md bg-accent text-primary"><BrainCircuit className="size-4" /></span>
              <span><strong className="block text-xs">AI explanation ready</strong><small className="text-[10px] text-muted-foreground">Evidence-based review</small></span>
            </div>
            <div className="question-shell rounded-md border border-question-border bg-question p-5 text-question-foreground shadow-2xl sm:p-8">
              <div className="mb-6 flex items-center justify-between border-b border-question-border pb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-question-muted">
                <span>USMLE · Cardiology</span><span className="text-question-accent">Question 18 / 40</span>
              </div>
              <p className="mb-3 font-mono text-[11px] text-question-accent">Adaptive practice · 01:42</p>
              <p className="font-mono text-xs leading-6 text-question-foreground/90 sm:text-sm">
                A 58-year-old man presents with crushing chest pain radiating to his left arm. ECG shows ST elevation in leads II, III, and aVF. Which coronary artery is most likely occluded?
              </p>
              <svg className="my-4 h-8 w-36 text-question-accent" viewBox="0 0 144 32" fill="none" aria-label="ECG rhythm">
                <path d="M1 19h37l10-1 10-12 12 23 11-10h19l8-2 7 3 10-1 8-5 10 4" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <div className="space-y-2">
                {answers.map((item, index) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => { setAnswer(index); setShowExplanation(false); }}
                    className={`flex min-h-10 w-full items-center gap-3 rounded-md border px-3 py-2 text-left font-mono text-xs transition-colors ${answer === index ? "border-question-accent/50 bg-question-accent/10 text-question-accent" : "border-transparent text-question-muted hover:border-question-border hover:text-question-foreground"}`}
                  >
                    <span className="grid size-5 shrink-0 place-items-center rounded-full border border-current text-[9px]">{answer === index ? <Check className="size-3" /> : String.fromCharCode(65 + index)}</span>
                    {item}{index === 1 && <span className="ml-auto hidden text-[9px] uppercase sm:inline">RCA occlusion</span>}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-question-border pt-5">
                <button type="button" onClick={() => setShowExplanation((value) => !value)} className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-question-accent">
                  <Sparkles className="size-3.5" /> AI explanation {showExplanation ? "open" : "ready"}
                </button>
                <div className="flex gap-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-question-muted">
                  <span className="rounded-full border border-question-border px-2.5 py-1">High yield</span>
                  <span className="rounded-full border border-question-border px-2.5 py-1">Cardiology</span>
                </div>
              </div>
              {showExplanation && (
                <p className="mt-4 rounded-md border border-question-accent/30 bg-question-accent/10 p-3 font-mono text-[11px] leading-5 text-question-foreground">
                  ST elevation in II, III, and aVF localizes an inferior myocardial infarction, most commonly caused by right coronary artery occlusion.
                </p>
              )}
            </div>
            <div className="absolute -bottom-6 right-4 rounded-md border border-border bg-background px-4 py-3 shadow-xl sm:right-[-1rem]">
              <strong className="block text-sm text-primary">+15% accuracy</strong><small className="text-[10px] text-muted-foreground">Cardiology this week</small>
            </div>
          </div>
        </section>

        <div className="marquee border-y border-primary/20 bg-foreground py-4 text-background">
          <div className="marquee-track">
            {[...specialties, ...specialties].map((item, index) => (
              <span key={`${item}-${index}`} className="flex shrink-0 items-center gap-8 font-mono text-[10px] font-bold uppercase tracking-[0.2em]">
                {item}<span className="text-primary">·</span>
              </span>
            ))}
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border bg-background px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 border-b border-border pb-14 md:grid-cols-[1.5fr_repeat(4,1fr)]">
            <div>
              <img src={dark ? darkLogo.url : lightLogo.url} alt="Wisen" className="h-12 w-auto" />
              <p className="mt-5 max-w-xs font-display text-2xl leading-tight">Study smarter.<br />Remember longer.</p>
            </div>
            {[
              ["Product", "How it works", "Question Bank", "Wisen AI", "Features"],
              ["Resources", "FAQ", "Help", "Contact"],
              ["Company", "About", "Founder"],
              ["Legal", "Privacy Policy", "Terms of Service"],
            ].map(([title, ...links]) => (
              <div key={title}>
                <h2 className="mb-5 text-xs font-bold uppercase tracking-[0.15em]">{title}</h2>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {links.map((link) => <li key={link}><a href="#top" className="transition-colors hover:text-primary">{link}</a></li>)}
                </ul>
              </div>
            ))}
          </div>
          <p className="pt-7 text-xs text-muted-foreground">© 2026 Wisen. Built for medical students.</p>
        </div>
      </footer>
    </div>
  );
}
