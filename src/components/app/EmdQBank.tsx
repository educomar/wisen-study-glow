import { translate, useLang, getLocale } from '@/lib/i18n';
import { Link, useSearch } from "@tanstack/react-router";
import { Mistakes } from "./Mistakes";
import { useServerFn } from "@tanstack/react-start";
import { Archive, ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Check, ClipboardList, FileText, GraduationCap, Layers, Loader2, LogIn, Timer, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Logo } from "@/components/site/Logo";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { generateQuestions } from "@/lib/ai/study.functions";
import { extractMaterial, isCorrectOption, reloadAi, useAi, type AiQuestion } from "./ai-store";
import { useCurriculum, type CurFile } from "./Curriculum";
import type { Question } from "./data";
import { emdYear, isAcceptedAnswer, isPicked, questionCredit, scoreOn20, scoreWith, SCORING, toggleOption, type Scoring } from "./emd-exam";
import { Inline, RichText } from "./RichText";
import { emptyScope, resolveScope, ScopePicker, type Scope } from "./ScopePicker";
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
      <>{q.officialAnswer && <p className="mt-2 text-sm"><strong>{translate("Official answer")}:</strong> {q.officialAnswer}</p>}{q.aiAnswer && <p className="text-sm"><strong>{translate("AI answer")}:</strong> {q.aiAnswer}</p>}</>
      <div className="mt-2 text-sm"><RichText text={q.why || translate("No explanation available.")} /></div>
      {q.distractors.some(Boolean) && <ul className="mt-3 space-y-2 text-sm">{q.distractors.map((comment, i) => comment ? <li key={i}><strong>{L[i]}.</strong> <Inline text={comment} /></li> : null)}</ul>}
      {q.trapPhrase && <div className="mt-3 border-l-2 border-destructive pl-3 text-sm"><p className="flex items-center gap-2 font-semibold"><TriangleAlert className="size-4 text-destructive" /><span dir="rtl">{q.trapPhrase}</span></p>{q.trapExplanation && <RichText text={q.trapExplanation} />}</div>}
      {q.source && <p className="mt-2 text-xs text-muted-foreground">{translate("Source:")} {q.source}</p>}
      <Button size="sm" variant="outline" className="mt-3" onClick={() => { saveKapsule(q); toast.success(translate("Saved as Kapsule")); }}><Layers />  {translate("Save as Kapsule")}</Button>
    </div>
  );
}

