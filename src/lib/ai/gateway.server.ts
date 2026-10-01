/** Wisen AI engine (server-only). Streams a chat completion from the gateway and returns the full text. */
export const WISEN_MODEL = "google/gemini-3.8-flash";

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type ChatMsg = { role: "system" | "user" | "assistant"; content: string | Part[] };

export type GatewayResult = { ok: true; text: string } | { ok: false; status: number; error: "busy" | "credits" | "unavailable" };

export async function wisenComplete(messages: ChatMsg[], opts: { json?: boolean } = {}): Promise<GatewayResult> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { ok: false, status: 401, error: "unavailable" };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model: WISEN_MODEL, messages, stream: true, ...(opts.json ? { response_format: { type: "json_object" } } : {}) }),
  });
  if (!res.ok || !res.body) {
    console.error("wisen gateway", res.status, await res.text().catch(() => ""));
    return { ok: false, status: res.status, error: res.status === 429 ? "busy" : res.status === 402 || res.status === 403 ? "credits" : "unavailable" };
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try { const d = JSON.parse(payload)?.choices?.[0]?.delta?.content; if (typeof d === "string") text += d; } catch { /* partial */ }
    }
  }
  if (!text.trim()) return { ok: false, status: 200, error: "unavailable" };
  return { ok: true, text };
}

export function parseJson<T>(raw: string): T | null {
  const t = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(t) as T; } catch {
    const m = t.match(/\{[\s\S]*\}/);
    try { return m ? (JSON.parse(m[0]) as T) : null; } catch { return null; }
  }
}
