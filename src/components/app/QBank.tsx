import { AlertTriangle, Bookmark, BookmarkCheck, Check, ChevronLeft, ChevronRight, Clock, FileText, Layers, Loader2, RotateCcw, Sparkles as Wand, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { questions, type Question } from "./data";
import { useServerFn } from "@tanstack/react-start";

import { aiQuestions, extractMaterial, isCorrectOption, reloadAi, useAi, type AiQuestion } from "./ai-store";
import { fetchCurriculumFile, useCurriculum, type CurFile } from "./Curriculum";
import { openPage, uploadPdf } from "./doc";
import { Inline } from "./RichText";
import { emptyScope, resolveScope, ScopePicker, type Scope } from "./ScopePicker";
import { generateQuestions } from "@/lib/ai/study.functions";
import { remoteQuestions } from "./remote";
import { addCard, getState, log, practice, recordQuestion, setTab, toggle, update, useAppState, type AppState, type QSession } from "./store";
import { Button } from "@/components/ui/button";

export const allQuestions = (s: AppState) => [...questions, ...s.customQuestions, ...remoteQuestions(), ...aiQuestions()];
const letters = (q: Question) => q.options.map((_, k) => k).filter((k) => isCorrectOption(q, k)).map((k) => String.fromCharCode(65 + k)).join(", ");

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary";
const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

export function QuestionView({ q, picked: pickedProp, onPick, onNext, onPrev }: { q: Question; picked?: number | null; onPick?: (k: number) => void; onNext?: (() => void) | undefined; onPrev?: (() => void) | undefined }) {
  const s = useAppState();
  const [local, setLocal] = useState<number | null>(null);
  const picked = onPick ? (pickedProp ?? null) : local;
  const done = picked !== null;
  const saved = s.bookmarks.includes(q.id);
  const multi = !!(q as AiQuestion).multi;
  const [draft, setDraft] = useState(0);

  const commit = (v: number) => {
    if (onPick) onPick(v); else setLocal(v);
    recordQuestion(q, v);
    log(`QBank · ${q.subject} · ${q.topic} — ${v === q.answer ? "correct" : "incorrect"}`);
  };
  const pick = (k: number) => {
    if (done) return;
    if (multi) { setDraft((d) => d ^ (1 << k)); return; }
    commit(k);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[11px] uppercase text-primary">EMD · {q.subject}</span>
          <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] uppercase text-muted-foreground">{q.topic}</span>
          <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] uppercase text-muted-foreground">{q.difficulty}</span>
          {(q as AiQuestion).origin && <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] uppercase text-muted-foreground">{multi ? "MCQ · several answers" : "SCQ"}</span>}
        </div>
        <Button size="sm" variant="ghost" onClick={() => { update((st) => ({ ...st, bookmarks: toggle(st.bookmarks, q.id) })); toast(saved ? "Bookmark removed" : "Question bookmarked"); }}>
          {saved ? <BookmarkCheck className="text-primary" /> : <Bookmark />} {saved ? "Bookmarked" : "Bookmark"}
        </Button>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed"><Inline text={q.stem} /></p>
      <div className="mt-5 space-y-2">
        {q.options.map((o, k) => {
          const chosen = multi ? ((done ? picked ?? 0 : draft) >> k) & 1 : k === picked;
          const right = isCorrectOption(q, k);
          const state = !done ? (multi && chosen ? "border-primary bg-primary/5" : "") : right ? "border-primary bg-primary/10" : chosen ? "border-destructive bg-destructive/10" : "opacity-60";
          return (
            <Button variant="outline" key={o + k} onClick={() => pick(k)} className={`h-auto w-full justify-start whitespace-normal px-4 py-3 text-left text-sm ${state}`}>
              <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border font-mono text-xs">{String.fromCharCode(65 + k)}</span>
              <span className="flex-1"><Inline text={o} /></span>
              {done && right && <Check className="size-4 text-primary" />}
              {done && !!chosen && !right && <X className="size-4 text-destructive" />}
            </Button>
          );
        })}
      </div>
      {multi && !done && <Button className="mt-4" disabled={!draft} onClick={() => commit(draft)}>Check answer</Button>}
      {done && (
        <div className="mt-6 space-y-4 text-sm">
          <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4">
            <p className="font-semibold">{picked === q.answer ? "Correct." : "Incorrect."} Why {letters(q)} {multi ? "are" : "is"} right</p>
            <p className="mt-1 text-foreground/85"><Inline text={q.why} /></p>
          </div>
          {q.distractors.some(Boolean) && (
            <div className="space-y-1.5">
              <p className="font-semibold">Why the others are wrong</p>
              {q.distractors.map((d, k) => d && <p key={k} className="text-muted-foreground"><span className="font-mono text-foreground">{String.fromCharCode(65 + k)}.</span> {d}</p>)}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {(q as AiQuestion).origin ? (q.source ? <span className="rounded-md border border-border px-2 py-1 font-mono text-xs text-primary">Source · {q.source}</span> : null) : q.source ? (
              <button onClick={() => openPage(q.slide)} className="rounded-md border border-border px-2 py-1 font-mono text-xs text-primary hover:bg-accent">Reference · {q.source} · Page {q.slide}</button>
            ) : (
              <span className="rounded-md border border-border px-2 py-1 font-mono text-xs text-primary">Reference · {q.subject} · Slide {q.slide}</span>
            )}
            <Button size="sm" variant="outline" onClick={() => { addCard(q.stem, multi ? q.options.filter((_, k) => isCorrectOption(q, k)).join(" · ") : q.options[q.answer] ?? "", q.why, q.topic, q.source); toast("Saved as Kapsule"); }}><Layers /> Save as Kapsule</Button>
          </div>
        </div>
      )}
      {(onPrev || onNext) && (
        <div className="mt-6 flex justify-between border-t border-border pt-4">
          <Button size="sm" variant="ghost" disabled={!onPrev} onClick={onPrev}><ChevronLeft /> Previous</Button>
          <Button size="sm" disabled={!onNext} onClick={onNext}>Next <ChevronRight /></Button>
        </div>
      )}
    </div>
  );
}

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

function filtered(pool: Question[], f: Pick<QSession, "subject" | "lesson" | "difficulty">) {
  return pool.filter((q) => (f.subject === "All" || q.subject === f.subject) && (f.lesson === "All" || q.topic === f.lesson) && (f.difficulty === "All" || q.difficulty === f.difficulty));
}

export function QBank(props: { context?: string | undefined; defaultSubject?: string; source?: "ai" | "faculty" | "past" }) {
  if (props.source === "past") return <PastEmds />;
  if (props.source === "faculty") return <Practice {...props} />;
  if (props.source === "ai") return <div className="space-y-4"><AiGenerator /><Practice {...props} /></div>;
  return <LegacyQBank {...props} />;
}
function LegacyQBank(props: { context?: string | undefined; defaultSubject?: string }) {
  const [tab, setTabQ] = useState<"ai" | "emd">("ai");
  const t = (k: typeof tab, l: string) => <button onClick={() => setTabQ(k)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{l}</button>;
  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <div className="inline-flex gap-1 rounded-lg border border-border bg-card p-1">{t("ai", "Generated by Wisen AI")}{t("emd", "Previous-year EMDs")}</div>
      {tab === "ai" ? <><AiGenerator /><Practice {...props} /></> : <PastEmds />}
    </div>
  );
}

function AiGenerator() {
  const { tree, signedIn } = useCurriculum();
  const [sc, setSc] = useState<Scope>(emptyScope);
  const [qtype, setQtype] = useState<"SCQ" | "MCQ">("SCQ");
  const [difficulty, setDiff] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState<string | null>(null);
  const gen = useServerFn(generateQuestions);
  const run = async () => {
    const r = resolveScope(tree, sc);
    if (!r.files.length) { toast.error("No course files in this selection yet."); return; }
    try {
      setBusy("Reading course files…");
      const material = await extractMaterial(r.files, sc.f ? 1 : 6, (d, n) => setBusy(`Reading course files ${d}/${n}…`));
      if (!material.length) { toast.error("These files have no readable text (they may be scanned or not PDFs)."); return; }
      setBusy("Wisen AI is writing your questions…");
      const rows = await gen({ data: { mode: "qbank", qtype, difficulty, count, subject: r.subject, unit: r.unit, lesson: r.lesson, material } });
      await reloadAi();
      const topic = r.lesson || r.unit || r.subject;
      update((st) => ({ ...st, qbank: { subject: r.subject, lesson: topic, difficulty: "All", order: rows.map((x) => `ai-${x.id}`), i: 0, answers: {}, startedAt: Date.now() } }));
      log(`Wisen AI generated ${rows.length} ${qtype} · ${r.label}`);
      toast(`${rows.length} questions generated and saved to your account`);
    } catch (e) { toast.error((e as Error).message || "Generation failed"); } finally { setBusy(null); }
  };
  if (!signedIn) return <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Sign in to generate questions from your faculty courses with Wisen AI.</div>;
  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold"><Wand className="size-4 text-primary" /> Generate questions with Wisen AI <span className="font-normal text-muted-foreground">· based strictly on your course files</span></p>
      <ScopePicker tree={tree} value={sc} onChange={setSc} />
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Question type" className={sel} value={qtype} onChange={(e) => setQtype(e.target.value as "SCQ" | "MCQ")}><option value="SCQ">SCQ · one answer</option><option value="MCQ">MCQ · several answers</option></select>
        <select aria-label="Difficulty level" className={sel} value={difficulty} onChange={(e) => setDiff(e.target.value as typeof difficulty)}>{["Easy", "Medium", "Hard"].map((d) => <option key={d}>{d}</option>)}</select>
        <select aria-label="Number of questions" className={sel} value={count} onChange={(e) => setCount(Number(e.target.value))}>{[5, 10, 15].map((n) => <option key={n} value={n}>{n} questions</option>)}</select>
        <Button size="sm" disabled={!sc.s || !!busy} onClick={() => void run()}>{busy ? <Loader2 className="animate-spin" /> : <Wand />} Generate</Button>
        {busy && <span className="text-xs text-muted-foreground">{busy}</span>}
      </div>
    </div>
  );
}

