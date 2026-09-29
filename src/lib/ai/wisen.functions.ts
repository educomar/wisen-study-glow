import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { prepare } from "./prompt";

const schema = z.object({
  message: z.string().min(1).max(6000),
  action: z.string().max(40),
  subject: z.string().max(60),
  title: z.string().max(200),
  page: z.number().int(),
  excerpts: z.array(z.object({ page: z.number().int(), text: z.string().max(2500) })).max(5),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) })).max(12),
  image: z.string().max(7_000_000).startsWith("data:image/").optional(),
});

// Built-in Wisen engine: same router + UFAS1 retrieval + expertise profile, served through Lovable AI.
export const askWisen = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { route, kb, system, user } = prepare(data);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false as const, route: route.primary, error: "unavailable" };
    const input = [
      ...data.history.map((h) => ({ role: h.role, content: [{ type: h.role === "user" ? "input_text" : "output_text", text: h.text }] })),
      { role: "user", content: [{ type: "input_text", text: user }, ...(data.image ? [{ type: "input_image", image_url: data.image }] : [])] },
    ];
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", instructions: system, input, stream: true, store: false, reasoning: { effort: route.complexity === "complex" ? "medium" : "low", summary: "auto" }, include: ["reasoning.encrypted_content"] }),
    });
    if (!res.ok || !res.body) {
      console.error("wisen gateway", res.status, await res.text().catch(() => ""));
      return { ok: false as const, route: route.primary, error: res.status === 429 ? "busy" : res.status === 402 ? "credits" : "unavailable" };
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "", failed = false;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, i);
        buf = buf.slice(i + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const ev = JSON.parse(payload);
            if (ev.type === "response.output_text.delta") text += ev.delta;
            else if (ev.type === "error" || ev.type === "response.failed") failed = true;
          } catch { /* partial */ }
        }
      }
    }
    if (failed || !text.trim()) return { ok: false as const, route: route.primary, error: "unavailable" };
    return { ok: true as const, route: route.primary, lang: route.lang, reason: route.reason, text, sources: kb.map((c) => ({ source: c.source, kind: c.kind })) };
  });
