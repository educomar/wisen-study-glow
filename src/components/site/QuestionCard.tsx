import { ArrowUpRight, BookOpen, Check, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const options = [
  "Forms the neural tube",
  "Induces neural development",
  "Forms the amnion",
  "Produces trophoblasts",
];

const CORRECT = 1;

export function QuestionCard() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timings = [1400, 1600, 1800, 4200];
    const timer = setTimeout(() => setStage((current) => (current + 1) % 4), timings[stage]);
    return () => clearTimeout(timer);
  }, [stage]);

  const selected = stage >= 1;
  const revealed = stage >= 2;
  const sourced = stage >= 3;

  return (
    <div className="relative mx-auto w-full max-w-2xl animate-fade-in lg:rotate-[1.2deg]">
      <div className="absolute -left-5 -top-5 z-10 hidden items-center gap-3 rounded-md border border-border bg-background px-4 py-3 shadow-xl sm:flex">
        <span className="grid size-8 place-items-center rounded-md bg-accent text-primary">
          <Sparkles className="size-4" />
        </span>
        <span>
          <strong className="block text-xs">AI explanation ready</strong>
          <small className="text-[10px] text-muted-foreground">Grounded in your material</small>
        </span>
      </div>

      <div className="question-shell rounded-md border border-question-border bg-question p-5 text-question-foreground sm:p-8">
        <div className="mb-6 flex items-center justify-between border-b border-question-border pb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-question-muted">
          <span>Question 14 · Embryology</span>
          <span className="text-question-accent">14 / 40</span>
        </div>

        <p className="font-mono text-sm leading-6 text-question-foreground/90">
          What is the main function of the notochord?
        </p>

        <div className="mt-5 space-y-2">
          {options.map((item, index) => {
            const isCorrect = index === CORRECT;
            const active = selected && isCorrect;
            return (
              <div
                key={item}
                className={`flex min-h-10 w-full items-center gap-3 rounded-md border px-3 py-2 font-mono text-xs transition-all duration-500 ${
                  active
                    ? "border-question-accent/60 bg-question-accent/10 text-question-accent"
                    : "border-transparent text-question-muted"
                }`}
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full border border-current text-[9px]">
                  {active ? <Check className="size-3" /> : String.fromCharCode(65 + index)}
                </span>
                {item}
              </div>
            );
          })}
        </div>

        <div className="mt-6 border-t border-question-border pt-5">
          <div
            className={`transition-all duration-500 ${revealed ? "opacity-100" : "pointer-events-none h-0 overflow-hidden opacity-0"}`}
          >
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-question-accent">
              B. Induces neural development
            </p>
            <p className="mt-3 font-mono text-[11px] leading-5 text-question-foreground/85">
              The notochord plays an important role in inducing the overlying ectoderm to form the
              neural plate during neurulation.
            </p>
          </div>

          <div
            className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-question-border bg-question-accent/5 p-3 transition-all duration-500 ${
              sourced ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-md border border-question-border text-question-accent">
                <BookOpen className="size-4" />
              </span>
              <span>
                <small className="block font-mono text-[9px] uppercase tracking-[0.18em] text-question-muted">
                  Source
                </small>
                <strong className="text-xs font-semibold">Embryology · Page 42</strong>
              </span>
            </div>
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-question-accent">
              Open source <ArrowUpRight className="size-3.5" />
            </span>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-6 right-4 rounded-md border border-border bg-background px-4 py-3 shadow-xl sm:right-[-1rem]">
        <strong className="block text-sm text-primary">Page-cited answers</strong>
        <small className="text-[10px] text-muted-foreground">Straight from your course</small>
      </div>
    </div>
  );
}
