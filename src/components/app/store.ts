import { useEffect, useState } from "react";

import type { Card, Question } from "./data";

export type CardState = { due: number; status: "new" | "learning" | "review" };
export type Activity = { t: number; text: string };
export type Note = { id: string; text: string; subject: string; source: string; page?: number; t: number };
export type QSession = { subject: string; lesson: string; difficulty: string; order: string[]; i: number; answers: Record<string, number>; startedAt: number };
export type FlashSession = { source: "all" | "doc" | "saved"; cardId: string | null; flipped: boolean; reviewed: number };
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
export type Tab = "qbank" | "ai" | "workspace" | "cards" | "exam" | "progress" | "saved";

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
  qbank: QSession | null;
  flash: FlashSession;
  exam: ExamSession;
};

const KEY = "wisen-app-state";
const initial: AppState = {
  tab: "qbank",
  bookmarks: [],
  savedCards: [],
  notes: [],
  cards: {},
  customCards: [],
  customQuestions: [],
  attempts: {
    Neurulation: { correct: 5, total: 12 },
    "Neural crest": { correct: 6, total: 9 },
    "Somite formation": { correct: 7, total: 9 },
    Teratology: { correct: 4, total: 6 },
  },
  examHistory: [],
  activity: [
    { t: Date.now() - 3600e3 * 3, text: "Read Embryology · Slide 13 — Neural tube formation" },
    { t: Date.now() - 3600e3 * 20, text: "QBank session — 8/12 correct (Anatomy)" },
    { t: Date.now() - 3600e3 * 44, text: "Reviewed 24 flashcards" },
  ],
  qbank: null,
  flash: { source: "all", cardId: null, flipped: false, reviewed: 0 },
  exam: { phase: "setup", subject: "All", count: 10, minutes: 15, qids: [], answers: [], flags: [], i: 0, endsAt: 0, usedSec: 0 },
};

let state: AppState = initial;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state = { ...initial, ...saved, attempts: { ...initial.attempts, ...saved.attempts }, flash: { ...initial.flash, ...saved.flash }, exam: { ...initial.exam, ...saved.exam } };
    }
  } catch {}
}

export function getState() {
  load();
  return state;
}

export function update(fn: (s: AppState) => AppState) {
  load();
  state = fn(state);
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  listeners.forEach((l) => l());
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

export function addCard(front: string, back: string, tip: string, topic: string, source?: string) {
  update((s) => ({ ...s, customCards: [...s.customCards, { id: `u${Date.now()}${Math.floor(Math.random() * 1e4)}`, front, back, tip, topic, ...(source ? { source } : {}) }] }));
}

export function addNote(text: string, subject: string, source: string, page?: number) {
  update((s) => ({ ...s, notes: [{ id: `n${Date.now()}`, text, subject, source, ...(page ? { page } : {}), t: Date.now() }, ...s.notes] }));
}

export const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export function setTab(tab: Tab) {
  update((s) => ({ ...s, tab }));
}

/** Start a fresh QBank session on specific filters and open the QBank. */
export function practice(subject: string, lesson: string, difficulty = "All") {
  update((s) => ({ ...s, qbank: { subject, lesson, difficulty, order: [], i: 0, answers: {}, startedAt: Date.now() }, tab: "qbank" }));
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
