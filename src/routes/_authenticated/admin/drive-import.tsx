import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, FileText, Folder, Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { buildTree, cleanName, countFiles, parseFolderId, walk, type DriveItem, type ImportNode, type Level } from "@/components/admin/drive-import";
import { inp, PageHead, sel, useAction, useHierarchy, useServerFn } from "@/components/admin/team-context";
import { Button } from "@/components/ui/button";
import { commitDriveImport, crawlDriveFolder, standardizeDriveNames } from "@/lib/drive-import.functions";

export const Route = createFileRoute("/_authenticated/admin/drive-import")({
  head: () => ({
    meta: [
      { title: "Drive Curriculum Importer · Wisen Team" },
      { name: "description", content: "Import subjects, units, lessons and files from Google Drive into Wisen." },
      { property: "og:title", content: "Drive Curriculum Importer · Wisen Team" },
      { property: "og:description", content: "Crawl, clean and review a Google Drive folder before adding it to the curriculum." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DriveImporter,
});

const PROGRAMS = ["Medicine", "Dentistry", "Pharmacy"];
const LEVELS: { v: Level; label: string; hint: string }[] = [
  { v: "year", label: "Entire year / semester", hint: "Root → Subjects → Units → Lessons → Files" },
  { v: "subject", label: "Single subject", hint: "Units → Lessons → Files" },
  { v: "unit", label: "Single unit / chapter", hint: "Lessons → Files" },
];
const norm = (s: string) => s.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n ? `${Math.round(n / 1e3)} KB` : "");

function DriveImporter() {
  const { data: h } = useHierarchy();
  const run = useAction();
  const crawl = useServerFn(crawlDriveFolder), standardize = useServerFn(standardizeDriveNames), commit = useServerFn(commitDriveImport);
  const [level, setLevel] = useState<Level>("year");
  const [dept, setDept] = useState("Medicine");
  const [year, setYear] = useState(1);
  const [subjectId, setSubjectId] = useState(""); // "" = new subject from root folder
  const [subjectName, setSubjectName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [link, setLink] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [tree, setTree] = useState<ImportNode[] | null>(null);
  const [folderId, setFolderId] = useState("");
  const [busy, setBusy] = useState<"" | "crawl" | "ai" | "commit">("");
  const [aiDone, setAiDone] = useState(0);
  const [, force] = useState(0);
  const touch = () => force((x) => x + 1);

  const subjects = (h?.subjects ?? []).filter((s) => s.department === dept && s.academic_year === year);
  const unitsOf = (sid: string) => (h?.units ?? []).filter((u) => u.subject_id === sid);
  const lessonsOf = (uid: string) => (h?.lessons ?? []).filter((l) => l.unit_id === uid);
  const stats = useMemo(() => (tree ? countFiles(tree) : { files: 0, emds: 0 }), [tree, busy, aiDone]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Auto-match new nodes to existing records with the same normalized name. */
  function autoMatch(nodes: ImportNode[], pool: { id: string; name: string }[], childPool: (id: string) => { id: string; name: string }[], grand?: (id: string) => { id: string; name: string }[]) {
    for (const n of nodes) {
      if (n.type === "file") continue;
      const m = pool.find((p) => norm(p.name) === norm(n.name) || norm(p.name) === norm(n.raw));
      n.matchId = m?.id ?? "";
      if (m && grand) autoMatch(n.children, childPool(m.id), grand);
      else if (m) autoMatch(n.children, childPool(m.id), () => []);
    }
  }

  async function doCrawl() {
    const id = parseFolderId(link);
    if (!id) return toast.error("Paste a Google Drive folder link.");
    if (level === "unit" && (!subjectId || !unitId)) return toast.error("Choose the subject and unit to import into.");
    setBusy("crawl"); setTree(null);
    const r = await run(crawl({ data: { folderId: id, apiKey: apiKey.trim() || undefined } }));
    setBusy("");
    if (!r) return;
    const t = buildTree(r.root as DriveItem, level);
    if (level === "year") autoMatch(t, subjects, unitsOf, lessonsOf);
    if (level === "subject") {
      if (!subjectId) { setSubjectName(cleanName(r.root.name)); const m = subjects.find((s) => norm(s.name) === norm(cleanName(r.root.name))); if (m) setSubjectId(m.id); autoMatch(t, m ? unitsOf(m.id) : [], lessonsOf); }
      else autoMatch(t, unitsOf(subjectId), lessonsOf);
    }
    if (level === "unit") autoMatch(t, lessonsOf(unitId), () => []);
    setFolderId(id); setTree(t); setAiDone(0);
    toast.success(`Found ${r.total} Drive items.`);
  }

  async function doAi() {
    if (!tree) return;
    const all: ImportNode[] = []; walk(tree, (n) => { if (n.include && n.driveId) all.push(n); });
    setBusy("ai"); setAiDone(0);
    const byKey = new Map(all.map((n) => [n.key, n]));
    for (let i = 0; i < all.length; i += 120) {
      const batch = all.slice(i, i + 120).map((n) => ({ k: n.key, raw: n.raw, type: n.type }));
      const res = await run(standardize({ data: { items: batch, context: `${dept} Year ${year}` } }));
      if (!res) break;
      for (const x of res) {
        const n = byKey.get(x.k); if (!n) continue;
        const ext = n.type === "file" ? (n.raw.match(/\.[a-z0-9]{2,5}$/i)?.[0]?.toLowerCase() ?? "") : "";
        n.name = x.name.replace(/\.[a-z0-9]{2,5}$/i, "") + ext;
        if (n.type === "file" && x.emd) n.kind = "past_emd";
      }
      setAiDone(Math.min(all.length, i + 120));
    }
    setBusy(""); touch();
  }

  async function doCommit() {
    if (!tree) return;
    const files = (ns: ImportNode[]) => ns.filter((n) => n.type === "file" && n.include).map((n) => ({ driveId: n.driveId, name: n.name.trim() || n.raw, mimeType: n.mimeType, size: n.size, createdTime: n.createdTime, kind: n.kind }));
    const lessons = (ns: ImportNode[]) => ns.filter((n) => n.type === "lesson" && n.include).map((n) => ({ matchId: n.matchId, name: n.name.trim(), files: files(n.children) }));
    const units = (ns: ImportNode[]) => ns.filter((n) => n.type === "unit" && n.include).map((n) => ({ matchId: n.matchId, name: n.name.trim(), lessons: lessons(n.children), files: files(n.children) }));
    const payload = level === "year"
      ? tree.filter((n) => n.include).map((n) => ({ matchId: n.matchId, name: n.name.trim(), units: units(n.children) }))
      : level === "subject"
        ? [{ matchId: subjectId, name: subjectName.trim(), units: units(tree) }]
        : [{ matchId: subjectId, name: "", units: [{ matchId: unitId, name: "", lessons: lessons(tree), files: files(tree) }] }];
    setBusy("commit");
    const r = await run(commit({ data: { department: dept, academicYear: year, level, folderId, subjects: payload } }));
    setBusy("");
    if (r) { toast.success(`Imported ${r.subjects} subjects, ${r.units} units, ${r.lessons} lessons and ${r.files} files${r.skipped ? ` (${r.skipped} already existed)` : ""}.`); setTree(null); }
  }

  const poolFor = (n: ImportNode, parentMatch: string | null): { id: string; name: string }[] => {
    if (n.type === "subject") return subjects;
    if (parentMatch === null) return [];
    return n.type === "unit" ? unitsOf(parentMatch) : n.type === "lesson" ? lessonsOf(parentMatch) : [];
  };
  const rootParent = level === "year" ? null : level === "subject" ? subjectId || null : unitId;

  return (
    <div className="max-w-5xl">
      <PageHead title="Google Drive Curriculum Importer" sub="Crawl a Drive folder, clean names with Wisen AI, review, then add it to the curriculum in one step." />

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="grid gap-2 sm:grid-cols-3">
          {LEVELS.map((l) => (
            <button key={l.v} onClick={() => { setLevel(l.v); setTree(null); }} className={`rounded-lg border p-3 text-left text-sm transition ${level === l.v ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}>
              <span className="font-medium">{l.label}</span><span className="mt-1 block text-xs text-muted-foreground">{l.hint}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Program" className={sel} value={dept} onChange={(e) => { setDept(e.target.value); setSubjectId(""); setUnitId(""); }}>{PROGRAMS.map((p) => <option key={p}>{p}</option>)}</select>
          <select aria-label="Year" className={sel} value={year} onChange={(e) => { setYear(Number(e.target.value)); setSubjectId(""); setUnitId(""); }}>{[1, 2, 3, 4, 5, 6, 7].map((y) => <option key={y} value={y}>Year {y}</option>)}</select>
          {level !== "year" && (
            <select aria-label="Subject" className={sel} value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setUnitId(""); }}>
              {level === "subject" && <option value="">New subject (from folder name)</option>}
              {level === "unit" && <option value="">Choose subject…</option>}
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {level === "unit" && subjectId && (
            <select aria-label="Unit" className={sel} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">Choose unit…</option>{unitsOf(subjectId).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={inp} placeholder="https://drive.google.com/drive/folders/…" value={link} onChange={(e) => setLink(e.target.value)} />
          <Button onClick={doCrawl} disabled={busy !== ""}>{busy === "crawl" ? <><Loader2 className="size-4 animate-spin" /> Crawling…</> : "Crawl folder"}</Button>
        </div>
        <div className="text-xs text-muted-foreground">
          By default the folder is read through Wisen's connected Google Drive account (share the folder with it).
          <button className="ml-1 underline" onClick={() => setShowKey((v) => !v)}>{showKey ? "Hide API key" : "Use a Google Drive API key instead"}</button>
          {showKey && (
            <div className="mt-2 space-y-2 rounded-md bg-muted/50 p-3">
              <ol className="list-decimal space-y-0.5 pl-4">
                <li>Open Google Cloud Console → APIs &amp; Services → enable "Google Drive API".</li>
                <li>Credentials → Create credentials → API key (restrict it to the Drive API).</li>
                <li>Set the Drive folder to "Anyone with the link can view", then paste the key below.</li>
              </ol>
              <input className={inp} type="password" autoComplete="off" placeholder="AIza…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              <p>The key is used for this crawl only and is never saved.</p>
            </div>
          )}
        </div>
      </section>

      {tree && (
        <section className="mt-6 rounded-xl border border-border bg-card">
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-card/95 p-4 backdrop-blur">
            <p className="mr-auto text-sm"><b>{stats.files}</b> files selected · <b>{stats.emds}</b> past EMDs</p>
            {level === "subject" && !subjectId && <input className={`${inp} max-w-64`} aria-label="New subject name" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />}
            <Button variant="outline" onClick={doAi} disabled={busy !== ""}>{busy === "ai" ? <><Loader2 className="size-4 animate-spin" /> Standardizing {aiDone}…</> : <><Sparkles className="size-4" /> Standardize with Wisen AI</>}</Button>
            <Button onClick={doCommit} disabled={busy !== "" || !stats.files}>{busy === "commit" ? <><Loader2 className="size-4 animate-spin" /> Importing…</> : "Commit to curriculum"}</Button>
          </div>
          <div className="grid grid-cols-[1fr_1fr] gap-2 border-b border-border px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground"><span>Raw Drive name</span><span>Standardized name · target</span></div>
          <div className="max-h-[70vh] overflow-auto p-2">
            {tree.length ? tree.map((n) => <Row key={n.key} n={n} depth={0} parentMatch={rootParent} poolFor={poolFor} onChange={touch} />) : <p className="p-4 text-sm text-muted-foreground">This folder is empty.</p>}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ n, depth, parentMatch, poolFor, onChange }: { n: ImportNode; depth: number; parentMatch: string | null; poolFor: (n: ImportNode, p: string | null) => { id: string; name: string }[]; onChange: () => void }) {
  const [open, setOpen] = useState(depth < 1);
  const pool = poolFor(n, parentMatch);
  const isFile = n.type === "file";
  const toggle = (v: boolean) => { walk([n], (x) => { x.include = v; }); onChange(); };
  return (
    <div>
      <div className={`grid grid-cols-[1fr_1fr] items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent/40 ${n.include ? "" : "opacity-45"}`}>
        <div className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: depth * 16 }}>
          <input type="checkbox" aria-label={`Include ${n.raw}`} checked={n.include} onChange={(e) => toggle(e.target.checked)} />
          {!isFile ? <button onClick={() => setOpen((o) => !o)} aria-label="Expand">{open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}</button> : <span className="w-3.5" />}
          {isFile ? <FileText className="size-3.5 shrink-0 text-muted-foreground" /> : <Folder className="size-3.5 shrink-0 text-primary" />}
          <span className="truncate text-xs text-muted-foreground" title={n.raw}>{n.raw}</span>
          <span className="ml-1 shrink-0 rounded bg-muted px-1 text-[10px] uppercase">{n.type}</span>
          {isFile && <span className="shrink-0 text-[10px] text-muted-foreground">{kb(n.size)}</span>}
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          {(isFile || !n.matchId) && <input className="h-7 min-w-0 flex-1 rounded border border-input bg-background px-2 text-sm" value={n.name} onChange={(e) => { n.name = e.target.value; onChange(); }} />}
          {isFile ? (
            <select className="h-7 rounded border border-input bg-background px-1 text-xs" value={n.kind} onChange={(e) => { n.kind = e.target.value as ImportNode["kind"]; onChange(); }}>
              <option value="course">Course</option><option value="past_emd">Past EMD</option>
            </select>
          ) : (
            <select className={`h-7 rounded border bg-background px-1 text-xs ${n.matchId ? "flex-1 border-primary text-primary" : "border-input"}`} value={n.matchId} onChange={(e) => { n.matchId = e.target.value; onChange(); }}>
              <option value="">Create new</option>
              {pool.map((p) => <option key={p.id} value={p.id}>Merge into: {p.name}</option>)}
            </select>
          )}
        </div>
      </div>
      {open && n.children.map((c) => <Row key={c.key} n={c} depth={depth + 1} parentMatch={n.matchId || null} poolFor={poolFor} onChange={onChange} />)}
    </div>
  );
}
