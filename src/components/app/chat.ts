import { useEffect, useState } from "react";

import { getDoc } from "./doc";
import type { AiMsg } from "./grounded";
import { askWisenAI } from "@/lib/ai/client";

export type Msg = { role: "user"; text: string } | AiMsg;

const KEY = "wisen-chat";
let msgs: Msg[] = [];
let typing = false;
let loaded = false;
const ls = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { msgs = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { msgs = []; }
  if (!msgs.length) msgs = [greeting()];
}
function greeting(): AiMsg {
  const { doc } = getDoc();
  return { role: "ai", text: `Hi! I'm Wisen AI. I'm grounded in “${doc.title}” and the UFAS1 knowledge base. Ask in English, Français, العربية or Darija — or attach a course file.`, cite: doc.pages[0]?.pageNumber ?? 1 };
}
function emit() {
  try { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-60))); } catch {}
  ls.forEach((l) => l());
}

export function pushMsgs(...m: Msg[]) { load(); msgs = [...msgs, ...m]; emit(); }
export function clearChat() { msgs = [greeting()]; emit(); }

export async function ask(action: string, query: string, display: string, page?: number, extra?: { image?: string; attachment?: { name: string; text: string } }) {
  load();
  const { doc, page: cur } = getDoc();
  const p = page ?? cur;
  const history = msgs.slice(-10).map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), text: (m.text + (m.role === "ai" && m.points ? "\n" + m.points.join("\n") : "")).slice(0, 4000) }));
  msgs = [...msgs, { role: "user", text: display }];
  typing = true;
  emit();
  try {
    const res = await askWisenAI({ action, message: query.slice(0, 6000), subject: doc.subject, title: doc.title, page: p, pages: doc.pages, history, ...extra });
    msgs = [...msgs, res];
  } catch {
    msgs = [...msgs, { role: "ai", text: "Something went wrong reaching Wisen AI. Please try again." }];
  }
  typing = false;
  emit();
}

export function useChat() {
  const [, force] = useState(0);
  useEffect(() => {
    load();
    const l = () => force((n) => n + 1);
    ls.add(l);
    force((n) => n + 1);
    return () => void ls.delete(l);
  }, []);
  return { msgs, typing };
}
