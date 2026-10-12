import { respond, rankPages, type AiMsg, type DocPage, type Mcq } from "@/components/app/grounded";

import { prepare, type WisenRequest } from "./prompt";
import { MODELS, type ModelKey } from "./router";
import { askWisen } from "./wisen.functions";
import { getLang } from "@/lib/i18n";

let level: WisenRequest["level"];
/** Set by the signed-in session so every Wisen AI request is pitched at the student's department and year. */
export function setAiLevel(l: WisenRequest["level"]) { level = l; }
export const currentLevel = () => level;

export type RemoteConfig = { baseUrl: string; apiKey: string; models: Partial<Record<ModelKey, string>> };
const KEY = "wisen-ai-remote";
export const DEFAULT_BASE = "https://openrouter.ai/api/v1";

export function getRemote(): RemoteConfig | null {
  if (typeof window === "undefined") return null;
  try { const c = JSON.parse(localStorage.getItem(KEY) ?? "null"); return c?.apiKey ? c : null; } catch { return null; }
}
export function setRemote(c: RemoteConfig | null) {
  if (c?.apiKey) localStorage.setItem(KEY, JSON.stringify(c)); else localStorage.removeItem(KEY);
}

async function callRemote(cfg: RemoteConfig, model: string, system: string, req: WisenRequest, user: string) {
  const res = await fetch(`${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}`, "X-Title": "Wisen AI" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        ...req.history.map((h) => ({ role: h.role, content: h.text })),
        { role: "user", content: req.image ? [{ type: "text", text: user }, { type: "image_url", image_url: { url: req.image } }] : user },
      ],
    }),
  });
  if (!res.ok) throw new Error(String(res.status));
  const j = await res.json();
  const t = j?.choices?.[0]?.message?.content;
  if (typeof t !== "string" || !t.trim()) throw new Error("empty");
  return t;
}

function toMsg(raw: string, fallbackCite: number): Pick<AiMsg, "text" | "mcq" | "cite"> {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  let mcq: Mcq | undefined;
  const m = text.match(/```mcq\s*([\s\S]*?)```/);
  if (m) {
    text = text.replace(m[0], "").trim();
    try {
      const q = JSON.parse(m[1]!);
      const opts: string[] | undefined = Array.isArray(q.options) && q.options.length ? q.options.map(String) : undefined;
      mcq = { stem: String(q.stem), options: opts, answer: opts && typeof q.answer === "number" ? opts[q.answer] ?? opts[0]! : String(q.answer), explain: String(q.explain ?? "") };
    } catch { /* ignore bad block */ }
  }
  const c = text.match(/\[Source:\s*Page\s*(\d+)\]/i);
  return { text, mcq, cite: c ? Number(c[1]) : fallbackCite };
}

export async function askWisenAI(p: { action: string; message: string; subject: string; title: string; page: number; pages: DocPage[]; history: WisenRequest["history"]; image?: string; attachment?: { name: string; text: string } }): Promise<AiMsg> {
  const excerpts = rankPages(p.message, p.pages, p.page).map((pg) => ({ page: pg.pageNumber, text: pg.text.replace(/\s+/g, " ").slice(0, 2400) }));
  const req: WisenRequest = { message: p.message, action: p.action, subject: p.subject, title: p.title, page: p.page, excerpts, history: p.history.slice(-10), image: p.image, level, outputLanguage: getLang() === "fr" ? "french" : "english" };
  const { route, kb, system, user } = prepare(req);
  const pageCite = p.action === "Ask" && kb.length && !route.medical ? undefined : p.page;
  const sources = kb.map((c) => c.source).filter((s, i, a) => a.indexOf(s) === i);
  const hasExp = kb.some((c) => c.kind === "student_experience");

  const cfg = getRemote();
  if (cfg) {
    for (const k of route.chain) {
      try {
        const out = await callRemote(cfg, cfg.models[k] || MODELS[k].remote, system, req, user);
        return { role: "ai", ...toMsg(out, pageCite ?? 0), route: MODELS[k].label, routeNote: `${route.reason}${k !== route.primary ? " · fallback" : ""} · live`, sources, studentExp: hasExp, rich: true };
      } catch { /* try next model */ }
    }
  }
  try {
    const r = await askWisen({ data: { ...req, ...(p.attachment ? { attachment: p.attachment } : {}) } });
    if (r.ok) return { role: "ai", ...toMsg(r.text, pageCite ?? 0), route: MODELS[r.route].label, routeNote: `${r.reason} · Wisen engine`, sources, studentExp: hasExp, rich: true };
  } catch { /* fall through to offline */ }
  const local = respond(p.action === "Ask" ? "Ask" : p.action, p.message, p.pages, p.page, p.subject);
  return { ...local, route: MODELS[route.primary].label, routeNote: "offline course search" };
}
