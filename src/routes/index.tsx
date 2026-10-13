import { useLang, translate } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Landmark,
  Quote,
} from "lucide-react";

import facultyPhoto from "@/assets/faculty-medicine-setif-1-4k.png.asset.json";
import { Footer } from "@/components/site/Footer";
import { Navbar } from "@/components/site/Navbar";
import { QuestionCard } from "@/components/site/QuestionCard";
import { WorkspaceBento } from "@/components/site/WorkspaceBento";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wisen — Study smarter. Score higher. Pass." },
      {
        name: "description",
        content:
          "Wisen turns your medical courses into questions, explanations, and focused study — so every session takes you closer to mastery.",
      },
      { property: "og:title", content: "Wisen — Study smarter. Score higher. Pass." },
      {
        property: "og:description",
        content:
          "Medical question bank, AI explanations, and page-cited answers built for medical students.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const subjects = [
  "Anatomy",
  "Physiology",
  "Microbiology",
  "Histology",
  "Pathology",
  "Cardiology",
  "Pharmacology",
];

const steps = [
  {
    number: "01",
    title: "Choose your topic",
    body: "Pick the subject or topic you want to study and focus your session around what matters most.",
  },
  {
    number: "02",
    title: "Practice with questions",
    body: "Test yourself with focused medical questions and turn passive reading into active recall.",
  },
  {
    number: "03",
    title: "Ask Wisen",
    body: "Stuck on a concept? Ask Wisen for a clear explanation grounded in the material you're studying.",
  },
  {
    number: "04",
    title: "Review and remember",
    body: "Review your weak areas, revisit the source, and reinforce what you've learned.",
  },
];

const storyEvidence = [
  {
    tag: "EMDs",
    title: "Real exam practice",
    body: "Practice questions built around real EMD formats. Train the way you'll actually be tested.",
  },
  {
    tag: "Adaptive",
    title: "Learn what matters",
    body: "Smart repetition built around your weak spots. Turn mistakes into lasting recall.",
  },
  {
    tag: "Free tier",
    title: "No credit card required",
    body: "Start with everything you need — upgrade only when the limits start to bite.",
  },
  {
    tag: "SETIF — FIRST",
    title: "Built in Sétif",
    body: "Priced and localized for the region it was built to serve.",
  },
];