function PastEmds() {
  const { tree, signedIn } = useCurriculum();
  const [opening, setOpening] = useState<string | null>(null);
  const open = async (f: CurFile, subject: string) => {
    setOpening(f.id);
    try { const r = await uploadPdf(await fetchCurriculumFile(f), subject, () => undefined); if (r.error) toast.error(r.error); else setTab("workspace"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't open this file."); } finally { setOpening(null); }
  };
  const subs = (tree ?? []).filter((x) => x.emds.length);
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="font-semibold">Previous-year EMDs</p>
      <p className="mt-1 text-sm text-muted-foreground">Real past exams added by the Wisen team. Kept separate from AI-generated questions.</p>
      {!signedIn ? <p className="mt-4 text-sm text-muted-foreground">Sign in to see previous-year EMDs.</p>
        : !subs.length ? <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No previous-year EMDs have been added yet. They'll appear here as soon as the team uploads them.</p>
        : subs.map((x) => (
          <div key={x.id} className="mt-4">
            <p className="font-mono text-[11px] uppercase text-primary">{x.name}</p>
            {x.emds.map((f) => <button key={f.id} onClick={() => void open(f, x.name)} className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent">{opening === f.id ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4 text-primary" />}<span className="truncate">{f.file_name}</span></button>)}
          </div>
        ))}
    </div>
  );
}

