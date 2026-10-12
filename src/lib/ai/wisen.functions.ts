import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { wisenComplete, type ChatMsg } from "./gateway.server";
import { prepare } from "./prompt";

const schema = z.object({
  message: z.string().min(1).max(6000),
  action: z.string().max(40),
  outputLanguage: z.literal('english').optional(),
  level: z.object({ department: z.enum(['Medicine', 'Dentistry']), year: z.number().int().min(1).max(7) }).optional(),
  subject: z.string().max(60),
  title: z.string().max(200),
  page: z.number().int(),
  excerpts: z.array(z.object({ page: z.number().int(), text: z.string().max(2500) })).max(5),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) })).max(12),
  image: z.string().max(7_000_000).startsWith("data:image/").optional(),
  attachment: z.object({ name: z.string().max(200), text: z.string().max(40000) }).optional(),
});

const NOTATION = `Notation: write maths with LaTeX — inline $...$ and display $$...$$. Write chemistry with mhchem inside math, e.g. $\\ce{H2O}$, $\\ce{2H2 + O2 -> 2H2O}$, $\\ce{HCO3- <=> CO3^2- + H+}$. For structures, describe them or use condensed formulas inside \\ce{}.`;

// Wisen engine: same router + UFAS1 retrieval + expertise profile.
export const askWisen = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { route, kb, system, user } = prepare(data);
    const att = data.attachment ? `\n\nThe student attached the file "${data.attachment.name}". Use it as context:\n${data.attachment.text}` : "";
    const messages: ChatMsg[] = [
      { role: "system", content: `${system}\n\n${NOTATION}` },
      ...data.history.map((h) => ({ role: h.role, content: h.text })),
      { role: "user", content: data.image ? [{ type: "text", text: user + att }, { type: "image_url", image_url: { url: data.image } }] : user + att },
    ];
    const r = await wisenComplete(messages);
    if (!r.ok) return { ok: false as const, route: route.primary, error: r.error };
    return { ok: true as const, route: route.primary, lang: route.lang, reason: route.reason, text: r.text, sources: kb.map((c) => ({ source: c.source, kind: c.kind })) };
  });
