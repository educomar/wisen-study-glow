import { useQueryClient } from "@tanstack/react-query";
import { Braces, Loader2, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { area, inp, sel, useServerFn } from "@/components/admin/team-context";
import { Button } from "@/components/ui/button";
import { aiParseQuestions, bulkImportQuestions } from "@/lib/team.functions";
import { draftIssue, parseQuestionJson, type DraftQ } from "./qbank-import";

const L = "ABCDE";
const SAMPLE = `[{ "stem": "Which bones form the knee joint?", "options": ["Femur", "Tibia", "Fibula", "Patella", "Talus"], "correct": [0, 1, 3], "difficulty": "Medium", "explanation": "..." }]`;

export function QBankImporter({ lessonId, context, onClose }: { lessonId: string; context: string; onClose: () => void }) {
  const [mode, setMode] = useState<"json" | "ai">("json");
  const [raw, setRaw] = useState("");
  const [drafts, setDrafts] = useState<DraftQ[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState<"parse" | "save" | null>(null);
  const parseAi = useServerFn(aiParseQuestions);
  const save = useServerFn(bulkImportQuestions);
  const qc = useQueryClient();

  const patch = (i: number, p: Partial<DraftQ>) => setDrafts((d) => d.map((q, j) => (j === i ? { ...q, ...p } : q)));

  const parse = async () => {
    setErrors([]);
    if (mode === "json") {
      const r = parseQuestionJson(raw);
      setErrors(r.errors);
      setDrafts((d) => [...d, ...r.questions]);
      if (r.questions.length) toast.success(`${r.questions.length} questions ready to review`);
      return;
    }
    setBusy("parse");
    try {
      const qs = await parseAi({ data: { text: raw, context } });
      setDrafts((d) => [...d, ...(qs as DraftQ[])]);
      toast.success(`Wisen AI structured ${qs.length} questions — review before saving`);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  const issues = drafts.map(draftIssue);
  const saveAll = async () => {
    if (issues.some(Boolean)) return toast.error("Fix the highlighted questions first.");
    setBusy("save");
    try {
      const r = await save({ data: { lessonId, questions: drafts.map(({ aiKey: _a, ...q }) => q) } });
      toast.success(`${r.count} questions saved to the lesson`);
      await qc.invalidateQueries();
      setDrafts([]); setRaw(""); onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4 rounded-xl border border-primary/40 bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="mr-auto">Bulk import</strong>
        <Button size="sm" variant={mode === "json" ? "default" : "outline"} onClick={() => setMode("json")}><Braces /> Direct JSON</Button>
        <Button size="sm" variant={mode === "ai" ? "default" : "outline"} onClick={() => setMode("ai")}><Sparkles /> Raw text + Wisen AI</Button>
        <Button size="icon" variant="ghost" aria-label="Close importer" onClick={onClose}><X /></Button>
      </div>
      <p className="text-xs text-muted-foreground">{mode === "json" ? <>Paste a JSON array. Use <code>correct: [indices]</code> for QCM or <code>answer: index</code> for QCU (letters A–E also work). Up to 5 options.</> : "Paste raw past-exam text (French or English) with stems, options and any answer key. Wisen AI structures it, detects QCM/QCU answers and writes missing rationales."}</p>
      <textarea className={`${area} font-mono`} rows={8} placeholder={mode === "json" ? SAMPLE : "1) Le fémur s'articule avec… A. … B. … Réponses : 1-AC"} value={raw} onChange={(e) => setRaw(e.target.value)} />
      <Button onClick={() => void parse()} disabled={!raw.trim() || busy !== null}>{busy === "parse" ? <Loader2 className="animate-spin" /> : mode === "json" ? <Braces /> : <Sparkles />} {mode === "json" ? "Parse JSON" : "Structure with Wisen AI"}</Button>
      {errors.length > 0 && <ul className="rounded-md border border-destructive/40 p-2 text-xs text-destructive">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}

      {drafts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2"><strong className="mr-auto text-sm">Preview · {drafts.length} questions</strong><Button size="sm" variant="ghost" onClick={() => setDrafts([])}>Clear</Button></div>
          {drafts.map((q, i) => (
            <div key={i} className={`space-y-2 rounded-lg border p-3 ${issues[i] ? "border-destructive/60" : "border-border"}`}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">Q{i + 1} · {q.answers.length > 1 ? "QCM" : "QCU"}</span>
                {q.aiKey && <span className="rounded bg-muted px-1.5">Key determined by Wisen AI — verify</span>}
                {issues[i] && <span className="text-destructive">{issues[i]}</span>}
                <select className={`${sel} ml-auto h-7`} value={q.difficulty} onChange={(e) => patch(i, { difficulty: e.target.value as DraftQ["difficulty"] })}><option>Easy</option><option>Medium</option><option>Hard</option></select>
                <Button size="icon" variant="ghost" className="size-7" aria-label={`Remove question ${i + 1}`} onClick={() => setDrafts((d) => d.filter((_, j) => j !== i))}><Trash2 /></Button>
              </div>
              <textarea className={area} rows={2} value={q.stem} onChange={(e) => patch(i, { stem: e.target.value })} aria-label={`Stem ${i + 1}`} />
              {q.options.map((o, k) => {
                const on = q.answers.includes(k);
                return (
                  <div key={k} className="flex items-center gap-2">
                    <button type="button" aria-pressed={on} aria-label={`Toggle ${L[k]} correct`} onClick={() => patch(i, { answers: on ? q.answers.filter((a) => a !== k) : [...q.answers, k].sort() })} className={`grid size-8 shrink-0 place-items-center rounded-md border font-mono text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>{L[k]}</button>
                    <input className={inp} value={o} onChange={(e) => patch(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} />
                    <Button size="icon" variant="ghost" className="size-8" aria-label={`Remove option ${L[k]}`} disabled={q.options.length <= 2} onClick={() => patch(i, { options: q.options.filter((_, j) => j !== k), answers: q.answers.filter((a) => a !== k).map((a) => (a > k ? a - 1 : a)) })}><X /></Button>
                  </div>
                );
              })}
              {q.options.length < 5 && <Button size="sm" variant="ghost" onClick={() => patch(i, { options: [...q.options, ""] })}><Plus /> Option</Button>}
              <textarea className={area} rows={2} placeholder="Explanation / rationale" value={q.explanation} onChange={(e) => patch(i, { explanation: e.target.value })} />
            </div>
          ))}
          <Button onClick={() => void saveAll()} disabled={busy !== null}>{busy === "save" ? <Loader2 className="animate-spin" /> : <Upload />} Save {drafts.length} questions to lesson</Button>
        </div>
      )}
    </div>
  );
}
