/** Dedicated admin text processor; never used by student Wisen AI. */
export const ADMIN_EXAM_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";
export async function adminExamCompletion(system: string, content: string): Promise<unknown> {
  const key = process.env["OPENROUTER_API_KEY"];
  if (!key) throw new Error("The admin processing key is not configured.");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: ADMIN_EXAM_MODEL, stream: true, max_tokens: 16000,
      messages: [{ role: "system", content: system }, { role: "user", content }] }),
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error(response.status === 429 ? "Admin processing is rate limited. Wait before starting a new request." : response.status === 402 ? "The processing provider requires available credits." : response.status === 401 || response.status === 403 ? "The processing provider denied access. Check the configured account permissions." : response.status === 404 ? "The selected processing model is unavailable." : `Admin processing failed (${response.status}).`);
  }
  let buffer = "", output = "", finish = "";
  const reader = response.body.getReader(), decoder = new TextDecoder();
  const consume = (line: string) => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim(); if (!payload || payload === "[DONE]") return;
    let value; try { value = JSON.parse(payload); } catch { return; }
    if (value.error) throw new Error("The processing provider stopped this request.");
    const choice = value.choices?.[0];
    if (choice?.delta?.refusal || choice?.finish_reason === "content_filter") throw new Error("The processing provider declined this request.");
    if (typeof choice?.delta?.content === "string") output += choice.delta.content;
    if (choice?.finish_reason) finish = choice.finish_reason;
  };
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end; while ((end = buffer.indexOf("\n")) >= 0) { consume(buffer.slice(0, end).trim()); buffer = buffer.slice(end + 1); }
    }
    if (buffer.trim()) consume(buffer.trim());
  } finally { reader.releaseLock(); }
  if (finish === "length") throw new Error("The response was incomplete. Use a smaller question batch.");
  if (!output.trim()) throw new Error("The processing provider returned no content.");
  const text = output.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(text); } catch { throw new Error("The model returned invalid JSON. No questions were saved."); }
}