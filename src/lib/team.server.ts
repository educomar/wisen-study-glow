import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type DB = SupabaseClient<Database>;
export type TeamRole = "admin" | "editor";
export type TeamCtx = { userId: string; email: string; role: TeamRole; status: string };

export async function loadTeam(sb: DB, userId: string): Promise<TeamCtx | null> {
  const [{ data: m }, { data: roles }] = await Promise.all([
    sb.from("team_members").select("*").eq("user_id", userId).maybeSingle(),
    sb.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (!m || m.deleted_at || !roles?.length) return null;
  return { userId, email: m.email, role: roles.some((r) => r.role === "admin") ? "admin" : "editor", status: m.status };
}

export async function requireTeam(sb: DB, userId: string, adminOnly = false): Promise<TeamCtx> {
  const t = await loadTeam(sb, userId);
  if (!t || t.status !== "active") throw new Error("Forbidden: no active Team access");
  if (adminOnly && t.role !== "admin") throw new Error("Forbidden: Admins only");
  return t;
}

export async function audit(
  sb: DB,
  t: Pick<TeamCtx, "userId" | "email" | "role">,
  action: string,
  entity_type: string,
  entity_id: string | null,
  entity_label = "",
  detail: Record<string, unknown> = {},
  result = "success",
) {
  await sb.from("audit_log").insert({
    actor_id: t.userId, actor_email: t.email, actor_role: t.role, action, entity_type,
    entity_id, entity_label, detail: detail as never, result,
  });
}

export async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export const newToken = () => (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
