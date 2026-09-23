import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  BookMarked,
  BookOpen,
  FolderOpen,
  Quote,
  Sparkles,
} from "lucide-react";

import { Footer } from "@/components/site/Footer";
import { Navbar } from "@/components/site/Navbar";
import { QuestionCard } from "@/components/site/QuestionCard";
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

const features = [
  {
    id: "qbank",
    eyebrow: "Smart QBank",
    icon: BookMarked,
    title: "Practice what matters.",
    body: "Challenge yourself with medical questions organized by subject and topic. See your answers, understand the explanations, and identify what you need to review.",
    tags: ["Medical questions", "Subject-based", "Progress tracking"],
  },
  {
    id: "wisen-ai",
    eyebrow: "Wisen AI",
    icon: Sparkles,
    title: "Your medical study companion.",
    body: "Ask questions about your courses, clarify difficult concepts, and get explanations based on the material you're studying.",
    tags: ["Ask anything", "Course-aware", "Instant explanations"],
  },
  {
    id: "citations",
    eyebrow: "Page-Cited Answers",
    icon: BookOpen,
    title: "Know where the answer came from.",
    body: "Wisen doesn't just give you an answer. It points you back to the exact page in your study material.",
    tags: ["Exact source", "Page citation", "Open the page"],
  },
  {
    id: "materials",
    eyebrow: "Study Materials",
    icon: FolderOpen,
    title: "Your courses. One place.",
    body: "Keep your medical study materials organized and connected to the questions and explanations you use to learn.",
    tags: ["PDFs", "Courses", "Organized material"],
  },
  {
    id: "progress",
    eyebrow: "Progress",
    icon: BarChart3,
    title: "See what you know. Find what you don't.",
    body: "Track your questions, accuracy, subjects, and weak areas so you always know where to focus next.",
    tags: ["Accuracy", "Weak areas", "Study history"],
  },
];

function Index() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="wisen-ambient" aria-hidden="true" />
      <Navbar />

      <main id="top" className="relative z-10">
        {/* HERO */}
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-24">
          <div className="max-w-2xl animate-fade-in">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground shadow-sm backdrop-blur">
              <Sparkles className="size-3.5 text-primary" /> Built for medical students
            </div>
            <h1 className="font-display text-[clamp(3.4rem,7vw,6.6rem)] leading-[0.86] text-foreground">
              Study <em className="text-primary">smarter.</em>
              <br />
              Score <em className="text-primary">higher.</em>
              <br />
              <em className="text-primary">Pass.</em>
            </h1>
            <p className="mt-8 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Wisen turns your medical courses into questions, explanations, and focused study — so
              every study session takes you one step closer to mastery.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 rounded-md px-7 shadow-lg shadow-primary/15">
                <a href="#final-cta">
                  Get started <ArrowRight />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-md px-7">
                <a href="#how-it-works">See how it works</a>
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
                key={`${item}-${index}`}
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
              Four steps to <em className="text-primary">mastery.</em>
            </h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              A simple study loop designed to turn medical content into lasting knowledge.
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
                <h3 className="mt-5 font-display text-2xl leading-tight">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* CORE FEATURES */}
        <section id="features" className="mx-auto max-w-7xl px-5 pb-8 sm:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-[clamp(2.4rem,4.5vw,4rem)] leading-[0.95]">
              Core <em className="text-primary">Features</em>
            </h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              Wisen AI for medical education, built around the way medical students study.
            </p>
          </div>

          <div className="mt-14 space-y-4">
            {features.map((feature, index) => (
              <article
                key={feature.id}
                id={feature.id}
                className="grid scroll-mt-28 gap-6 rounded-lg border border-border bg-card/60 p-6 shadow-sm backdrop-blur sm:p-9 lg:grid-cols-[0.8fr_1.2fr] lg:items-center"
              >
                <div className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-md bg-accent text-primary">
                    <feature.icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      {String(index + 1).padStart(2, "0")} · {feature.eyebrow}
                    </p>
                    <h3 className="mt-2 font-display text-[clamp(1.8rem,2.6vw,2.6rem)] leading-tight">
                      {feature.title}
                    </h3>
                  </div>
                </div>
                <div>
                  <p className="text-base leading-7 text-muted-foreground">{feature.body}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {feature.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* STORY */}
        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <h2 className="font-display text-[clamp(2.4rem,4.5vw,4.2rem)] leading-[0.95]">
              Started as a student problem.
              <br />
              <em className="text-primary">Grew into a platform.</em>
            </h2>
            <div className="space-y-5 text-base leading-7 text-muted-foreground">
              <p>
                Medical school can mean scattered PDFs, endless recordings, lecture notes, question
                banks, and countless tabs — all while trying to remember what actually matters for the
                exam.
              </p>
              <p>
                Wisen started with a simple idea: bring studying, practice, and understanding closer
                together.
              </p>
              <p>
                Instead of searching through pages to find an answer, Wisen helps you practice the
                question, understand the concept, and find the material behind it.
              </p>
            </div>
          </div>
        </section>

        {/* FOUNDER */}
        <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:pb-28">
          <div className="rounded-lg border border-border bg-card/60 p-8 shadow-sm backdrop-blur sm:p-14">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Founder
            </p>
            <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
              <h2 className="font-display text-[clamp(2rem,3.6vw,3.4rem)] leading-tight">
                Built by a student who <em className="text-primary">understands the problem.</em>
              </h2>
              <div className="space-y-5 text-base leading-7 text-muted-foreground">
                <Quote className="size-6 text-primary" />
                <p>
                  I built Wisen because studying medicine should not mean drowning in disorganized
                  PDFs, endless recordings, and last-minute panic.
                </p>
                <p>
                  I experienced the same problem — searching for the right material, trying to
                  practice enough questions, and spending too much time finding where an answer came
                  from.
                </p>
                <p>So I built the platform I wished I had as a medical student.</p>
                <div className="pt-2">
                  <strong className="block text-sm text-foreground">Tebib Omar Abdelkafi</strong>
                  <small className="text-xs text-muted-foreground">Founder &amp; CEO, Wisen</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section id="final-cta" className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-24 sm:px-8">
          <div className="rounded-lg border border-border bg-card/60 px-6 py-16 text-center shadow-sm backdrop-blur sm:px-14 sm:py-20">
            <h2 className="mx-auto max-w-3xl font-display text-[clamp(2.6rem,5vw,4.6rem)] leading-[0.92]">
              Study <em className="text-primary">smarter.</em> Remember{" "}
              <em className="text-primary">longer.</em>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground">
              Turn your medical study time into focused practice, clearer understanding, and lasting
              knowledge.
            </p>
            <Button asChild size="lg" className="mt-9 h-12 rounded-md px-8 shadow-lg shadow-primary/15">
              <a href="#top">
                Get started <ArrowRight />
              </a>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
