import { translate, useLang, getLocale } from '@/lib/i18n';
import { Link, useSearch } from "@tanstack/react-router";
import { Mistakes } from "./Mistakes";
import { Archive, ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Check, ClipboardList, FileText, GraduationCap, Layers, Loader2, LogIn, Timer, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Logo } from "@/components/site/Logo";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { isCorrectOption, useAi, type AiQuestion } from "./ai-store";
import { useCurriculum, type CurFile } from "./Curriculum";
import type { Question } from "./data";
import { emdYear, isAcceptedAnswer, isPicked, questionCredit, scoreOn20, scoreWith, SCORING, toggleOption, type Scoring } from "./emd-exam";
import { Inline, RichText } from "./RichText";
import { emptyScope, type Scope } from "./ScopePicker";
import { exploreCurriculum, hasSemesters } from "./curriculum-explorer";
import { addCard, getState, log, recordQuestion, update, useAppState, type ExamSession } from "./store";
import { useSession } from "@/lib/profile";

function centralAnswerEvidence(row: { source_data: unknown; answer_variants: unknown; answers: unknown; format: string }) {
  const source = row.source_data && typeof row.source_data === "object" ? row.source_data as Record<string, unknown> : {};
  const variants = Array.isArray(row.answer_variants) ? row.answer_variants as number[][] : [];
  const answers = Array.isArray(row.answers) ? row.answers as number[] : [];
  const multi = answers.length > 1 || row.format === "QCM_MULTI";
  return { acceptedAnswers: variants.map((v) => multi ? v.reduce((m, i) => m | (1 << i), 0) : v[0] ?? 0),
    ...(typeof source["OfficialAnswer"] === "string" ? { officialAnswer: source["OfficialAnswer"] } : {}),
    ...(typeof source["AIAnswer"] === "string" ? { aiAnswer: source["AIAnswer"] } : {}) };
}