function Index() {
  const { t } = useLang();
  const translate = t;
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="wisen-ambient" aria-hidden="true" />
      <Navbar />

      <main id="top" className="relative z-10">
        {/* HERO */}
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pt-6 pb-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:pt-8 lg:pb-24">
          <div className="max-w-2xl animate-fade-in">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground shadow-sm backdrop-blur">
              <Landmark className="size-3.5 text-primary" /> {t("Built for Faculty of Medicine · UFA Setif 1")}
            </div>
            <h1 className="font-display text-[clamp(2.8rem,6.5vw,6.25rem)] leading-[0.9] text-foreground">
              <span className="block">{t("Study")} <em className="text-primary">{t("smarter.")}</em></span>
              <span className="block whitespace-nowrap">{t("Score")} <em className="higher-highlight text-primary">{t("higher.")}</em></span>
              <span className="block whitespace-nowrap"><em className="text-primary">{t("Pass.")}</em></span>
            </h1>
            <p className="mt-8 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              {t("hero.body")}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 rounded-md px-7 shadow-lg shadow-primary/15">
                <a href="/app">
                  {t("Get started")} <ArrowRight />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-md px-7">
                <a href="#how-it-works">{t("See how it works")}</a>
              </Button>
            </div>
          </div>

          <QuestionCard />
        </section>

        {/* MOVING SUBJECT BAR */}
        <div className="marquee border-y border-primary/20 bg-foreground py-4 text-background">
          <div className="marquee-track">
            {[...subjects, ...subjects].map((item, index) => (
              <span
                key={`${translate(item)}-${index}`}
                className="flex shrink-0 items-center gap-8 font-mono text-[10px] font-bold uppercase tracking-[0.2em]"
              >
                {item}
                <span className="text-primary">·</span>
              </span>
            ))}
          </div>
        </div>

        {/* FOUR STEPS */}
        <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="max-w-2xl">
            <h2 className="font-display text-[clamp(2.4rem,4.5vw,4rem)] leading-[0.95]">
              {t("Four steps to")} <em className="text-primary">{t("mastery.")}</em>
            </h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              {t("steps.body")}
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <article
                key={step.number}
                className="rounded-lg border border-border bg-card/60 p-6 shadow-sm backdrop-blur transition-colors hover:border-primary/40"
              >
                <span className="font-mono text-xs font-bold tracking-[0.2em] text-primary">
                  {step.number}
                </span>
                <h3 className="mt-5 font-display text-2xl leading-tight">{translate(step.title)}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{translate(step.body)}</p>
              </article>
            ))}
          </div>
        </section>

        <WorkspaceBento />

        {/* STORY */}
        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
               {translate("Built as evidence, used since day one")} </p>
            <h2 className="mt-4 font-display text-[clamp(2.4rem,4.5vw,4.2rem)] leading-[0.95]">
               {translate("Started as a student problem.")} <br />
               {translate("Grew into a")} <em className="text-primary">{translate("platform.")}</em>
            </h2>
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch lg:gap-12">
            <div>
              <div className="grid gap-4 sm:grid-cols-2">
                {storyEvidence.map((item) => (
                  <article
                    key={translate(item.tag)}
                    className="min-h-44 rounded-lg border border-border bg-card/60 p-5 shadow-sm backdrop-blur transition-colors hover:border-primary/40"
                  >
                    <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-primary">
                      {item.tag}
                    </span>
                    <h3 className="mt-5 text-base font-bold text-foreground">{translate(item.title)}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{translate(item.body)}</p>
                  </article>
                ))}
              </div>
            </div>

            <figure className="faculty-frame relative min-h-80 overflow-hidden rounded-lg border border-border bg-card/60 p-2 shadow-xl backdrop-blur">
              <div className="relative aspect-[16/10] overflow-hidden rounded-md">
                <img
                  src={facultyPhoto.url}
                  alt={translate("Entrance of the Faculty of Medicine at University Ferhat Abbas Setif 1")}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-foreground/80 px-4 py-4 text-background backdrop-blur-sm sm:px-5">
                  <figcaption className="flex items-start gap-3 text-xs leading-5 sm:text-sm">
                    <Landmark className="mt-0.5 size-4 shrink-0 text-primary" />
                     {translate("Born on the steps of Faculty of Medicine University Ferhat Abbas Setif 1")} </figcaption>
                </div>
              </div>
            </figure>
          </div>
        </section>

        {/* FOUNDER */}
        <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:pb-28">
          <div className="rounded-lg border border-border bg-card/60 p-8 shadow-sm backdrop-blur sm:p-14">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
               {translate("Founder")} </p>
            <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
              <h2 className="font-display text-[clamp(2rem,3.6vw,3.4rem)] leading-tight">
                 {translate("Built by a student who")} <em className="text-primary">{translate("understands the problem.")}</em>
              </h2>
              <div className="space-y-5 text-base leading-7 text-muted-foreground">
                <Quote className="size-6 text-primary" />
                <p>
                   {translate("I built Wisen because studying medicine should not mean drowning in disorganized PDFs, endless recordings, and last-minute panic.")} </p>
                <p>
                   {translate("I experienced the same problem — searching for the right material, trying to practice enough questions, and spending too much time finding where an answer came from.")} </p>
                <p>{translate("So I built the platform I wished I had as a medical student.")}</p>
                <div className="pt-2">
                  <strong className="block text-sm text-foreground">{translate("Tebib Omar Abdelkafi")}</strong>
                  <small className="text-xs text-muted-foreground">{translate("Founder & CEO, Wisen")}</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section id="final-cta" className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-24 sm:px-8">
          <div className="rounded-lg border border-border bg-card/60 px-6 py-16 text-center shadow-sm backdrop-blur sm:px-14 sm:py-20">
            <h2 className="mx-auto max-w-3xl font-display text-[clamp(2.6rem,5vw,4.6rem)] leading-[0.92]">
               {translate("Study")} <em className="text-primary">{translate("smarter.")}</em>  {translate("Remember")}{translate(" ")}
              <em className="text-primary">{translate("longer.")}</em>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground">
               {translate("Turn your medical study time into focused practice, clearer understanding, and lasting knowledge.")} </p>
            <Button asChild size="lg" className="mt-9 h-12 rounded-md px-8 shadow-lg shadow-primary/15">
              <a href="/app">
                 {translate("Get started")} <ArrowRight />
              </a>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
