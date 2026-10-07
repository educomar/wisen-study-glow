import { useEffect, useState } from "react";

import type { Card, Question } from "./data";
import { supabase } from "@/integrations/supabase/client";

export type CardState = { due: number; status: "new" | "learning" | "review"; box?: number };
export type QuestionResult = { question: Question; picked: number | null; correct: boolean; t: number };
export type ReviewEvent = { id: string; cardId: string; topic: string; rating: "Again" | "Hard" | "Good" | "Easy"; t: number };
export type Activity = { t: number; text: string };
export type Note = { id: string; text: string; subject: string; source: string; page?: number; t: number };
export type QSession = { subject: string; lesson: string; difficulty: string; order: string[]; i: number; answers: Record<string, number>; startedAt: number };
export type FlashSession = { source: "all" | "doc" | "saved" | "ai"; cardId: string | null; flipped: boolean; reviewed: number };
export type ExamSession = {
  phase: "setup" | "run" | "done";
  subject: string;
  count: number;
  minutes: number;
  qids: string[];
  answers: (number | null)[];
  flags: boolean[];
  i: number;
  endsAt: number;
  usedSec: number;
};
export type Tab = "qbank" | "ai" | "courses" | "cards" | "exam" | "progress" | "saved";

export type AppState = {
  tab: Tab;
  bookmarks: string[];
  savedCards: string[];
  notes: Note[];
  cards: Record<string, CardState>;
  customCards: Card[];
  customQuestions: Question[];
  /** keyed by lesson / chapter */
  attempts: Record<string, { correct: number; total: number }>;
  examHistory: { t: number; subject: string; score: number; total: number }[];
  activity: Activity[];
  questionResults: Record<string, QuestionResult>;
  reviewHistory: ReviewEvent[];
  qbank: QSession | null;
  flash: FlashSession;
  exam: ExamSession;
};

/** Legacy single-browser key (pre-account sync). Read once, merged into the account, then removed. */
const LEGACY_KEY = "wisen-app-state";
const keyFor = (uid: string | null) => `wisen-app-state:${uid ?? "guest"}`;
const initial: AppState = {
  tab: "qbank",
  bookmarks: [],
  savedCards: [],
  notes: [],
  cards: {},
  customCards: [],
  customQuestions: [],
  attempts: {},
  examHistory: [],
  activity: [],
  questionResults: {},
  reviewHistory: [],
  qbank: null,
  flash: { source: "all", cardId: null, flipped: false, reviewed: 0 },
  exam: { phase: "setup", subject: "All", count: 10, minutes: 15, qids: [], answers: [], flags: [], i: 0, endsAt: 0, usedSec: 0 },
};

let state: AppState = initial;
let loaded = false;
let uid: string | null = null;
let remoteReady = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

type Personal = Pick<AppState, "bookmarks" | "savedCards" | "notes" | "cards" | "customCards" | "customQuestions" | "attempts" | "examHistory" | "activity" | "questionResults" | "reviewHistory">;

const uniq = <T,>(a: T[], b: T[], k: (x: T) => string) => { const m = new Map<string, T>(); [...a, ...b].forEach((x) => { if (!m.has(k(x))) m.set(k(x), x); }); return [...m.values()]; };

/** Merge without duplicates. Attempts take the larger count per lesson so re-merging never double-counts. */
function merge(a: Personal, b: Partial<Personal>): Personal {
  const attempts = { ...a.attempts };
  for (const [k, v] of Object.entries(b.attempts ?? {})) { const c = attempts[k]; if (!c || v.total > c.total) attempts[k] = v; }
  const cards = { ...a.cards };
  for (const [k, v] of Object.entries(b.cards ?? {})) { const c = cards[k]; if (!c || v.due > c.due) cards[k] = v; }
  return {
    bookmarks: uniq(a.bookmarks, b.bookmarks ?? [], String),
    savedCards: uniq(a.savedCards, b.savedCards ?? [], String),
    notes: uniq(a.notes, b.notes ?? [], (n) => n.id).sort((x, y) => y.t - x.t),
    customCards: uniq(a.customCards, b.customCards ?? [], (c) => c.id),
    customQuestions: uniq(a.customQuestions, b.customQuestions ?? [], (q) => q.id),
    examHistory: uniq(a.examHistory, b.examHistory ?? [], (e) => `${e.t}|${e.subject}`).sort((x, y) => x.t - y.t),
    activity: uniq(a.activity, b.activity ?? [], (e) => `${e.t}|${e.text}`).sort((x, y) => y.t - x.t).slice(0, 30),
    questionResults: { ...a.questionResults, ...b.questionResults },
    reviewHistory: uniq(a.reviewHistory, b.reviewHistory ?? [], (e) => e.id),
    attempts, cards,
  };
}
const personal = (s: Partial<AppState>): Personal => merge({ ...initial }, s);

function readLocal(key: string): Partial<AppState> | null {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function hydrate(saved: Partial<AppState> | null): AppState {
  if (!saved) return { ...initial };
  return { ...initial, ...saved, flash: { ...initial.flash, ...saved.flash }, exam: { ...initial.exam, ...saved.exam } };
}

async function pushRemote() {
  if (!uid || !remoteReady) return;
  const owner = uid;
  const p = personal(state);
  const { error } = await supabase.from("student_data").upsert({
    user_id: owner, bookmarks: p.bookmarks, saved_cards: p.savedCards, notes: p.notes as never, card_states: p.cards as never,
    custom_cards: p.customCards as never, custom_questions: p.customQuestions as never, attempts: p.attempts as never,
    exam_history: p.examHistory as never, activity: p.activity as never,
    question_results: p.questionResults as never, review_history: p.reviewHistory as never,
    study_sessions: { qbank: state.qbank, flash: state.flash, exam: state.exam } as never,
  });
  if (error) throw new Error("Your study changes could not be saved. Please try again before signing out.");
}

export async function flushStudentData() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  await pushRemote();
}