function Practice({ context, defaultSubject, source }: { context?: string | undefined; defaultSubject?: string; source?: "ai" | "faculty" | "past" }) {
  const s = useAppState();
  const ai = useAi();
  const faculty = remoteQuestions();
  const pool = useMemo(() => source === "faculty" ? faculty : source === "ai" ? [...s.customQuestions, ...ai.qs] : [...questions, ...s.customQuestions, ...ai.qs], [source, faculty, s.customQuestions, ai.qs]);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);

  const session: QSession = s.qbank ?? { subject: defaultSubject ?? "All", lesson: "All", difficulty: "All", order: [], i: 0, answers: {}, startedAt: Date.now() };
  // Build the question order lazily when filters change (targeted practice sets order: []).
  useEffect(() => {
    const cur = getState().qbank;
    if (cur && cur.order.length) return;
    const base = cur ?? session;
    const order = shuffle(filtered(pool, base)).map((q) => q.id);
    if (!order.length) return;
    update((st) => ({ ...st, qbank: { ...base, order, i: 0, answers: base.answers, startedAt: base.startedAt || Date.now() } }));
  }, [s.qbank, pool]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (patch: Partial<QSession>) => {
    const f = { ...session, ...patch };
    if (patch.subject) f.lesson = "All";
    update((st) => ({ ...st, qbank: { ...f, order: shuffle(filtered(pool, f)).map((q) => q.id), i: 0, answers: {}, startedAt: Date.now() } }));
  };
  const setI = (i: number) => update((st) => ({ ...st, qbank: st.qbank && { ...st.qbank, i } }));

  const subjects = [...new Set(pool.map((q) => q.subject))];
  const lessons = [...new Set(pool.filter((q) => session.subject === "All" || q.subject === session.subject).map((q) => q.topic))];
  const list = session.order.map((id) => pool.find((q) => q.id === id)).filter((q): q is Question => !!q);
  const q = list[Math.min(session.i, list.length - 1)];
  const answered = Object.keys(session.answers).filter((id) => session.order.includes(id));
  const correct = answered.filter((id) => pool.find((x) => x.id === id)?.answer === session.answers[id]).length;
  const elapsed = Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000));

  const stats = Object.entries(s.attempts).map(([t, a]) => ({ t, pct: Math.round((a.correct / a.total) * 100), n: a.total, subject: pool.find((x) => x.topic === t)?.subject ?? "Course" })).sort((a, b) => a.pct - b.pct);
  const weak = stats[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <select aria-label="Subject" value={session.subject} onChange={(e) => setFilter({ subject: e.target.value })} className={sel}><option value="All">All subjects</option>{subjects.map((x) => <option key={x}>{x}</option>)}</select>
          <select aria-label="Lesson" value={session.lesson} onChange={(e) => setFilter({ lesson: e.target.value })} className={sel}><option value="All">All lessons</option>{lessons.map((x) => <option key={x}>{x}</option>)}</select>
          <select aria-label="Difficulty" value={session.difficulty} onChange={(e) => setFilter({ difficulty: e.target.value })} className={sel}>{["All", "Easy", "Medium", "Hard"].map((x) => <option key={x} value={x}>{x === "All" ? "Any difficulty" : x}</option>)}</select>
          <span className="ml-auto flex items-center gap-1.5 font-mono text-sm"><Clock className="size-4 text-primary" />{fmt(elapsed)}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className="font-mono text-muted-foreground">{list.length ? `Question ${Math.min(session.i, list.length - 1) + 1} of ${list.length}` : "No questions"} · {answered.length} answered · {correct} correct{context && ` · ${context}`}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setFilter({})}><RotateCcw /> New session</Button>
          </div>
        </div>
        {q ? (
          <QuestionView key={q.id} q={q} picked={session.answers[q.id] ?? null} onPick={(k) => update((st) => ({ ...st, qbank: st.qbank && { ...st.qbank, answers: { ...st.qbank.answers, [q.id]: k } } }))} onPrev={session.i > 0 ? () => setI(session.i - 1) : undefined} onNext={session.i < list.length - 1 ? () => setI(session.i + 1) : undefined} />
        ) : (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">No questions match these filters yet. Try another subject, lesson or difficulty.</div>
        )}
        {list.length > 0 && session.i === list.length - 1 && answered.length === list.length && (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">Session complete — {correct}/{list.length} correct ({Math.round((correct / list.length) * 100)}%) in {fmt(elapsed)}. <button className="font-semibold text-primary underline-offset-2 hover:underline" onClick={() => setFilter({})}>Start a new session</button></div>
        )}
      </div>
      <aside className="space-y-3">
        {weak && weak.pct < 65 && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 text-destructive" /> Weak area detected</p>
            <p className="mt-1 text-muted-foreground">{weak.subject}: {weak.t} — {weak.pct}% accuracy</p>
            <Button size="sm" className="mt-3 w-full" onClick={() => practice(weak.subject, weak.t)}>Practice this weak area</Button>
          </div>
        )}
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="mb-3 font-semibold">Performance by lesson</p>
          {stats.map((a) => (
            <button key={a.t} onClick={() => practice(a.subject, a.t)} className="mb-2 block w-full rounded-md p-1 text-left hover:bg-accent">
              <div className="flex justify-between text-xs"><span>{a.t}</span><span className="font-mono">{a.pct}%</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-muted"><div className={`h-full rounded-full ${a.pct < 65 ? "bg-destructive/80" : "bg-primary"}`} style={{ width: `${a.pct}%` }} /></div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