/* ---------- instant-feedback practice (Past EMDs + Practice Mode) ---------- */
function PracticeRunner({ qs, title, onExit, initialScoring = "degressive" }: { qs: Question[]; title: string; onExit: () => void; initialScoring?: Scoring }) {
  const { t: translate } = useLang();
  const [scoring, setScoring] = useState<Scoring>(initialScoring);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => qs.map(() => null));
  const [checked, setChecked] = useState<boolean[]>(() => qs.map(() => false));
  const q = qs[i];
  if (!q) return null;
  const toggle = (qi: number, k: number) => !checked[qi] && setAnswers((a) => a.map((x, j) => (j === qi ? toggleOption(x, k, multiOf(qs[qi]!)) : x)));
  const check = () => { recordQuestion(q, answers[i] ?? null); setChecked((c) => c.map((x, j) => (j === i ? true : x))); };
  const done = checked.filter(Boolean).length;
  const credit = (k: number) => questionCredit({ ...qs[k], answer: qs[k]!.answer, picked: answers[k] ?? null, multi: multiOf(qs[k]!) }, scoring);
  const pts = qs.reduce((a, _, k) => a + (checked[k] ? credit(k) : 0), 0);
  const on20 = done ? Math.round((pts / done) * 2000) / 100 : 0;
  const correct = qs.filter((x, k) => checked[k] && isAcceptedAnswer(x, answers[k] ?? null)).length;
  const fmt = (n: number) => (n > 0 ? `+${n.toFixed(2).replace(/0$/, "")}` : "0");
  return (
    <div className="emd-run">
      <div className="emd-run-bar"><Button variant="ghost" size="sm" onClick={onExit}><ArrowLeft />  {translate("Back")}</Button><strong>{translate(title)}</strong>
        <select aria-label={translate("Scoring system")} value={scoring} onChange={(e) => setScoring(e.target.value as Scoring)} className="rounded-md border border-border bg-background px-2 py-1 text-xs">{SCORING.map((o) => <option key={o.key} value={o.key}>{translate(o.label)}</option>)}</select>
        <span>{done}/{qs.length}  {translate("checked ·")} {correct}  {translate("correct")} · <strong>{Math.round(pts * 100) / 100} {translate("pts")} · {on20} / 20</strong></span></div>
      {done === qs.length && <div className="emd-card mx-auto my-3 max-w-3xl text-sm"><strong>{translate("Practice summary")}</strong> — {translate(SCORING.find((o) => o.key === scoring)!.label)}: <strong>{on20} / 20</strong> ({Math.round(pts * 100) / 100} / {qs.length} {translate("pts")}) · {correct}/{qs.length} {translate("correct")}</div>}
      <div className="emd-panes">
        <Grille qs={qs} answers={answers} i={i} onJump={setI} onToggle={toggle} reveal={(k) => checked[k]!} />
        <section className="emd-main">
          <QuestionPane q={q} n={i + 1} total={qs.length} picked={answers[i] ?? null} onToggle={(k) => toggle(i, k)} reveal={!!checked[i]} />
          {checked[i] && <p className={`text-sm font-semibold ${credit(i) >= 1 ? "text-primary" : credit(i) > 0 ? "text-foreground" : "text-destructive"}`}>{translate("Points earned:")} {fmt(credit(i))} <span className="font-normal text-muted-foreground">({translate(SCORING.find((o) => o.key === scoring)!.label)})</span></p>}
          {checked[i] && <Explanation q={q} picked={answers[i] ?? null} />}
          <div className="emd-actions">
            <Button variant="outline" disabled={!i} onClick={() => setI(i - 1)}><ArrowLeft />  {translate("Previous")}</Button>
            {!checked[i] ? <Button disabled={answers[i] === null} onClick={check}>{translate("Submit answer")}</Button> : <Button disabled={i === qs.length - 1} onClick={() => setI(i + 1)}>{translate("Next")} <ArrowRight /></Button>}
          </div>
        </section>
      </div>
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
  const lessonSems = [...new Set(lessons.map((l) => l.sem))].sort();
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
        <div className="pe-row"><span className="pe-label">{translate("Semester")}</span><div className="pe-seg pe-seg-sm">{["", "S1", "S2"].map((v) => <button key={v} type="button" className={sem === v ? "is-on" : ""} onClick={() => setSem(v)}>{v ? semLabel(v) : translate("All")}</button>)}</div></div>
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
                <small>{[x.semester && semLabel(x.semester), translate(x.session === "rattrapage" ? "Rattrapage" : "Normale"), x.emd_number].filter(Boolean).join(" · ")}</small>
                <span className="pe-track"><span style={{ width: `${total ? Math.round((d / total) * 100) : 0}%` }} /></span>
                <span className="pe-foot"><span>{d ? `${d}/${total} ${translate("done")}` : translate("Not started")}</span><b>{total} {translate("questions")}</b></span>
              </button>); })}</div>
          </div>); })
      ) : (
        !lessons.length ? <p className="emd-empty">{translate("No lessons match these filters.")}</p> :
        lessonSems.map((s) => { const group = lessons.filter((l) => l.sem === s); const all = group.every((l) => picked.has(l.id)); return (
          <div key={s} className="pe-group">
            <h3 className="pe-gh">{semLabel(s)}<small>{group.length} {translate("lessons")}</small><span /><button type="button" className="pe-link" onClick={() => setPicked((p) => { const n = new Set(p); group.forEach((l) => all ? n.delete(l.id) : n.add(l.id)); return n; })}>{translate(all ? "Deselect all" : "Select all")}</button></h3>
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

function Simulator({ onBack, initial, setApprovedPool }: { onBack: () => void; initial?: Scope | null; setApprovedPool: (qs: Question[]) => void }) {
  const { t: translate } = useLang();
  const { tree } = useCurriculum();
  const [sc, setSc] = useState<Scope>(initial ?? emptyScope);
  const [mode, setMode] = useState<"practice" | "real">("practice");
  const [count, setCount] = useState(20);
  const [minutes, setMinutes] = useState(60);
  const [scoring, setScoring] = useState<Scoring>("degressive");
  const [busy, setBusy] = useState<string | null>(null);
  const [practiceQs, setPracticeQs] = useState<{ title: string; qs: Question[] } | null>(null);
  const gen = useServerFn(generateQuestions);
  const [approved, setApproved] = useState<{ id: string; title: string; subject_id: string; unit_id: string | null; semester: string }[]>([]);
  useEffect(() => { void supabase.from("exam_sets").select("id,title,subject_id,unit_id,semester").eq("kind", "ai_generated").eq("status", "published").then(({ data }) => setApproved(data ?? [])); }, []);
  const openApproved = async (x: (typeof approved)[number]) => {
    const subject = tree?.find((s) => s.id === x.subject_id); if (!subject) return;
    setBusy(translate("Loading…"));
    try {
      const { data, error } = await supabase.from("exam_set_questions").select("*").eq("set_id", x.id).order("position");
      if (error) throw new Error(error.message);
      const lessons = new Map(subject.units.flatMap((u) => u.lessons.map((l) => [l.id, l.name] as const)));
      const qs: Question[] = (data ?? []).filter((r) => !sc.l || r.lesson_ids.includes(sc.l)).map((r) => {
        const a = r.answers as number[], multi = a.length > 1 || r.format === "QCM_MULTI";
        return { id: `set-${r.id}`, subject: subject.name, topic: r.lesson_ids.map((id) => lessons.get(id)).filter(Boolean).join(" + ") || subject.name,
          difficulty: "Medium", stem: r.stem, options: r.options as string[], answer: multi ? a.reduce((m, b) => m | (1 << b), 0) : a[0] ?? 0,
          ...centralAnswerEvidence(r), why: r.explanation, distractors: r.option_comments as string[], trapPhrase: r.trap_phrase, trapExplanation: r.trap_explanation,
          slide: 0, source: x.title, multi };
      });
      if (!qs.length) throw new Error(translate("No questions in this exam are linked to the selected lesson."));
      if (mode === "practice") setPracticeQs({ title: x.title, qs });
      else {
        setApprovedPool(qs);
        const ids = qs.map((q) => q.id);
        setE({ subject: subject.name, phase: "run", qids: ids, answers: ids.map(() => null), flags: ids.map(() => false), i: 0, minutes, count: qs.length, endsAt: Date.now() + minutes * 60e3, usedSec: 0, scoring });
      }
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const go = async () => {
    const r = resolveScope(tree, sc);
    if (!r.files.length) { toast.error(translate("No course files in this selection yet.")); return; }
    try {
      setBusy("Reading your course files…");
      const material = await extractMaterial(r.files, sc.f ? 1 : 6, (d, n) => setBusy(`Reading course files ${d}/${n}…`));
      if (!material.length) throw new Error("These files have no readable text (they may be scanned).");
      setBusy("Studying previous-year EMDs for style…");
      const pastEmds = (await extractMaterial(r.emds, 3)).map((p) => ({ name: p.name, text: p.text.slice(0, 30000) }));
      setBusy("Wisen AI is building your EMD…");
      const rows = await gen({ data: { mode: "exam", qtype: "MCQ", difficulty: "Medium", count, subject: r.subject, unit: r.unit, lesson: r.lesson, material, pastEmds } });
      await reloadAi();
      const ids = rows.map((x) => `ai-${x.id}`);
      if (mode === "real") {
        setE({ subject: r.subject, phase: "run", qids: ids, answers: ids.map(() => null), flags: ids.map(() => false), i: 0, minutes, count, endsAt: Date.now() + minutes * 60e3, usedSec: 0, scoring });
      } else {
        const set = new Set(ids);
        setPracticeQs({ title: `Practice · ${r.label}`, qs: poolRef.filter((q) => set.has(q.id)) });
      }
    } catch (e) { toast.error((e as Error).message || "Generation failed"); } finally { setBusy(null); }
  };
  if (practiceQs) return <PracticeRunner qs={practiceQs.qs} title={translate(practiceQs.title)} initialScoring={scoring} onExit={() => setPracticeQs(null)} />;
  return (
    <section className="emd-section">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft />  {translate("QBank")}</Button>
      <h2 className="emd-h2">{translate("EMD Simulator")} <small>{translate("UFAS1 Simulation")}</small></h2>
      <p className="emd-sub">{translate("Original QCM questions from your selected course files, modelled on previous-year EMD style — never copied from them.")}</p>
      <div className="emd-modes">
        {([["practice", GraduationCap, "Practice Mode", "Untimed. Answer one by one; the correct answer and Wisen AI explanation appear after each submission."], ["real", Timer, "Real Exam", "Strict timed simulation with the QCM grille. No answers or hints until you submit."]] as const).map(([k, Icon, t, d]) => (
          <button key={k} type="button" className={`emd-mode ${mode === k ? "is-on" : ""}`} onClick={() => setMode(k)}><Icon /><strong>{translate(t)}</strong><span>{translate(d)}</span></button>
        ))}
      </div>
      {approved.filter((x) => tree?.some((s) => s.id === x.subject_id) && (!sc.s || x.subject_id === sc.s) && (!sc.u || !x.unit_id || x.unit_id === sc.u)).length > 0 && <section className="my-4"><h3 className="mb-2 font-semibold">{translate("Verified Wisen AI exams")}</h3><div className="emd-file-grid">{approved.filter((x) => tree?.some((s) => s.id === x.subject_id) && (!sc.s || x.subject_id === sc.s) && (!sc.u || !x.unit_id || x.unit_id === sc.u)).map((x) => <Button key={x.id} variant="outline" disabled={!!busy} className="h-auto justify-start whitespace-normal py-3" onClick={() => void openApproved(x)}><FileText />{x.title} {x.semester}<ArrowRight /></Button>)}</div></section>}
      <div className="emd-setup">
        <ScopePicker tree={tree} value={sc} onChange={setSc} />
        <div className="emd-setup-row">
          <span>{translate("Questions")}</span><div className="emd-pills">{[10, 20, 30].map((n) => <button key={n} type="button" className={n === count ? "is-on" : ""} onClick={() => { setCount(n); setMinutes(n * 3); }}>{n}</button>)}</div>
          {mode === "real" && <><span>{translate("Duration")}</span><select aria-label={translate("Duration")} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>{[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m}  {translate("min")}</option>)}</select></>}
        </div>
        <fieldset className="emd-card"><legend className="font-semibold">{translate("Choose your scoring system")}</legend>
          {SCORING.map((o) => <label key={o.key} className="flex items-start gap-2 py-1 cursor-pointer"><input type="radio" name="scoring" checked={scoring === o.key} onChange={() => setScoring(o.key)} className="mt-1" /><span><strong>{translate(o.label)}</strong><br /><small className="text-muted-foreground">{translate(o.hint)}</small></span></label>)}
        </fieldset>
        <Button size="lg" className="w-full" disabled={!sc.s || !!busy} onClick={() => void go()}>{busy ? <><Loader2 className="animate-spin" /> {translate(busy)}</> : mode === "real" ? translate("Generate & start Real Exam") : translate("Generate & start practice")}</Button>
      </div>
    </section>
  );
}

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
