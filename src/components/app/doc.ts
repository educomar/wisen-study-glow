import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { lecture } from "./data";
import type { DocPage } from "./grounded";
import { loadPdfLib } from "./PdfPage";
import { log, setTab } from "./store";

export type Doc = { id: string; subject: string; title: string; pages: DocPage[]; pdf?: PDFDocumentProxy; sample?: boolean };
export type Stage = { i: number; done: number; total: number; name: string };

export const sampleDoc: Doc = {
  id: "sample",
  sample: true,
  subject: "Embryology",
  title: "Embryology — Chapter 3: Neurulation",
  pages: lecture.slides.map((s) => ({ pageNumber: s.n, text: [s.title + ".", ...s.body, s.highYield].join(" ") })),
};

type DocState = { doc: Doc; page: number; jump: number | null; restoring: boolean };
let st: DocState = { doc: sampleDoc, page: sampleDoc.pages[0]!.pageNumber, jump: null, restoring: false };
let started = false;
const ls = new Set<() => void>();
const emit = (patch: Partial<DocState>) => { st = { ...st, ...patch }; ls.forEach((l) => l()); };
const META = "wisen-doc-meta";

// ---------- tiny IndexedDB key/value store for the uploaded PDF ----------
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open("wisen", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function put(k: string, v: unknown) {
  const db = await idb();
  await new Promise((res, rej) => { const tx = db.transaction("files", "readwrite"); tx.objectStore("files").put(v, k); tx.oncomplete = () => res(null); tx.onerror = () => rej(tx.error); });
}
async function get<T>(k: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((res, rej) => { const r = db.transaction("files").objectStore("files").get(k); r.onsuccess = () => res(r.result as T); r.onerror = () => rej(r.error); });
}

function saveMeta() {
  try { localStorage.setItem(META, JSON.stringify({ id: st.doc.id, subject: st.doc.subject, page: st.page })); } catch {}
}

async function restore() {
  let meta: { id: string; subject: string; page: number } | null = null;
  try { meta = JSON.parse(localStorage.getItem(META) ?? "null"); } catch {}
  if (!meta) return;
  if (meta.id === "sample") return emit({ page: meta.page, jump: meta.page });
  emit({ restoring: true });
  try {
    const saved = await get<{ doc: Omit<Doc, "pdf">; bytes: Uint8Array }>("active");
    if (!saved || saved.doc.id !== meta.id) return;
    const pdf = await (await loadPdfLib()).getDocument({ data: saved.bytes.slice() }).promise;
    emit({ doc: { ...saved.doc, subject: meta.subject, pdf }, page: meta.page, jump: meta.page });
  } catch { /* keep sample */ } finally { emit({ restoring: false }); }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  void restore();
}

export const getDoc = () => st;
export function setDoc(doc: Doc) { emit({ doc, page: doc.pages[0]?.pageNumber ?? 1, jump: null }); saveMeta(); }
export function setPage(page: number) { if (page !== st.page) { emit({ page }); saveMeta(); } }
export function setSubject(subject: string) { emit({ doc: { ...st.doc, subject } }); saveMeta(); }
export function clearJump() { emit({ jump: null }); }
/** Open the Parallel Workspace on a given page. */
export function openPage(page: number) { setTab("workspace"); emit({ jump: page }); }

/** Validate, parse and index a PDF, then make it the active document shared by every tool. */
export async function uploadPdf(f: File, subject: string, onStage: (s: Stage | null) => void): Promise<{ error?: string; warning?: string }> {
  if (!f.name.toLowerCase().endsWith(".pdf") && f.type !== "application/pdf") return { error: `“${f.name}” isn't a PDF. Please upload a .pdf course file.` };
  if (f.size > 80 * 1024 * 1024) return { error: "This PDF is larger than 80 MB. Please upload a smaller file." };
  const buf = new Uint8Array(await f.arrayBuffer());
  if (!(buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)) return { error: "This file looks corrupted or isn't a real PDF." };
  const name = f.name.replace(/\.pdf$/i, "");
  const bytes = buf.slice();
  onStage({ i: 0, done: 0, total: 0, name });
  try {
    const pdf = await (await loadPdfLib()).getDocument({ data: buf }).promise;
    const pages: DocPage[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const tc = await (await pdf.getPage(n)).getTextContent();
      pages.push({ pageNumber: n, text: tc.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("") });
      onStage({ i: 0, done: n, total: pdf.numPages, name });
    }
    onStage({ i: 1, done: pdf.numPages, total: pdf.numPages, name });
    const doc: Doc = { id: `d${Date.now()}`, subject, title: name, pages };
    await put("active", { doc, bytes }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 400));
    onStage({ i: 2, done: pdf.numPages, total: pdf.numPages, name });
    await new Promise((r) => setTimeout(r, 350));
    setDoc({ ...doc, pdf });
    log(`Uploaded ${subject} course · ${name} (${pdf.numPages} pages)`);
    return pages.some((p) => p.text.trim()) ? {} : { warning: "No selectable text found — this looks like a scanned PDF. You can read it, but Wisen AI can't cite it yet." };
  } catch (e) {
    return { error: (e as Error)?.name === "PasswordException" ? "This PDF is password-protected. Please upload an unlocked copy." : "We couldn't read this PDF. It may be corrupted or damaged." };
  } finally {
    onStage(null);
  }
}

export function useDoc() {
  const [, force] = useState(0);
  useEffect(() => {
    start();
    const l = () => force((n) => n + 1);
    ls.add(l);
    force((n) => n + 1);
    return () => void ls.delete(l);
  }, []);
  return st;
}
