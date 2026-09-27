import { useEffect, useState } from "react";

export type CardState = { due: number; status: "new" | "learning" | "review"; custom?: { front: string; back: string; tip: string; topic: string } };
export type Activity = { t: number; text: string };
export type AppState = {
  bookmarks: string[];
  cards: Record<string, CardState>;
  customCards: { id: string; front: string; back: string; tip: string; topic: string }[];
  attempts: Record<string, { correct: number; total: number }>;
  activity: Activity[];
};

const KEY = "wisen-app-state";
const initial: AppState = {
  bookmarks: [],
  cards: {},
  customCards: [],
  attempts: { Neurulation: { correct: 5, total: 12 }, "Neural crest": { correct: 6, total: 9 }, "Somite formation": { correct: 7, total: 9 }, Teratology: { correct: 4, total: 6 } },
  activity: [
    { t: Date.now() - 3600e3 * 3, text: "Read Embryology · Slide 13 — Neural tube formation" },
    { t: Date.now() - 3600e3 * 20, text: "QBank session — 8/12 correct (Anatomy)" },
    { t: Date.now() - 3600e3 * 44, text: "Reviewed 24 flashcards" },
  ],
};

let state: AppState = initial;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...initial, ...JSON.parse(raw) };
  } catch {}
}

export function update(fn: (s: AppState) => AppState) {
  load();
  state = fn(state);
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

export function log(text: string) {
  update((s) => ({ ...s, activity: [{ t: Date.now(), text }, ...s.activity].slice(0, 30) }));
}

export function recordAttempt(topic: string, correct: boolean) {
  update((s) => {
    const a = s.attempts[topic] ?? { correct: 0, total: 0 };
    return { ...s, attempts: { ...s.attempts, [topic]: { correct: a.correct + (correct ? 1 : 0), total: a.total + 1 } } };
  });
}

export function addCard(front: string, back: string, tip: string, topic: string) {
  update((s) => ({ ...s, customCards: [...s.customCards, { id: `u${Date.now()}`, front, back, tip, topic }] }));
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
