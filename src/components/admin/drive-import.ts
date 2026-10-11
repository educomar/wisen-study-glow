/** Pure helpers for the Google Drive curriculum importer (shared by UI and tests). */
export type DriveItem = { id: string; name: string; mimeType: string; size: number; createdTime: string | null; children?: DriveItem[] };
export type Level = "year" | "subject" | "unit";
export type NodeType = "subject" | "unit" | "lesson" | "file";
export type ImportNode = {
  key: string; type: NodeType; raw: string; name: string; include: boolean;
  /** Existing record to merge into; "" = create new. */
  matchId: string;
  driveId: string; mimeType: string; size: number; createdTime: string | null;
  kind: "course" | "past_emd";
  children: ImportNode[];
};

export const FOLDER = "application/vnd.google-apps.folder";
const EMD_RE = /(^|[^a-z])(emd\d*|qcm|qcu|rattrapage|sujets?|examens?|exam)([^a-z]|$)/i;

export function detectKind(name: string, ancestors: string[] = []): "course" | "past_emd" {
  return [name, ...ancestors].some((n) => EMD_RE.test(n)) ? "past_emd" : "course";
}

const SMALL = new Set(["a", "an", "and", "of", "the", "in", "on", "to", "for", "et", "de", "du", "des", "la", "le", "les", "with"]);

/** Deterministic cleanup used before (or without) Wisen AI. Keeps the file extension. */
export function cleanName(raw: string, isFile = false): string {
  let base = raw, ext = "";
  if (isFile) { const m = raw.match(/^(.*?)(\.[a-z0-9]{2,5})$/i); if (m) { base = m[1]!; ext = m[2]!.toLowerCase(); } }
  let s = base
    .replace(/\p{Extended_Pictographic}|\uFE0F/gu, " ")
    .replace(/[_]+/g, " ")
    .replace(/\b(cours|td|tp|v\d+|final|copy|copie|new|nouveau)\b/gi, " ")
    .replace(/\b(dr|pr|prof)\.?\s+[A-Z][\p{L}'-]+/gu, " ")
    .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b(19|20)\d{2}(\s*[-/]\s*(19|20)?\d{2})?\b/g, " ")
    .replace(/\(\s*\d+\s*\)/g, " ")
    .replace(/^[\s\d.)-]+(?=\p{L})/u, "")
    .replace(/[-–—]{2,}|[|~*#]+/g, " ")
    .replace(/\s*-\s*$/, "")
    .replace(/\s+/g, " ").trim();
  if (!s) s = base.trim();
  const words = s.split(" ").map((w, i) => {
    if (/^[A-Z0-9]{2,}$/.test(w) || /\d/.test(w)) return w; // acronyms, codes like EMD1
    const lw = w.toLocaleLowerCase();
    if (i > 0 && SMALL.has(lw)) return lw;
    return lw.charAt(0).toLocaleUpperCase() + lw.slice(1);
  });
  return words.join(" ") + ext;
}

const filesOf = (it: DriveItem): DriveItem[] => (it.children ?? []).flatMap((c) => (c.mimeType === FOLDER ? filesOf(c) : [c]));
let seq = 0;
const node = (it: DriveItem, type: NodeType, anc: string[], children: ImportNode[] = []): ImportNode => ({
  key: `${type}-${it.id}-${seq++}`, type, raw: it.name, name: cleanName(it.name, type === "file"), include: true, matchId: "",
  driveId: it.id, mimeType: it.mimeType, size: it.size, createdTime: it.createdTime,
  kind: type === "file" ? detectKind(it.name, anc) : "course", children,
});
const byDate = (a: DriveItem, b: DriveItem) => (a.createdTime ?? "").localeCompare(b.createdTime ?? "") || a.name.localeCompare(b.name);
const fileNodes = (items: DriveItem[], anc: string[]) => [...items].sort(byDate).map((f) => node(f, "file", anc));
const loose = (label: string, type: NodeType, files: ImportNode[], children: ImportNode[] = []): ImportNode => ({
  key: `${type}-loose-${seq++}`, type, raw: "(files outside folders)", name: label, include: true, matchId: "", driveId: "", mimeType: FOLDER, size: 0, createdTime: null, kind: "course", children: [...files, ...children],
});

function lessonNode(it: DriveItem, anc: string[]) { return node(it, "lesson", anc, fileNodes(filesOf(it), [...anc, it.name])); }
function unitNode(it: DriveItem, anc: string[]) {
  const a = [...anc, it.name];
  const kids = (it.children ?? []).sort(byDate);
  return node(it, "unit", anc, [...kids.filter((c) => c.mimeType === FOLDER).map((c) => lessonNode(c, a)), ...fileNodes(kids.filter((c) => c.mimeType !== FOLDER), a)]);
}
function subjectNode(it: DriveItem, anc: string[]) {
  const a = [...anc, it.name];
  const kids = (it.children ?? []).sort(byDate);
  const units = kids.filter((c) => c.mimeType === FOLDER).map((c) => unitNode(c, a));
  const files = fileNodes(kids.filter((c) => c.mimeType !== FOLDER), a);
  return node(it, "subject", anc, files.length ? [...units, loose("General Resources", "unit", files)] : units);
}

/** Map a crawled Drive root onto the curriculum hierarchy for the chosen import level. */
export function buildTree(root: DriveItem, level: Level): ImportNode[] {
  const kids = [...(root.children ?? [])].sort(byDate);
  const folders = kids.filter((c) => c.mimeType === FOLDER);
  const files = kids.filter((c) => c.mimeType !== FOLDER);
  if (level === "year") return folders.map((f) => subjectNode(f, [root.name]));
  if (level === "subject") {
    const units = folders.map((f) => unitNode(f, [root.name]));
    return files.length ? [...units, loose("General Resources", "unit", fileNodes(files, [root.name]))] : units;
  }
  return [...folders.map((f) => lessonNode(f, [root.name])), ...fileNodes(files, [root.name])];
}

export function walk(nodes: ImportNode[], fn: (n: ImportNode) => void) { for (const n of nodes) { fn(n); walk(n.children, fn); } }
export function countFiles(nodes: ImportNode[]) { let c = 0, e = 0; walk(nodes, (n) => { if (n.type === "file" && n.include) { c++; if (n.kind === "past_emd") e++; } }); return { files: c, emds: e }; }

export function parseFolderId(input: string): string | null {
  const s = input.trim();
  const m = s.match(/folders\/([\w-]{10,})/) ?? s.match(/[?&]id=([\w-]{10,})/);
  if (m) return m[1]!;
  return /^[\w-]{10,}$/.test(s) ? s : null;
}