/** Switch the store to a user: load their account data, fold in any legacy browser data once, then save back. */
async function bindUser(next: string | null) {
  if (next === uid && (remoteReady || !next)) return;
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  uid = next; remoteReady = false;
  state = hydrate(readLocal(keyFor(next)));
  notify();
  if (!next) return;
  const { data, error } = await supabase.from("student_data").select("*").eq("user_id", next).maybeSingle();
  if (uid !== next || error) return;
  let p = personal(state);
  if (data) {
    p = personal({ bookmarks: data.bookmarks as string[], savedCards: data.saved_cards as string[], notes: data.notes as never, cards: data.card_states as never, customCards: data.custom_cards as never, customQuestions: data.custom_questions as never, attempts: data.attempts as never, examHistory: data.exam_history as never, activity: data.activity as never, questionResults: data.question_results as never, reviewHistory: data.review_history as never });
    const sessions = data.study_sessions as Partial<AppState>;
    state = hydrate({ ...state, ...sessions });
  }
  const legacy = readLocal(LEGACY_KEY);
  if (legacy) p = merge(p, stripLegacySamples(legacy));
  state = { ...state, ...p };
  remoteReady = true;
  try { localStorage.setItem(keyFor(next), JSON.stringify(state)); } catch {}
  notify();
  await pushRemote().catch(() => undefined);
  if (legacy) try { localStorage.removeItem(LEGACY_KEY); } catch {}
}

/** Old builds seeded fake attempts/activity; drop those so they never reach a real account. */
function stripLegacySamples(s: Partial<AppState>): Partial<AppState> {
  const fakeAttempts: Record<string, number> = { Neurulation: 12, "Neural crest": 9, "Somite formation": 9, Teratology: 6 };
  const attempts = Object.fromEntries(Object.entries(s.attempts ?? {}).filter(([k, v]) => fakeAttempts[k] !== v.total));
  const fakeText = /^(Read Embryology · Slide 13 — Neural tube formation|QBank session — 8\/12 correct \(Anatomy\)|Reviewed 24 flashcards)$/;
  return { ...s, attempts, activity: (s.activity ?? []).filter((a) => !fakeText.test(a.text)) };
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  state = hydrate(readLocal(keyFor(null)));
  void supabase.auth.getUser().then(({ data }) => bindUser(data.user?.id ?? null));
  supabase.auth.onAuthStateChange((e, session) => {
    if (e === "SIGNED_IN" || e === "SIGNED_OUT" || e === "INITIAL_SESSION") void bindUser(session?.user?.id ?? null);
  });
}

export function getState() {
  load();
  return state;
}

export function update(fn: (s: AppState) => AppState) {
  load();
  state = fn(state);
  try { localStorage.setItem(keyFor(uid), JSON.stringify(state)); } catch {}
  notify();
  if (uid && remoteReady) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void pushRemote().catch(() => undefined), 300);
  }
}

export function log(text: string) {
  update((s) => ({ ...s, activity: [{ t: Date.now(), text }, ...s.activity].slice(0, 30) }));
}

export function recordAttempt(lesson: string, correct: boolean) {
  update((s) => {
    const a = s.attempts[lesson] ?? { correct: 0, total: 0 };
    return { ...s, attempts: { ...s.attempts, [lesson]: { correct: a.correct + (correct ? 1 : 0), total: a.total + 1 } } };
  });
}

export function recordQuestion(q: Question, picked: number | null) {
  const correct = picked === q.answer;
  update((s) => {
    const a = s.attempts[q.topic] ?? { correct: 0, total: 0 };
    return { ...s, attempts: { ...s.attempts, [q.topic]: { correct: a.correct + Number(correct), total: a.total + 1 } }, questionResults: { ...s.questionResults, [q.id]: { question: q, picked, correct, t: Date.now() } } };
  });
}

export function addCard(front: string, back: string, tip: string, topic: string, source?: string) {
  update((s) => ({ ...s, customCards: [...s.customCards, { id: `u${Date.now()}${Math.floor(Math.random() * 1e4)}`, front, back, tip, topic, ...(source ? { source } : {}) }] }));
}

export function addNote(text: string, subject: string, source: string, page?: number) {
  update((s) => ({ ...s, notes: [{ id: `n${Date.now()}`, text, subject, source, ...(page ? { page } : {}), t: Date.now() }, ...s.notes] }));
}

export const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export function setTab(tab: Tab) {
  update((s) => ({ ...s, tab }));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("wisen-open-tool", { detail: tab }));
}

/** Start a fresh QBank session on specific filters and open the QBank. */
export function practice(subject: string, lesson: string, difficulty = "All") {
  update((s) => ({ ...s, qbank: { subject, lesson, difficulty, order: [], i: 0, answers: {}, startedAt: Date.now() }, tab: "qbank" }));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("wisen-open-tool", { detail: "qbank" }));
}

export function useAppState() {
  const [, force] = useState(0);
  useEffect(() => {
    load();
    force((n) => n + 1);
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return state;
}