const L = ["A", "B", "C", "D", "E", "F"];
const fmt = (sec: number) => `${String(Math.floor(sec / 3600)).padStart(2, "0")}:${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
const multiOf = (q: Question) => !!(q as AiQuestion).multi;
const correctText = (q: Question) => q.options.map((o, k) => (isCorrectOption(q, k) ? `${L[k]}. ${o}` : "")).filter(Boolean).join(" · ");
const saveKapsule = (q: Question) => addCard(q.stem, correctText(q), q.why, q.subject, q.source);
const setE = (patch: Partial<ExamSession>) => update((st) => ({ ...st, exam: { ...st.exam, ...patch } }));

/* ---------- shared pieces ---------- */
function Grille({ qs, answers, i, flags, onJump, onToggle, reveal }: { qs: Question[]; answers: (number | null)[]; i: number; flags?: boolean[]; onJump: (k: number) => void; onToggle?: (qi: number, k: number) => void; reveal?: (qi: number) => boolean }) {
  const { t: translate } = useLang();
  return (
    <aside className="emd-grille" aria-label={translate("QCM answer grid")}>
      <header><h2>{translate("Grille QCM")}</h2><p>{translate("Select answers from the grid or the question. Click a number to jump to it.")}</p></header>
      <div className="emd-grille-table" role="table">
        <div className="emd-grille-row emd-grille-head" role="row"><span>{translate("Q")}</span>{L.slice(0, 5).map((x) => <span key={x}>{translate(x)}</span>)}</div>
        {qs.map((q, qi) => {
          const shown = reveal?.(qi);
          return (
            <div key={q.id} role="row" className={`emd-grille-row ${qi === i ? "is-current" : ""}`}>
              <button type="button" className="emd-grille-num" onClick={() => onJump(qi)} aria-label={translate("Go to question ") + (qi + 1)}>{flags?.[qi] && <Bookmark className="size-3" />}{String(qi + 1).padStart(2, "0")}</button>
              {L.slice(0, 5).map((_, k) => {
                if (k >= q.options.length) return <span key={k} />;
                const on = isPicked(answers[qi] ?? null, k, multiOf(q));
                const cls = shown ? (isCorrectOption(q, k) ? "is-right" : on ? "is-wrong" : "") : on ? "is-on" : "";
                return <button key={k} type="button" disabled={!onToggle || shown} className={`emd-cell ${cls}`} aria-label={translate("Question ") + (qi + 1) + translate(" option ") + (L[k])} aria-pressed={on} onClick={() => onToggle?.(qi, k)} />;
              })}
            </div>
          );
        })}
      </div>
      <footer><span><i className="emd-cell" />{translate("Unanswered")}</span><span><i className="emd-cell is-on" />{translate("Answered")}</span><span><i className="emd-key-current" />{translate("Current")}</span><span><Bookmark className="size-3" />{translate("Marked")}</span></footer>
    </aside>
  );
}

function QuestionPane({ q, n, total, picked, onToggle, reveal }: { q: Question; n: number; total: number; picked: number | null; onToggle?: (k: number) => void; reveal?: boolean }) {
  const { t: translate } = useLang();
  const multi = multiOf(q);
  return (
    <div className="emd-question">
      <div className="emd-question-top"><span className="emd-tag">{q.subject}</span><span className="emd-count">{translate("Q")} <b>{String(n).padStart(2, "0")}</b> / {total}</span></div>
      <h2>{translate("Question")} {String(n).padStart(2, "0")}</h2>
      <p className="emd-stem"><Inline text={q.stem} /></p>
      <p className="emd-hint">{multi ? translate("Select every correct proposition.") : translate("Select one answer.")}</p>
      <ol className="emd-options">
        {q.options.map((o, k) => {
          const on = isPicked(picked, k, multi);
          const cls = reveal ? (isCorrectOption(q, k) ? "is-right" : on ? "is-wrong" : "") : on ? "is-on" : "";
          return (
            <li key={k}><button type="button" disabled={!onToggle || reveal} className={`emd-option ${cls}`} aria-pressed={on} onClick={() => onToggle?.(k)}>
              <span className="emd-letter">{L[k]}</span><span><Inline text={o} /></span>
              {reveal && isCorrectOption(q, k) && <Check className="ml-auto size-4" />}{reveal && on && !isCorrectOption(q, k) && <X className="ml-auto size-4" />}
            </button></li>
          );
        })}
      </ol>
    </div>
  );
}

function Explanation({ q, picked }: { q: Question; picked: number | null }) {
  const { t: translate } = useLang();
  const ok = isAcceptedAnswer(q, picked);
  return (
    <div className={`emd-explain ${ok ? "is-right" : "is-wrong"}`}>
      <p className="font-semibold">{ok ? translate("Correct") : picked === null ? translate("Not answered") : translate("Incorrect")}  {translate("— answer:")} {correctText(q)}</p>
      <>{(q.aiAnswer || q.officialAnswer) && <p className="mt-2 text-sm"><strong>{translate("AI answer")}:</strong> {q.aiAnswer || q.officialAnswer}</p>}</>
      <div className="mt-2 text-sm"><RichText text={q.why || translate("No explanation available.")} /></div>
      {q.distractors.some(Boolean) && <ul className="mt-3 space-y-2 text-sm">{q.distractors.map((comment, i) => comment ? <li key={i}><strong>{L[i]}.</strong> <Inline text={comment} /></li> : null)}</ul>}
      {q.trapPhrase && <div className="mt-3 border-l-2 border-destructive pl-3 text-sm"><p className="flex items-center gap-2 font-semibold"><TriangleAlert className="size-4 text-destructive" /><span dir="rtl">{q.trapPhrase}</span></p>{q.trapExplanation && <RichText text={q.trapExplanation} />}</div>}
      {q.source && <p className="mt-2 text-xs text-muted-foreground">{translate("Source:")} {q.source}</p>}
      <Button size="sm" variant="outline" className="mt-3" onClick={() => { saveKapsule(q); toast.success(translate("Saved as Kapsule")); }}><Layers />  {translate("Save as Kapsule")}</Button>
    </div>
  );
}

/* ---------- instant-feedback practice (Past EMDs + Practice Mode) ---------- */
function PracticeRunner({ qs, title, onExit, initialScoring = "degressive", kind = "past_emd" }: { qs: Question[]; title: string; onExit: () => void; initialScoring?: Scoring; kind?: "past_emd" | "ai_generated" }) {
  const { t: translate } = useLang();
  const [scoring, setScoring] = useState<Scoring>(initialScoring);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => qs.map(() => null));
  const [checked, setChecked] = useState<boolean[]>(() => qs.map(() => false));
  const [flags, setFlags] = useState<boolean[]>(() => qs.map(() => false));
  const q = qs[i];
  if (!q) return null;
  const toggle = (qi: number, k: number) => !checked[qi] && setAnswers((a) => a.map((x, j) => (j === qi ? toggleOption(x, k, multiOf(qs[qi]!)) : x)));
  const check = () => { recordQuestion(q, answers[i] ?? null); setChecked((c) => c.map((x, j) => (j === i ? true : x))); };
  const done = checked.filter(Boolean).length;
  const credit = (k: number) => questionCredit({ ...qs[k], answer: qs[k]!.answer, picked: answers[k] ?? null, multi: multiOf(qs[k]!) }, scoring);
  const pts = qs.reduce((a, _, k) => a + (checked[k] ? credit(k) : 0), 0);
  const on20 = done ? Math.round((pts / done) * 2000) / 100 : 0;
  const correct = qs.filter((x, k) => checked[k] && isAcceptedAnswer(x, answers[k] ?? null)).length;
  const fmtPts = (n: number) => (n > 0 ? `+${n.toFixed(2).replace(/0$/, "")}` : "0");
  const scoringLabel = translate(SCORING.find((o) => o.key === scoring)!.label);
  const state = (qi: number, k: number) => {
    const qq = qs[qi]!; const on = isPicked(answers[qi] ?? null, k, multiOf(qq));
    if (!checked[qi]) return on ? "on" : "";
    const right = isCorrectOption(qq, k);
    return right ? (on ? "right" : "missed") : on ? "wrong" : "omit";
  };
  const multi = multiOf(q); const shown = !!checked[i]; const picked = answers[i] ?? null;
  const ok = shown && isAcceptedAnswer(q, picked);
  const toReview = shown ? q.options.filter((_, k) => ["wrong", "missed"].includes(state(i, k))).length : 0;
  const badge: Record<string, [string, string]> = { right: ["✓", "Correct"], wrong: ["×", "Incorrect, selected by mistake"], missed: ["!", "Missed, this was correct"], omit: ["–", "Correctly left out"] };
  return (
    <div className="pr">
      <header className="pr-head">
        <button type="button" className="pr-back" onClick={onExit}><ArrowLeft className="size-4" />{translate("Back")}</button>
        <div className="pr-title"><strong>{translate(title)}</strong></div>
        <label className="pr-pill"><span>{translate("Scoring:")}</span>
          <select aria-label={translate("Scoring system")} value={scoring} onChange={(e) => setScoring(e.target.value as Scoring)}>{SCORING.map((o) => <option key={o.key} value={o.key}>{translate(o.label)}</option>)}</select></label>
        <div className="pr-stats"><span><b>{done}</b> / {qs.length} {translate("checked")}</span><span><b>{correct}</b> {translate("correct")}</span><span className="pr-score">{Math.round(pts * 100) / 100} {translate("pts")} · {on20} / 20</span></div>
      </header>
      {done === qs.length && <div className="pr-summary"><strong>{translate("Practice summary")}</strong> — {scoringLabel}: <strong>{on20} / 20</strong> · {correct}/{qs.length} {translate("correct")}</div>}
      <div className="pr-body">
        <aside className="pr-grid" aria-label={translate("QCM answer grid")}>
          <h2>{translate("Grille QCM")}</h2>
          <div className="pr-grid-rows">
            <div className="pr-grid-row pr-grid-headrow"><span>{translate("Q")}</span>{L.slice(0, 5).map((x) => <span key={x}>{x}</span>)}</div>
            {qs.map((qq, qi) => (
              <div key={qq.id} className={`pr-grid-row ${qi === i ? "is-current" : ""}`}>
                <button type="button" className="pr-num" onClick={() => setI(qi)} aria-label={translate("Go to question ") + (qi + 1)}>{flags[qi] && <Bookmark className="size-3" />}{String(qi + 1).padStart(2, "0")}</button>
                {L.slice(0, 5).map((_, k) => k >= qq.options.length ? <span key={k} /> : (
                  <button key={k} type="button" disabled={!!checked[qi]} className={`pr-box is-${state(qi, k) || "empty"}`} aria-label={translate("Question ") + (qi + 1) + translate(" option ") + L[k]} onClick={() => toggle(qi, k)}>
                    {["on", "right", "missed"].includes(state(qi, k)) ? "✓" : state(qi, k) === "wrong" ? "×" : ""}</button>))}
              </div>))}
          </div>
          <footer><span><i className="pr-box is-empty" />{translate("Unanswered")}</span><span><i className="pr-box is-right" />{translate("Answered / correct")}</span><span><i className="pr-box is-wrong" />{translate("Wrong")}</span><span><i className="pr-box is-missed" />{translate("Missed")}</span></footer>
        </aside>
        <section className="pr-card">
          <div className="pr-card-top">
            <span className="pr-chip">{q.subject}</span>
            <button type="button" className={`pr-flag ${flags[i] ? "is-on" : ""}`} aria-pressed={!!flags[i]} onClick={() => setFlags((f) => f.map((x, j) => (j === i ? !x : x)))}>{flags[i] ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}{translate("Mark for review")}</button>
            <span className="pr-count">{translate("Q")} <b>{String(i + 1).padStart(2, "0")}</b> / {qs.length}</span>
          </div>
          <h2 className="pr-qtitle">{translate("Question")} {String(i + 1).padStart(2, "0")}</h2>
          <p className="pr-stem"><Inline text={q.stem} /></p>
          <p className="pr-hint">{multi ? translate("Select every correct proposition.") : translate("Select one answer.")}</p>
          <ol className="pr-options">
            {q.options.map((o, k) => { const s = state(i, k); return (
              <li key={k}><button type="button" disabled={shown} className={`pr-opt is-${s || "empty"}`} aria-pressed={isPicked(picked, k, multi)} onClick={() => toggle(i, k)}>
                <span className="pr-letter">{L[k]}</span>
                <span className="pr-opt-body"><span><Inline text={o} /></span>
                  {shown && badge[s] && <span className="pr-badge">{badge[s][0]} {translate(badge[s][1])}</span>}
                  {shown && q.distractors[k] && <span className="pr-why"><b>{translate("Why")}:</b> <Inline text={q.distractors[k]!} /></span>}</span>
              </button></li>); })}
          </ol>
          {shown && <div className={`pr-result ${ok ? "is-right" : "is-wrong"}`}>
            <p className="pr-result-msg">{ok ? translate("Correct, well done") : picked === null ? translate("Not answered") : `${translate("Incorrect,")} ${toReview} ${translate("propositions to review")}`}</p>
            <p className="pr-result-pts">{translate("Points earned:")} <b>{fmtPts(credit(i))}</b> · {scoringLabel}</p>
            <div className="pr-keys">{kind === "ai_generated"
              ? <span>{translate("AI answer")}: <b>{q.aiAnswer || q.officialAnswer || correctText(q)}</b></span>
              : <><span>{translate("Official answer")}: <b>{q.officialAnswer || correctText(q)}</b></span>{q.aiAnswer && <span>{translate("AI answer")}: <b>{q.aiAnswer}</b></span>}</>}</div>
            {q.why && <div className="pr-why-all"><RichText text={q.why} /></div>}
          </div>}
          {shown && q.trapPhrase && <div className="pr-trap"><p><TriangleAlert className="size-4" /><span dir="rtl">{q.trapPhrase}</span></p>{q.trapExplanation && <RichText text={q.trapExplanation} />}</div>}
          {shown && <div className="pr-foot">{q.source && <span>{translate("Source:")} {q.source}</span>}<Button size="sm" variant="outline" onClick={() => { saveKapsule(q); toast.success(translate("Saved as Kapsule")); }}><Layers />{translate("Save as Kapsule")}</Button></div>}
        </section>
      </div>
      <nav className="pr-nav">
        <Button variant="outline" disabled={!i} onClick={() => setI(i - 1)}><ArrowLeft />{translate("Previous")}</Button>
        <span className="pr-nav-hint">{!shown && picked === null ? translate("Select at least one proposition") : ""}</span>
        {!shown ? <Button disabled={picked === null} onClick={check}>{translate("Check answer")}</Button> : <Button disabled={i === qs.length - 1} onClick={() => setI(i + 1)}>{translate("Next")} <ArrowRight /></Button>}
      </nav>
    </div>
  );
}

/* ---------- Past EMDs ---------- */
const PE_COLORS: Record<string, string> = { anatomy: "#F2917B", biochemistry: "#E8C468", biophysics: "#7FB2F0", embryology: "#C79BEF", cytology: "#8FD6A0", ssh: "#F0A3C4" };
const PE_FALLBACK = ["#6FD3C1", "#F5B971", "#9DB4FF", "#E79AD8", "#B6D77A"];
const peColor = (name: string) => PE_COLORS[name.toLowerCase()] ?? PE_FALLBACK[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PE_FALLBACK.length];

function PastEmds({ onBack }: { onBack: () => void }) {
  const { t: translate } = useLang();
  const { tree } = useCurriculum();
  const firstYear = hasSemesters(tree ?? []);
  const history = useAppState().questionResults as Record<string, unknown> | undefined;
  const [mode, setMode] = useState<"full" | "lesson">("full");
  const [mod, setMod] = useState("");
  const [sem, setSem] = useState("");
  const [year, setYear] = useState("All");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [run, setRun] = useState<{ title: string; qs: Question[] } | null>(null);
  type PubSet = { id: string; kind: string; title: string; subject_id: string; unit_id: string | null; resource_id: string | null; exam_year: string; session: string; emd_number: string; semester: string };
  const [sets, setSets] = useState<PubSet[]>([]);
  const [links, setLinks] = useState<{ id: string; set_id: string; lesson_ids: string[] | null }[]>([]);
  useEffect(() => {
    void supabase.from("exam_sets").select("id,kind,title,subject_id,unit_id,resource_id,exam_year,session,emd_number,semester").eq("status", "published").eq("kind", "past_emd").order("exam_year", { ascending: false }).then(({ data }) => {
      const s = (data ?? []) as PubSet[]; setSets(s);
      if (s.length) void supabase.from("exam_set_questions").select("id,set_id,lesson_ids").in("set_id", s.map((x) => x.id)).then(({ data: d }) => setLinks((d ?? []) as typeof links));
    });
  }, []);
  const subjOf = (id: string) => (tree ?? []).find((t) => t.id === id)?.name;
  const moduleOf = (x: PubSet) => subjOf(x.subject_id) ?? "";
  const lessonInfo = useMemo(() => new Map((tree ?? []).flatMap((t) => t.units.flatMap((u) => u.lessons.map((l) => [l.id, { name: l.name, subject: t.name, subjectId: t.id }] as const)))), [tree]);
  const valid = sets.filter((x) => subjOf(x.subject_id));
  const moduleNames = [...new Set(valid.map(moduleOf))].sort();
  const countBySet = new Map<string, number>(); links.forEach((r) => countBySet.set(r.set_id, (countBySet.get(r.set_id) ?? 0) + 1));
  const semOfSet = new Map(valid.map((x) => [x.id, x.semester]));
  const needle = q.trim().toLowerCase();
  const filtered = valid.filter((x) => (!mod || moduleOf(x) === mod) && (!sem || x.semester === sem));
  const years = [...new Set(filtered.map((x) => x.exam_year).filter(Boolean))].sort().reverse();
  const exams = filtered.filter((x) => (year === "All" || x.exam_year === year) && (!needle || [moduleOf(x), x.title, x.exam_year, x.session, x.emd_number].join(" ").toLowerCase().includes(needle)));
  // Lessons: built from published questions' lesson_ids, grouped by semester of their exam.
  const lessonRows = useMemo(() => {
    const m = new Map<string, { id: string; name: string; subject: string; sem: string; count: number }>();
    links.forEach((r) => { const s = semOfSet.get(r.set_id); if (s === undefined) return; (r.lesson_ids ?? []).forEach((id) => { const info = lessonInfo.get(id); if (!info) return; const key = id; const cur = m.get(key) ?? { id, name: info.name, subject: info.subject, sem: s || "", count: 0 }; cur.count++; m.set(key, cur); }); });
    return [...m.values()];
  }, [links, lessonInfo, sets]); // eslint-disable-line react-hooks/exhaustive-deps
  const lessons = lessonRows.filter((l) => (!mod || l.subject === mod) && (!sem || l.sem === sem) && (!needle || `${l.name} ${l.subject}`.toLowerCase().includes(needle)));
  const lessonSems = firstYear ? [...new Set(lessons.map((l) => l.sem))].sort() : [""];
  const pickedCount = lessonRows.filter((l) => picked.has(l.id)).reduce((a, l) => a + l.count, 0);
  const toQuestion = (r: Tables<"exam_set_questions">, x: PubSet | undefined): Question => { const a = r.answers as number[]; const multi = a.length > 1 || r.format === "QCM_MULTI"; const subject = x ? moduleOf(x) : ""; const topics = (r.lesson_ids ?? []).map((id: string) => lessonInfo.get(id)?.name).filter(Boolean).join(" + "); return { id: `set-${r.id}`, subject, topic: topics || subject, difficulty: "Medium", stem: r.stem, options: r.options as string[], answer: multi ? a.reduce((m, b) => m | (1 << b), 0) : a[0] ?? 0, ...centralAnswerEvidence(r), why: r.explanation, distractors: r.option_comments as string[], trapPhrase: r.trap_phrase, trapExplanation: r.trap_explanation, slide: 0, source: x?.title ?? "", multi, origin: "past", unit: x?.exam_year ?? "" } as Question; };
  const openSet = async (x: PubSet) => {
    setBusy(x.id);
    const { data } = await supabase.from("exam_set_questions").select("*").eq("set_id", x.id).order("position");
    setBusy(null);
    const qs = (data ?? []).map((r) => toQuestion(r, x));
    if (!qs.length) { toast.error(translate("This exam has no questions yet.")); return; }
    setRun({ title: `${moduleOf(x)} · ${x.title}`, qs });
    log(`Past EMD opened · ${moduleOf(x)} ${x.title}`);
  };
  const startLessons = async () => {
    const ids = [...picked]; if (!ids.length) return;
    setBusy("lessons");
    const { data } = await supabase.from("exam_set_questions").select("*").in("set_id", valid.map((x) => x.id)).overlaps("lesson_ids", ids).order("position");
    setBusy(null);
    const byId = new Map(valid.map((x) => [x.id, x]));
    const qs = (data ?? []).map((r) => toQuestion(r, byId.get(r.set_id)));
    if (!qs.length) { toast.error(translate("No questions in this exam are linked to the selected lesson.")); return; }
    setRun({ title: `${translate("Practice by lesson")} · ${ids.length}`, qs });
    log(`Past EMD lesson practice · ${ids.length} lessons`);
  };
  const reset = () => { setMod(""); setSem(""); setYear("All"); setQ(""); };
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const semLabel = (v: string) => translate(v === "S1" ? "Semester 1" : v === "S2" ? "Semester 2" : v || "Other");
  const done = (x: PubSet) => { const h = history ?? {}; let n = 0; links.forEach((r) => { if (r.set_id === x.id && h[`set-${r.id}`]) n++; }); return n; };
  if (run) return <PracticeRunner qs={run.qs} title={translate(run.title)} onExit={() => setRun(null)} />;
  return (
    <section className="emd-section pe">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft />  {translate("QBank")}</Button>
      <div className="pe-head">
        <div><h2 className="emd-h2">{translate("Past EMDs")}</h2><p className="emd-sub">{translate("Official previous-year faculty exams. Instant feedback, explanations for every option, and Save as Kapsule.")}</p></div>
        <div className="pe-seg" role="tablist">{(["full", "lesson"] as const).map((m) => <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? "is-on" : ""} onClick={() => setMode(m)}>{translate(m === "full" ? "Full exams" : "Practice by lesson")}</button>)}</div>
      </div>
      <div className="pe-panel">
        <input className="pe-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={translate("Search exams or lessons")} aria-label={translate("Search exams or lessons")} />
        <div className="pe-row"><span className="pe-label">{translate("Module")}</span><div className="pe-chips">
          <button type="button" className={!mod ? "is-on" : ""} onClick={() => setMod("")}>{translate("All modules")}</button>
          {moduleNames.map((n) => <button key={n} type="button" className={mod === n ? "is-on" : ""} onClick={() => { setMod(n); setYear("All"); }}><i style={{ background: peColor(n) }} />{n}</button>)}
        </div></div>
        {firstYear && <div className="pe-row"><span className="pe-label">{translate("Semester")}</span><div className="pe-seg pe-seg-sm">{["", "S1", "S2"].map((v) => <button key={v} type="button" className={sem === v ? "is-on" : ""} onClick={() => setSem(v)}>{v ? semLabel(v) : translate("All")}</button>)}</div></div>}
        {mode === "full" && years.length > 0 && <div className="pe-row"><span className="pe-label">{translate("Year")}</span><div className="pe-chips pe-scroll">{["All", ...years].map((y) => <button key={y} type="button" className={year === y ? "is-on" : ""} onClick={() => setYear(y)}>{y === "All" ? translate("All years") : y}</button>)}</div></div>}
        <div className="pe-results"><span>{mode === "full" ? `${exams.length} ${translate("exams")}` : `${lessons.length} ${translate("lessons")}`}</span><button type="button" onClick={reset}>{translate("Reset filters")}</button></div>
      </div>
      {tree === null ? <p className="emd-empty"><Loader2 className="animate-spin" />  {translate("Loading…")}</p> : mode === "full" ? (
        !exams.length ? <p className="emd-empty">{translate(valid.length ? "No exams match these filters." : "No past EMDs have been added for your modules yet. Your faculty team adds them from the Team dashboard.")}</p> :
        [...new Set(exams.map(moduleOf))].map((m) => { const group = exams.filter((x) => moduleOf(x) === m); return (
          <div key={m} className="pe-group">
            <h3 className="pe-gh"><i style={{ background: peColor(m) }} />{m}<small>{group.length} {translate("exams")}</small><span /></h3>
            <div className="pe-grid">{group.map((x) => { const total = countBySet.get(x.id) ?? 0; const d = done(x); return (
              <button key={x.id} type="button" className="pe-card" disabled={!!busy} onClick={() => void openSet(x)}>
                <span className="pe-tag"><i style={{ background: peColor(m) }} />{m}<em className="pe-go">{busy === x.id ? <Loader2 className="animate-spin" /> : <ArrowRight />}</em></span>
                <strong className="pe-year">{x.exam_year || x.title}</strong>
                <small>{[firstYear && x.semester && semLabel(x.semester), translate(x.session === "rattrapage" ? "Rattrapage" : "Normale"), x.emd_number].filter(Boolean).join(" · ")}</small>
                <span className="pe-track"><span style={{ width: `${total ? Math.round((d / total) * 100) : 0}%` }} /></span>
                <span className="pe-foot"><span>{d ? `${d}/${total} ${translate("done")}` : translate("Not started")}</span><b>{total} {translate("questions")}</b></span>
              </button>); })}</div>
          </div>); })
      ) : (
        !lessons.length ? <p className="emd-empty">{translate("No lessons match these filters.")}</p> :
        lessonSems.map((s) => { const group = lessons.filter((l) => !firstYear || l.sem === s); const all = group.every((l) => picked.has(l.id)); return (
          <div key={s} className="pe-group">
            <h3 className="pe-gh">{firstYear ? semLabel(s) : translate("Lessons")}<small>{group.length} {translate("lessons")}</small><span /><button type="button" className="pe-link" onClick={() => setPicked((p) => { const n = new Set(p); group.forEach((l) => all ? n.delete(l.id) : n.add(l.id)); return n; })}>{translate(all ? "Deselect all" : "Select all")}</button></h3>
            <div className="pe-grid pe-lgrid">{group.map((l) => (
              <button key={l.id} type="button" className={`pe-lcard${picked.has(l.id) ? " is-on" : ""}`} aria-pressed={picked.has(l.id)} onClick={() => toggle(l.id)}>
                <span className="pe-box">{picked.has(l.id) && <Check />}</span>
                <span><strong>{l.name}</strong><small><i style={{ background: peColor(l.subject) }} />{l.subject} · {l.count} {translate("questions")}</small></span>
              </button>))}</div>
          </div>); })
      )}
      {mode === "lesson" && picked.size > 0 && (
        <div className="pe-bar"><span><b>{picked.size}</b> {translate("lessons selected")} · <b>{pickedCount}</b> {translate("questions")}</span>
          <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>{translate("Clear")}</Button>
          <Button size="sm" disabled={busy === "lessons"} onClick={() => void startLessons()}>{busy === "lessons" ? <Loader2 className="animate-spin" /> : null}{translate("Start practice")} <ArrowRight /></Button>
        </div>
      )}
    </section>
  );
}


/* ---------- EMD Simulator ---------- */
function submitExam() {
  const st = getState(); const e = st.exam;
  if (e.phase !== "run") return;
  const pool = getPool();
  const qs = e.qids.map((id) => pool.find((q) => q.id === id)).filter((q): q is Question => !!q);
  qs.forEach((q, k) => recordQuestion(q, e.answers[k] ?? null));
  const r = scoreOn20(qs.map((q, k) => ({ ...q, answer: q.answer, picked: e.answers[k] ?? null })));
  const off = scoreWith(qs.map((q, k) => ({ ...q, answer: q.answer, picked: e.answers[k] ?? null, multi: multiOf(q) })), e.scoring ?? "aon");
  const used = Math.min(e.minutes * 60, Math.round((Date.now() - (e.endsAt - e.minutes * 60e3)) / 1000));
  log(`EMD Simulator · ${e.subject} — ${off}/20`);
  update((s) => ({ ...s, exam: { ...s.exam, phase: "done", usedSec: used }, examHistory: [{ t: Date.now(), subject: e.subject, score: r.correct, total: qs.length }, ...s.examHistory].slice(0, 20) }));
}
let poolRef: Question[] = [];
const getPool = () => poolRef;

type SimRow = Tables<"exam_set_questions"> & { semester: string };
function Simulator({ onBack, initial, setApprovedPool }: { onBack: () => void; initial?: Scope | null; setApprovedPool: (qs: Question[]) => void }) {
  const { t: translate } = useLang();
  const { tree } = useCurriculum();
  const [mode, setMode] = useState<"practice" | "real">("practice");
  const [subj, setSubj] = useState<string>(initial?.s ?? "");
  const [discipline, setDiscipline] = useState(initial?.u ?? "");
  const [sem, setSem] = useState<"" | "S1" | "S2">("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initial?.l ? [initial.l] : []));
  const [q, setQ] = useState("");
  const [count, setCount] = useState(20);
  const [minutes, setMinutes] = useState(60);
  const [scoring, setScoring] = useState<Scoring>("degressive");
  const [moreScoring, setMoreScoring] = useState(false);
  const [rows, setRows] = useState<SimRow[] | null>(null);
  const [practiceQs, setPracticeQs] = useState<{ title: string; qs: Question[] } | null>(null);
  useEffect(() => {
    void (async () => {
      const { data: sets } = await supabase.from("exam_sets").select("id,subject_id,semester").eq("kind", "ai_generated").eq("status", "published");
      const semOf = new Map((sets ?? []).map((x) => [x.id, x.semester ?? ""]));
      if (!semOf.size) { setRows([]); return; }
      const { data } = await supabase.from("exam_set_questions").select("*").in("set_id", [...semOf.keys()]).order("position");
      setRows((data ?? []).map((r) => ({ ...r, semester: semOf.get(r.set_id) ?? "" })));
    })();
  }, []);
  const lessonInfo = useMemo(() => {
    const m = new Map<string, { subject: string; subjectName: string; unit: string; name: string }>();
    tree?.forEach((s) => s.units.forEach((u) => u.lessons.forEach((l) => m.set(l.id, { subject: s.id, subjectName: s.name, unit: u.name, name: l.name }))));
    return m;
  }, [tree]);
  const all = rows ?? [];
  const firstYear = hasSemesters(tree ?? []);
  const subjects = useMemo(() => (firstYear && sem ? exploreCurriculum(tree ?? [], '', sem === 'S1' ? '1' : '2').groups.flatMap(g => g.subjects) : tree ?? []).filter(s => !/deprecated/i.test(s.name) && s.units.some(u => u.lessons.length)), [tree, sem, firstYear]);
  useEffect(() => { if (!subj && subjects[0]) setSubj(subjects[0].id); }, [subjects, subj]);
  const scoped = all.filter((r) => (!sem || r.semester === sem) && r.lesson_ids.some((id) => lessonInfo.get(id)?.subject === subj));
  const hasSem = firstYear;
  const counts = new Map<string, number>();
  scoped.forEach((r) => r.lesson_ids.forEach((id) => { if (lessonInfo.get(id)?.subject === subj) counts.set(id, (counts.get(id) ?? 0) + 1); }));
  const subject = subjects.find((s) => s.id === subj);
  const needle = q.trim().toLowerCase();
  const seenLesson = new Set<string>();
  const groups = [{ name: "", lessons: (subject?.units ?? []).filter(u => firstYear || !discipline || u.id === discipline).flatMap((u) => u.lessons).filter((l) => !seenLesson.has(l.id) && seenLesson.add(l.id) && (!needle || l.name.toLowerCase().includes(needle))) }].filter((g) => g.lessons.length);
  const visibleIds = groups.flatMap((g) => g.lessons.map((l) => l.id));
  const pool = scoped.filter((r) => r.lesson_ids.some((id) => picked.has(id) && visibleIds.includes(id)));
  const max = Math.min(120, pool.length);
  const n = Math.max(1, Math.min(count, max || 1));
  const toggleIds = (ids: string[]) => setPicked((p) => { const nx = new Set(p); const on = ids.every((id) => nx.has(id)); ids.forEach((id) => on ? nx.delete(id) : nx.add(id)); return nx; });
  const changeSubject = (id: string) => { setSubj(id); setDiscipline(""); setPicked(new Set()); setQ(""); };
  const changeSem = (v: "" | "S1" | "S2") => { setSem(v); setSubj(""); setDiscipline(""); setPicked(new Set()); };
  const start = () => {
    if (!subject || !pool.length) return;
    const lessons = new Map(subject.units.flatMap((u) => u.lessons.map((l) => [l.id, l.name] as const)));
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, n);
    const qs: Question[] = shuffled.map((r) => {
      const a = r.answers as number[], multi = a.length > 1 || r.format === "QCM_MULTI";
      return { id: `set-${r.id}`, subject: subject.name, topic: r.lesson_ids.map((id) => lessons.get(id)).filter(Boolean).join(" + ") || subject.name,
        difficulty: "Medium", stem: r.stem, options: r.options as string[], answer: multi ? a.reduce((m, b) => m | (1 << b), 0) : a[0] ?? 0,
        ...centralAnswerEvidence(r), why: r.explanation, distractors: r.option_comments as string[], trapPhrase: r.trap_phrase, trapExplanation: r.trap_explanation,
        slide: 0, source: subject.name, multi } as Question;
    });
    const title = `${subject.name}${sem ? ` · ${semLabelOf(sem, translate)}` : ""}`;
    if (mode === "practice") { setPracticeQs({ title, qs }); return; }
    setApprovedPool(qs);
    const ids = qs.map((x) => x.id);
    setE({ subject: subject.name, phase: "run", qids: ids, answers: ids.map(() => null), flags: ids.map(() => false), i: 0, minutes, count: qs.length, endsAt: Date.now() + minutes * 60e3, usedSec: 0, scoring });
  };
  if (practiceQs) return <PracticeRunner qs={practiceQs.qs} title={practiceQs.title} initialScoring={scoring} kind="ai_generated" onExit={() => setPracticeQs(null)} />;
  const scoringOpt = SCORING.find((o) => o.key === scoring);
  const main = SCORING.filter((o) => o.key === "degressive"), others = SCORING.filter((o) => o.key !== "degressive");
  const scoreCard = (o: (typeof SCORING)[number]) => (
    <label key={o.key} className={`sim-opt ${scoring === o.key ? "is-on" : ""}`}>
      <input type="radio" name="sim-scoring" checked={scoring === o.key} onChange={() => setScoring(o.key)} />
      <span><strong>{translate(o.label)}</strong><small>{translate(o.hint)}</small>
        {o.key === "degressive" && <span className="sim-rules">{["0 errors = 1", "1 error = 0.5", "2 errors = 0.2", "3+ errors = 0"].map((x) => <i key={x}>{translate(x)}</i>)}</span>}</span>
    </label>
  );
  return (
    <section className="emd-section sim">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft />  {translate("QBank")}</Button>
      <h2 className="emd-h2">{translate("EMD Simulator")} <small>{translate("UFAS1 Simulation")}</small></h2>
      <p className="emd-sub">{translate("Verified Wisen AI questions built from your lessons, in previous-year EMD style.")}</p>
      <div className="sim-layout">
        <div className="sim-steps">
          <section className="sim-step"><h3><b>1</b>{translate("Choose a mode")}</h3>
            <div className="sim-modes">
              {([["practice", GraduationCap, "Practice Mode", "Untimed. Answer one by one; the correct answer and Wisen AI explanation appear after each submission."], ["real", Timer, "Real Exam", "Strict timed simulation with the QCM grille. No answers or hints until you submit."]] as const).map(([k, Icon, t, d]) => (
                <button key={k} type="button" className={`sim-mode ${mode === k ? "is-on" : ""}`} onClick={() => setMode(k)} aria-pressed={mode === k}><Icon /><strong>{translate(t)}</strong><span>{translate(d)}</span>{mode === k && <Check className="sim-mode-check" />}</button>
              ))}
            </div>
          </section>
          <section className="sim-step"><h3><b>2</b>{translate("Pick your lessons")}<small>{translate("Select one or several lessons")}</small></h3>
            {rows === null ? <p className="emd-sub"><Loader2 className="inline size-4 animate-spin" /> {translate("Loading…")}</p> : !subjects.length ? <p className="emd-sub">{translate("No lessons are available for your level yet.")}</p> : <>
              {hasSem && <div className="pe-seg pe-seg-sm">{([["", "All"], ["S1", "S1"], ["S2", "S2"]] as const).map(([v, label]) => <Button key={v} variant={sem === v ? "default" : "outline"} aria-pressed={sem === v} onClick={() => changeSem(v)}>{translate(label)}</Button>)}</div>}
              <label className="sim-range"><span>{translate(firstYear ? "Subject" : "Integrated unit")}</span><select className="sim-search" aria-label={translate(firstYear ? "Subject" : "Integrated unit")} value={subj} onChange={e => changeSubject(e.target.value)}>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              {!firstYear && subject && <label className="sim-range"><span>{translate("Subject")}</span><select className="sim-search" aria-label={translate("Subject")} value={discipline} onChange={e => { setDiscipline(e.target.value); setPicked(new Set()); }}><option value="">{translate("All subjects")}</option>{subject.units.map(u => <option key={u.id} value={u.id}>{u.name === subject.name ? translate("Existing lessons") : u.name}</option>)}</select></label>}
              <div className="sim-tools">
                <input className="sim-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={translate("Search a lesson…")} aria-label={translate("Search a lesson…")} />
                <Button variant="outline" size="sm" disabled={!visibleIds.length} onClick={() => toggleIds(visibleIds)}>{visibleIds.length && visibleIds.every((id) => picked.has(id)) ? translate("Deselect all") : translate("Whole subject")}</Button>
              </div>
              {!groups.length ? <p className="emd-sub">{translate("No lessons match.")}</p> : groups.map((g) => {
                const ids = g.lessons.map((l) => l.id), on = ids.every((id) => picked.has(id));
                return <div key={g.name} className="sim-group"><div className="sim-group-h"><span>{translate("Lessons")}</span><button type="button" onClick={() => toggleIds(ids)}>{translate(on ? "Deselect all" : "Select all")}</button></div>
                  <div className="sim-lessons">{g.lessons.map((l) => <button key={l.id} type="button" className={`sim-lesson ${picked.has(l.id) ? "is-on" : ""}`} aria-pressed={picked.has(l.id)} onClick={() => toggleIds([l.id])}><span className="sim-box">{picked.has(l.id) && <Check />}</span>{l.name}<small>{counts.get(l.id) ?? 0}</small></button>)}</div></div>;
              })}
            </>}
          </section>
          <section className="sim-step"><h3><b>3</b>{translate("Set up the session")}</h3>
            <div className="sim-range"><label htmlFor="sim-count">{translate("Number of questions")}</label>
              <div><input id="sim-count" type="range" min={1} max={Math.max(1, max)} value={n} disabled={!max} onChange={(e) => setCount(Number(e.target.value))} />
                <input type="number" min={1} max={Math.max(1, max)} value={n} disabled={!max} aria-label={translate("Number of questions")} onChange={(e) => setCount(Math.max(1, Math.min(max || 1, Number(e.target.value) || 1)))} /></div>
              <small>{max ? `${translate("Available")}: ${pool.length}${pool.length > 120 ? ` (${translate("max")} 120)` : ""}` : translate("Select lessons to see available questions.")}</small></div>
            {mode === "real" && <div className="sim-range"><label htmlFor="sim-min">{translate("Duration")}</label>
              <div><input id="sim-min" type="range" min={1} max={120} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
                <input type="number" min={1} max={120} value={minutes} aria-label={translate("Duration")} onChange={(e) => setMinutes(Math.max(1, Math.min(120, Number(e.target.value) || 1)))} /><em>{translate("min")}</em></div>
              <small>{translate("From 1 to 120 minutes.")}</small></div>}
          </section>
          <section className="sim-step"><h3><b>4</b>{translate("Scoring system")}</h3>
            {main.map(scoreCard)}
            <button type="button" className="sim-more" onClick={() => setMoreScoring((v) => !v)}>{translate(moreScoring ? "Hide other scoring systems" : "Show other scoring systems")}</button>
            {(moreScoring || scoring !== "degressive") && others.map(scoreCard)}
          </section>
        </div>
        <aside className="sim-summary"><h3>{translate("Your session")}</h3>
          <dl>
            <div><dt>{translate("Mode")}</dt><dd>{translate(mode === "real" ? "Real Exam" : "Practice Mode")}</dd></div>
            <div><dt>{translate("Subject")}</dt><dd>{subject?.name ?? "—"}</dd></div>
            <div><dt>{translate("Lessons")}</dt><dd>{picked.size ? picked.size : translate("None selected")}</dd></div>
            <div><dt>{translate("Questions")}</dt><dd>{max ? n : "—"}</dd></div>
            {mode === "real" && <div><dt>{translate("Duration")}</dt><dd>{minutes} {translate("min")}</dd></div>}
            <div><dt>{translate("Scoring")}</dt><dd>{scoringOpt ? translate(scoringOpt.label) : ""}</dd></div>
          </dl>
          <Button size="lg" className="w-full" disabled={!pool.length} onClick={start}>{translate(mode === "real" ? "Start Real Exam" : "Start practice")} <ArrowRight /></Button>
          {!pool.length && <p>{translate("Select at least one lesson to start.")}</p>}
        </aside>
      </div>
    </section>
  );
}
const semLabelOf = (s: string, t: (x: string) => string) => s === "S1" ? t("Semester 1") : s === "S2" ? t("Semester 2") : s;

function RealExam({ qs }: { qs: Question[] }) {
  const { t: translate } = useLang();
  const e = useAppState().exam;
  const [, tick] = useState(0);
  const [review, setReview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const onTick = useCallback(() => { tick((n) => n + 1); const c = getState().exam; if (c.phase === "run" && Date.now() >= c.endsAt) submitExam(); }, []);
  useEffect(() => { const t = setInterval(onTick, 1000); return () => clearInterval(t); }, [onTick]);
  const q = qs[e.i];
  if (!q) return null;
  const left = Math.max(0, Math.round((e.endsAt - Date.now()) / 1000));
  const answered = e.answers.filter((a) => a !== null).length;
  const marked = e.flags.filter(Boolean).length;
  const toggle = (qi: number, k: number) => setE({ answers: e.answers.map((a, j) => (j === qi ? toggleOption(a, k, multiOf(qs[qi]!)) : a)) });
  const pending = qs.map((_, k) => k).filter((k) => e.flags[k] || e.answers[k] === null);
  return (
    <div className="emd-real">
      <header className="emd-real-head">
        <div className="flex items-center gap-4"><Logo className="h-8 w-auto" /><span className="emd-divider" /><strong>{translate("EMD Simulator")}</strong></div>
        <div className="emd-real-stats">
          <span className="emd-progress"><b>{answered}</b> / {qs.length}<i><em style={{ width: `${(answered / qs.length) * 100}%` }} /></i></span>
          <span className={`emd-timer ${left < 300 ? "is-low" : ""}`}><Timer className="size-4" />{fmt(left)}</span>
          <span className="emd-marked"><Bookmark className="size-4" />{marked}  {translate("marked")}</span>
        </div>
      </header>
      <div className="emd-panes">
        <Grille qs={qs} answers={e.answers} i={e.i} flags={e.flags} onJump={(k) => setE({ i: k })} onToggle={toggle} />
        <section className="emd-main">
          <QuestionPane q={q} n={e.i + 1} total={qs.length} picked={e.answers[e.i] ?? null} onToggle={(k) => toggle(e.i, k)} />
          <div className="emd-actions">
            <Button variant="outline" disabled={!e.i} onClick={() => setE({ i: e.i - 1 })}><ArrowLeft />  {translate("Previous")}</Button>
            <Button variant={e.flags[e.i] ? "default" : "outline"} onClick={() => setE({ flags: e.flags.map((f, j) => (j === e.i ? !f : f)) })}>{e.flags[e.i] ? <BookmarkCheck /> : <Bookmark />}{e.flags[e.i] ? translate("Marked") : translate("Mark for review")}</Button>
            <Button variant="outline" disabled={e.i === qs.length - 1} onClick={() => setE({ i: e.i + 1 })}>{translate("Next")} <ArrowRight /></Button>
          </div>
          <div className="emd-footer-bar">
            <Button variant="outline" onClick={() => setReview(true)}><ClipboardList />  {translate("Review Exam")}</Button>
            <Button size="lg" onClick={() => setConfirm(true)}>{translate("Submit Exam")} <ArrowRight /></Button>
          </div>
        </section>
      </div>
      <Dialog open={review} onOpenChange={setReview}>
        <DialogContent>
          <DialogHeader><DialogTitle>{translate("Review exam")}</DialogTitle><DialogDescription>{answered}  {translate("answered ·")} {qs.length - answered}  {translate("unanswered ·")} {marked}  {translate("marked")}</DialogDescription></DialogHeader>
          {pending.length ? <div className="emd-review-list">{pending.map((k) => (
            <button key={k} type="button" onClick={() => { setE({ i: k }); setReview(false); }}><b>{translate("Q")}{String(k + 1).padStart(2, "0")}</b><span>{e.answers[k] === null ? translate("Unanswered") : translate("Answered")}</span>{e.flags[k] && <Bookmark className="size-4" />}</button>
          ))}</div> : <p className="text-sm text-muted-foreground">{translate("Every question is answered and none are marked.")}</p>}
        </DialogContent>
      </Dialog>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{translate("Submit your exam?")}</DialogTitle><DialogDescription>{qs.length - answered ? (qs.length - answered) + translate(" question(s) are still unanswered. ") : translate("")}{translate("You can't change your answers after submitting.")}</DialogDescription></DialogHeader>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirm(false)}>{translate("Keep working")}</Button><Button onClick={() => { setConfirm(false); submitExam(); }}>{translate("Submit Exam")}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Debrief({ qs }: { qs: Question[] }) {
  const { t: translate } = useLang();
  const e = useAppState().exam;
  const r = scoreOn20(qs.map((q, k) => ({ ...q, answer: q.answer, picked: e.answers[k] ?? null })));
  const graded = qs.map((q, k) => ({ ...q, answer: q.answer, picked: e.answers[k] ?? null, multi: multiOf(q) }));
  const sel = e.scoring ?? "aon";
  const all = SCORING.map((o) => ({ ...o, v: scoreWith(graded, o.key) }));
  const official = all.find((o) => o.key === sel)!;
  const mods: Record<string, { c: number; n: number }> = {};
  qs.forEach((q, k) => { const key = q.topic && q.topic !== q.subject ? `${q.subject} · ${q.topic}` : q.subject; const m = (mods[key] ??= { c: 0, n: 0 }); m.n++; if (isAcceptedAnswer(q, e.answers[k] ?? null)) m.c++; });
  const wrong = qs.filter((q, k) => !isAcceptedAnswer(q, e.answers[k] ?? null));
  return (
    <section className="emd-section">
      <div className="emd-score-grid">
        {[["Score", `${official.v} / 20`], ["Accuracy", `${r.accuracy}%`], ["Correct", `${r.correct} / ${r.total}`], ["Time used", fmt(e.usedSec)]].map(([k, v]) => <div key={k}><span>{translate(k)}</span><strong>{v}</strong></div>)}
      </div>
      <div className="emd-card"><h3>{translate("Your Results")}</h3>
        {all.map((o) => <div key={o.key} className={`flex justify-between rounded-md px-3 py-2 ${o.key === sel ? "bg-primary/10 font-semibold" : ""}`}><span>{translate(o.label)}{o.key === sel && " · official"}</span><b>{o.v} / 20</b></div>)}
        <p className="mt-2 text-sm">{translate("Your selected scoring system:")} <strong>{translate(official.label)}</strong>  {translate("— your score:")} <strong>{official.v} / 20</strong></p>
      </div>
      <div className="emd-card"><h3>{translate("Breakdown by module")}</h3>{Object.entries(mods).map(([k, v]) => (
        <div key={k} className="emd-bar"><div><span>{translate(k)}</span><b>{v.c}/{v.n}</b></div><i><em style={{ width: `${(v.c / v.n) * 100}%` }} /></i></div>
      ))}</div>
      <div className="emd-card">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3>{translate("Correction key")}</h3><Button variant="outline" disabled={!wrong.length} onClick={() => { wrong.forEach(saveKapsule); toast.success((wrong.length) + translate(" mistakes saved to Kapsules")); }}><Layers />  {translate("Save mistakes to Kapsules")}</Button></div>
        {qs.map((q, k) => (
          <details key={q.id} className="emd-key" open={!isAcceptedAnswer(q, e.answers[k] ?? null)}>
            <summary><span className={e.answers[k] === q.answer ? "text-primary" : "text-destructive"}>{e.answers[k] === q.answer ? <Check className="size-4" /> : <X className="size-4" />}</span><b>{translate("Q")}{String(k + 1).padStart(2, "0")}</b><Inline text={q.stem} /></summary>
            <QuestionPane q={q} n={k + 1} total={qs.length} picked={e.answers[k] ?? null} reveal />
            <Explanation q={q} picked={e.answers[k] ?? null} />
          </details>
        ))}
      </div>
      <Button variant="outline" onClick={() => setE({ phase: "setup" })}>{translate("New simulation")}</Button>
    </section>
  );
}

/* ---------- page ---------- */
export function EmdQBank() {
  const { t: translate } = useLang();
  const { user } = useSession();
  const { qs: ai } = useAi();
  const [approvedPool, setApprovedPool] = useState<Question[]>([]);
  poolRef = [...ai, ...approvedPool];
  const app = useAppState();
  const e = app.exam;
  const { tree } = useCurriculum();
  useEffect(() => {
    const ids = e.qids.filter((id) => id.startsWith("set-")).map((id) => id.slice(4));
    if (!ids.length || !tree) return;
    let cancelled = false;
    void supabase.from("exam_set_questions").select("*, exam_sets!inner(subject_id,title,kind,status)").in("id", ids).then(({ data }) => {
      if (cancelled) return;
      const restored: Question[] = (data ?? []).flatMap((r) => {
        const exam = r.exam_sets;
        const subject = tree.find((s) => s.id === exam.subject_id);
        if (!subject || exam.status !== "published" || exam.kind !== "ai_generated") return [];
        const a = r.answers as number[], multi = a.length > 1 || r.format === "QCM_MULTI";
        const lessons = new Map(subject.units.flatMap((u) => u.lessons.map((l) => [l.id, l.name] as const)));
        return [{ id: `set-${r.id}`, subject: subject.name, topic: r.lesson_ids.map((id) => lessons.get(id)).filter(Boolean).join(" + ") || subject.name,
          difficulty: "Medium", stem: r.stem, options: r.options as string[], answer: multi ? a.reduce((m, b) => m | (1 << b), 0) : a[0] ?? 0,
          ...centralAnswerEvidence(r), why: r.explanation, distractors: r.option_comments as string[], trapPhrase: r.trap_phrase, trapExplanation: r.trap_explanation,
          slide: 0, source: exam.title, multi }];
      });
      setApprovedPool(restored);
    });
    return () => { cancelled = true; };
  }, [e.qids, tree]);
  const search = useSearch({ strict: false }) as { s?: string; u?: string; l?: string; view?: "mistakes" | "history" };
  const initialScope: Scope | null = search.s ? { ...emptyScope, s: search.s, u: search.u ?? "", l: search.l ?? "" } : null;
  const [view, setView] = useState<"hub" | "past" | "sim" | "mistakes" | "history">(search.view ?? (initialScope ? "sim" : "hub"));
  // A finished exam stays in the persisted state; only show the debrief when the exam was actually run during this visit, so /qbank always opens on the hub. An in-progress exam still resumes.
  const [sawRun, setSawRun] = useState(false);
  useEffect(() => { if (e.phase === "run") setSawRun(true); }, [e.phase]);
  const examQs = useMemo(() => e.qids.map((id) => [...ai, ...approvedPool].find((q) => q.id === id)).filter((q): q is Question => !!q), [e.qids, ai, approvedPool]);
  const realActive = (e.phase === "run" || e.phase === "done") && examQs.length > 0;
  if (!user) return <main className="reference-page emd-page"><div className="tool-signin"><span className="reference-tool-icon"><LogIn /></span><strong>{translate("Sign in to practise EMDs")}</strong><p>{translate("Your exams and results are saved to your account.")}</p><Button asChild><Link to="/login"><LogIn />{translate("Sign in")}</Link></Button></div></main>;
  if (realActive && e.phase === "run") return <RealExam qs={examQs} />;
  const mistakes = Object.values(app.questionResults).filter((r) => !r.correct).length;
  const back = <Button variant="ghost" onClick={() => setView("hub")}><ArrowLeft />{translate("Back to QBank")}</Button>;
  return (
    <main className="reference-page emd-page">
      {realActive && e.phase === "done" && sawRun ? <Debrief qs={examQs} /> : view === "past" ? <PastEmds onBack={() => setView("hub")} /> : view === "sim" ? <Simulator onBack={() => setView("hub")} initial={initialScope} setApprovedPool={setApprovedPool} /> : view === "mistakes" ? (
        <>{back}<header className="tool-page-heading"><span className="tool-kicker">{translate("QBANK · REVIEW")}</span><h1>{translate("My Mistakes")}</h1><p>{translate("Retry the questions you missed and turn them into Kapsules.")}</p></header><Mistakes /></>
      ) : view === "history" ? (
        <>{back}<header className="tool-page-heading"><span className="tool-kicker">{translate("QBANK · ARCHIVE")}</span><h1>{translate("Exam History")}</h1><p>{translate("Every EMD simulation you completed, newest first.")}</p></header>
          {app.examHistory.length ? <ul className="mx-auto max-w-3xl space-y-2">{[...app.examHistory].sort((a, b) => b.t - a.t).map((h) => <li key={`${h.t}-${h.subject}`} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"><div><strong className="block text-sm">{h.subject}</strong><span className="text-xs text-muted-foreground">{new Date(h.t).toLocaleString(getLocale())}</span></div><span className="font-mono text-sm">{h.score}/{h.total} · {h.total ? ((h.score / h.total) * 20).toFixed(1) : translate("0")}/20</span></li>)}</ul> : <p className="py-16 text-center text-sm text-muted-foreground">{translate("No exams yet — sit an EMD simulation to see results here.")}</p>}
        </>
      ) : (
        <>
          <header className="tool-page-heading"><span className="tool-kicker">{translate("QBANK · FACULTY OF MEDICINE SÉTIF 1")}</span><h1>{translate("Train for the")} <em>{translate("EMD.")}</em></h1><p>{translate("Practise real past exams, or sit a full UFAS1 simulation.")}</p></header>
          <div className="emd-choices">
            <button type="button" className="emd-choice" onClick={() => setView("past")}><FileText /><strong>{translate("Past EMDs")}</strong><span>{translate("Previous years' official faculty exams by module and academic year, with instant feedback, explanations and Save as Kapsule.")}</span><em>{translate("Open past EMDs")} <ArrowRight /></em></button>
            <button type="button" className="emd-choice" onClick={() => setView("sim")}><Timer /><strong>{translate("EMD Simulator")}</strong><span>{translate("UFAS1 Simulation in Practice Mode (untimed, explained) or Real Exam (timed QCM grille, debrief out of 20).")}</span><em>{translate("Start a simulation")} <ArrowRight /></em></button>
            <button type="button" className="emd-choice" onClick={() => setView("mistakes")}><TriangleAlert /><strong>{translate("My Mistakes")}</strong><span>{mistakes}  {translate("questions to revisit — retry them quickly and convert them into Kapsules.")}</span><em>{translate("Review mistakes")} <ArrowRight /></em></button>
            <button type="button" className="emd-choice" onClick={() => setView("history")}><Archive /><strong>{translate("Exam History")}</strong><span>{app.examHistory.length}  {translate("completed simulations with scores out of 20.")}</span><em>{translate("Open archive")} <ArrowRight /></em></button>
          </div>
        </>
      )}
    </main>
  );
}
