import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, TriangleAlert, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { TRAP_PHRASES, type ExamDraftQuestion } from "@/lib/exam-ingestion";
import { area, inp, sel, useHierarchy } from "./team-context";

export function ExamQuestionCards({ questions, onChange, subjectId, unitId }: { questions: ExamDraftQuestion[]; onChange: (q: ExamDraftQuestion[]) => void; subjectId: string; unitId: string | null }) {
  const { t } = useLang();
  const { data: h } = useHierarchy();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const units = (h?.units ?? []).filter((u) => u.subject_id === subjectId && (!unitId || u.id === unitId));
  const patch = (i: number, p: Partial<ExamDraftQuestion>) => onChange(questions.map((q, k) => k === i ? { ...q, ...p, verified: p.verified ?? false } : q));
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2 text-sm"><strong className="mr-auto">{questions.length} {t("questions")} · {questions.filter((q) => q.verified).length} {t("Verified")}</strong>
      <Button size="sm" variant="outline" onClick={() => setExpanded(new Set(questions.map((_, i) => i)))}>{t("Expand all")}</Button>
      <Button size="sm" variant="outline" onClick={() => setExpanded(new Set())}>{t("Collapse all")}</Button>
    </div>
    {questions.map((q, i) => <article key={i} className={`min-w-0 rounded-lg border bg-card ${q.review_note || !q.answers.length ? "border-destructive/50" : "border-border"}`}>
      <div className="flex items-start gap-2 p-3">
        <Button variant="ghost" size="sm" className="h-auto min-w-0 flex-1 justify-start whitespace-normal text-left" aria-expanded={expanded.has(i)} onClick={() => setExpanded((s) => { const next = new Set(s); if (next.has(i)) next.delete(i); else next.add(i); return next; })}>
          {expanded.has(i) ? <ChevronDown className="shrink-0" /> : <ChevronRight className="shrink-0" />}<span className="min-w-0"><b>Q{i + 1}</b> · {q.format || "QCM"}<span className="ml-2 text-primary">{q.answers.map((a) => "ABCDE"[a]).join(", ") || t("Missing correction")}</span><span className="mt-1 block line-clamp-2 font-normal">{q.stem || t("New question")}</span></span>
        </Button>
        <label className="flex shrink-0 items-center gap-1 pt-2 text-xs"><input type="checkbox" checked={q.verified} disabled={!q.answers.length || q.answer_source === "missing" || !!q.review_note} onChange={(e) => patch(i, { verified: e.target.checked })} />{t("Verified")}</label>
        <Button size="icon" variant="ghost" aria-label={t("Remove question")} onClick={() => { onChange(questions.filter((_, k) => i !== k)); setExpanded(new Set()); }}><Trash2 /></Button>
      </div>
      {q.review_note && <p className="flex gap-2 border-t border-border px-4 py-2 text-xs text-destructive"><TriangleAlert className="size-4 shrink-0" />{q.review_note}</p>}
      {expanded.has(i) && <div className="space-y-3 border-t border-border p-4">
        <label className="block text-xs text-muted-foreground">{t("Question")}<textarea className={area} rows={3} value={q.stem} onChange={(e) => patch(i, { stem: e.target.value })} /></label>
        <div className="flex flex-wrap gap-3">
          <label className="text-xs text-muted-foreground">{t("Question format")}<select className={`${sel} ml-2`} value={q.format} onChange={(e) => patch(i, { format: e.target.value as ExamDraftQuestion["format"] })}>{["", "QCS", "QCM_MULTI", "QCM_REGRP", "CAS_CLIN"].map((f) => <option key={f} value={f}>{f || "QCM"}</option>)}</select></label>
          <label className="text-xs text-muted-foreground">{t("Correction source")}<select className={`${sel} ml-2`} value={q.answer_source} onChange={(e) => patch(i, { answer_source: e.target.value as ExamDraftQuestion["answer_source"] })}><option value="official">{t("Official")}</option><option value="missing">{t("Missing correction")}</option>{q.answer_source === "generated" && <option value="generated">{t("AI-generated")}</option>}</select></label>
        </div>
        {q.options.map((option, k) => <div key={k} className="grid min-w-0 grid-cols-[2rem_1fr_2rem] items-start gap-2">
          <Button size="sm" variant={q.answers.includes(k) ? "default" : "outline"} aria-label={`${t("Official correction")} ${"ABCDE"[k]}`} aria-pressed={q.answers.includes(k)} onClick={() => patch(i, { answers: q.answers.includes(k) ? q.answers.filter((a) => a !== k) : q.format === "QCS" ? [k] : [...q.answers, k].sort(), answer_source: q.answer_source === "generated" ? "generated" : "official" })}>{"ABCDE"[k]}</Button>
          <div className="min-w-0 space-y-1"><input aria-label={`${t("Option")} ${"ABCDE"[k]}`} className={inp} value={option} onChange={(e) => patch(i, { options: q.options.map((o, n) => n === k ? e.target.value : o) })} /><textarea aria-label={`${t("Option comment")} ${"ABCDE"[k]}`} className={area} rows={2} value={q.option_comments[k] ?? ""} placeholder={t("Option comment")} onChange={(e) => patch(i, { option_comments: q.options.map((_, n) => n === k ? e.target.value : q.option_comments[n] ?? "") })} /></div>
          <Button size="icon" variant="ghost" disabled={q.options.length <= 2} aria-label={t("Remove option")} onClick={() => patch(i, { options: q.options.filter((_, n) => n !== k), option_comments: q.option_comments.filter((_, n) => n !== k), answers: q.answers.filter((a) => a !== k).map((a) => a > k ? a - 1 : a) })}><X /></Button>
        </div>)}
        {q.options.length < 5 && <Button size="sm" variant="ghost" onClick={() => patch(i, { options: [...q.options, ""], option_comments: [...q.option_comments, ""] })}><Plus />{t("Option")}</Button>}
        <label className="block text-xs text-muted-foreground">{t("Explanation")}<textarea className={area} rows={3} value={q.explanation} onChange={(e) => patch(i, { explanation: e.target.value })} /></label>
        <div className="flex flex-wrap items-center gap-2"><TriangleAlert className="size-4 text-destructive" /><select aria-label={t("Exam trap")} className={`${sel} max-w-full`} value={q.trap_phrase} onChange={(e) => patch(i, { trap_phrase: e.target.value as ExamDraftQuestion["trap_phrase"] })}><option value="">{t("No exam trap")}</option>{TRAP_PHRASES.map((p) => <option key={p}>{p}</option>)}</select></div>
        {q.trap_phrase && <textarea className={area} rows={2} aria-label={t("Trap explanation")} value={q.trap_explanation} onChange={(e) => patch(i, { trap_explanation: e.target.value })} />}
        <details className="border-t border-border pt-2"><summary className="cursor-pointer text-sm">{t("Lessons")} ({q.lesson_ids.length})</summary><div className="mt-2 max-h-56 overflow-y-auto">{units.map((u) => <div key={u.id}><strong className="text-xs">{u.name}</strong>{h?.lessons.filter((l) => l.unit_id === u.id).map((l) => <label key={l.id} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={q.lesson_ids.includes(l.id)} onChange={(e) => patch(i, { lesson_ids: e.target.checked ? [...q.lesson_ids, l.id] : q.lesson_ids.filter((id) => id !== l.id) })} />{l.name}</label>)}</div>)}</div></details>
        <label className="block text-xs text-muted-foreground">{t("Review warning")}<textarea className={area} rows={2} value={q.review_note} onChange={(e) => patch(i, { review_note: e.target.value })} /></label>
        {!!q.source_pages.length && <p className="text-xs text-muted-foreground">{t("Source pages")}: {q.source_pages.join(", ")}</p>}
      </div>}
    </article>)}
  </div>;
}