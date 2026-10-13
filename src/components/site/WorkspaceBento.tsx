import { translate, useLang } from '@/lib/i18n';
import {
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  FileText,
  Layers3,
  MessageSquareText,
  Sparkles,
} from "lucide-react";

const metrics = [
  { value: "3×", label: "faster EMD prep" },
  { value: "100%", label: "faculty-grounded" },
  { value: "Hours", label: "saved every week" },
];

const compactFeatures = [
  {
    id: "qbank",
    icon: BookOpenCheck,
    title: "Smart EMD QBank",
    body: "Exam-style single best answer vignettes, tagged by subject and rotation, with instant feedback.",
    visual: (
      <div className="mt-auto flex items-center gap-2 pt-5" aria-hidden="true">
        {["A", "B", "C", "D"].map((answer, index) => (
          <span
            key={answer}
            className={`grid size-7 place-items-center rounded-full border font-mono text-[10px] ${
              index === 1 ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
            }`}
          >
            {answer}
          </span>
        ))}
      </div>
    ),
  },
  {
    id: "citations",
    icon: FileText,
    title: "Page-Cited Answers",
    body: "Real citations pinpointing the exact page and paragraph from your Setif faculty courses.",
    visual: (
      <div className="mt-auto rounded-md border border-border bg-background/60 p-3 pt-2 font-mono text-[9px] text-muted-foreground" aria-hidden="true">
        <span className="text-primary">{translate("PAGE 42")}</span>
        <span className="mt-1 block h-1.5 w-full rounded-full bg-muted" />
        <span className="mt-1.5 block h-1.5 w-3/4 rounded-full bg-primary/25" />
      </div>
    ),
  },
  {
    id: "flashcards",
    icon: Layers3,
    title: "Instant Kapsules & Active Recall",
    body: "A spaced repetition engine tuned to your upcoming exam calendar.",
    visual: (
      <div className="mt-auto flex items-end gap-2 pt-5" aria-hidden="true">
        <span className="h-8 flex-1 rounded-sm bg-primary/15" />
        <span className="h-12 flex-1 rounded-sm bg-primary/25" />
        <span className="h-16 flex-1 rounded-sm bg-primary/40" />
        <span className="ml-2 font-mono text-[9px] text-primary">{translate("RECALL")}</span>
      </div>
    ),
  },
  {
    id: "progress",
    icon: BarChart3,
    title: "Progress & Weak Areas",
    body: "Visual progress tracking showing your accuracy per subject so you know where to focus.",
    visual: (
      <div className="mt-auto space-y-2 pt-5" aria-hidden="true">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-4/5 rounded-full bg-primary" /></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-3/5 rounded-full bg-primary" /></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-2/5 rounded-full bg-primary" /></div>
      </div>
    ),
  },
];

export function WorkspaceBento() {
  const { t: translate } = useLang();
  return (
    <section id="features" className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-10 sm:px-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-3xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
             {translate("The Wisen Workspace")} </p>
          <h2 className="mt-4 font-display text-[clamp(2.4rem,4.5vw,4rem)] leading-[0.95]">
            <span className="block">{translate("Everything you need.")}</span>
            <span className="block"><em className="text-primary">{translate("Nothing you don't.")}</em></span>
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
             {translate("Built specifically around how medical students at Faculty of Medicine Setif 1 prepare for EMDs.")} </p>
        </div>

        <div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-lg border border-border bg-card/65 shadow-sm backdrop-blur">
          {metrics.map((metric) => (
            <div key={translate(metric.label)} className="min-w-0 px-3 py-4 text-center sm:px-5">
              <strong className="block font-display text-xl leading-none text-primary sm:text-2xl">{translate(metric.value)}</strong>
              <span className="mt-1.5 block text-[9px] leading-3 text-muted-foreground sm:text-[10px]">{translate(metric.label)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 grid auto-rows-fr gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article id="wisen-ai" className="group relative flex min-h-72 scroll-mt-28 flex-col overflow-hidden rounded-lg border border-border bg-card/70 p-6 shadow-sm backdrop-blur transition-colors hover:border-primary/50 md:col-span-2 lg:row-span-2 lg:min-h-0">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
              <BrainCircuit className="size-5" />
            </span>
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-primary">{translate("Featured workspace")}</span>
          </div>
          <h3 className="mt-5 font-display text-3xl leading-tight">{translate("Parallel Study Workspace")}</h3>
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
             {translate("Read your faculty course slides or polycopié on one side, then quiz and clarify with Wisen AI on the other—without switching tabs.")} </p>

          <div className="mt-7 grid min-h-40 flex-1 grid-cols-2 overflow-hidden rounded-md border border-border bg-background/65" aria-hidden="true">
            <div className="border-r border-border p-4">
              <div className="flex items-center gap-2 font-mono text-[9px] text-muted-foreground">
                <FileText className="size-3.5 text-primary" />  {translate("EMBRYOLOGY.PDF")} </div>
              <div className="mt-4 space-y-2">
                <span className="block h-1.5 w-full rounded-full bg-muted" />
                <span className="block h-1.5 w-10/12 rounded-full bg-muted" />
                <span className="block h-1.5 w-11/12 rounded-full bg-primary/30" />
                <span className="block h-1.5 w-7/12 rounded-full bg-primary/30" />
              </div>
            </div>
            <div className="flex flex-col p-4">
              <div className="flex items-center gap-2 font-mono text-[9px] text-primary">
                <Sparkles className="size-3.5" />  {translate("WISEN AI")} </div>
              <div className="mt-4 rounded-md bg-accent p-3 text-[10px] leading-4 text-muted-foreground">
                 {translate("Explain neurulation from this page.")} </div>
              <div className="mt-auto flex items-center gap-2 border-t border-border pt-3 text-[9px] text-muted-foreground">
                <MessageSquareText className="size-3.5 text-primary" />  {translate("Grounded in page 42")} </div>
            </div>
          </div>
        </article>

        {compactFeatures.map((feature) => (
          <article key={feature.id} id={feature.id} className="flex min-h-64 scroll-mt-28 flex-col rounded-lg border border-border bg-card/70 p-5 shadow-sm backdrop-blur transition-colors hover:border-primary/50">
            <feature.icon className="size-5 text-primary" />
            <h3 className="mt-4 font-display text-xl leading-tight">{translate(feature.title)}</h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{translate(feature.body)}</p>
            {feature.visual}
          </article>
        ))}
      </div>
    </section>
  );
}