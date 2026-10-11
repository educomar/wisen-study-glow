import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit, loadTeam, newToken, requireTeam, safeEqual, sha256 } from "./team.server";

const INVITE_DAYS = 7;
const emailOf = (claims: { email?: unknown }) => String(claims.email ?? "").trim().toLowerCase();

/* ---------- Session / membership ---------- */

export const getMyTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const t = await loadTeam(context.supabase, context.userId);
    const { data: adminExists } = await context.supabase.rpc("admin_exists");
    return { team: t, adminExists: Boolean(adminExists), email: emailOf(context.claims) };
  });

export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.string().min(1).max(100), fullName: z.string().max(120).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const expected = process.env["ADMIN_SETUP_CODE"] ?? "";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) return { ok: false, error: "Admin setup is closed. Ask an existing Admin to invite you." };
    if (!expected || !safeEqual(data.code.trim(), expected)) return { ok: false, error: "Invalid Admin registration code." };
    const email = emailOf(context.claims);
    await supabaseAdmin.from("team_members").upsert({ user_id: context.userId, email, full_name: data.fullName ?? "", status: "active", deleted_at: null });
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    if (error) return { ok: false, error: "Could not create the Admin account." };
    await audit(context.supabase, { userId: context.userId, email, role: "admin" }, "created_admin_account", "team_member", context.userId, email, { via: "setup_code" });
    return { ok: true, error: null };
  });

/* ---------- Invitations ---------- */

export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string().trim().toLowerCase().email().max(255), role: z.enum(["editor", "admin"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("team_invitations").update({ status: "revoked" }).eq("email", data.email).eq("status", "pending");
    const token = newToken();
    const { data: inv, error } = await supabaseAdmin.from("team_invitations").insert({
      email: data.email, role: data.role, token_hash: await sha256(token),
      expires_at: new Date(Date.now() + INVITE_DAYS * 864e5).toISOString(), invited_by: t.userId,
    }).select("id").single();
    if (error || !inv) throw new Error("Could not create invitation");
    await audit(context.supabase, t, "sent_invitation", "invitation", inv.id, data.email, { role: data.role });
    return { token };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = newToken();
    const { data: inv } = await supabaseAdmin.from("team_invitations")
      .update({ token_hash: await sha256(token), status: "pending", expires_at: new Date(Date.now() + INVITE_DAYS * 864e5).toISOString() })
      .eq("id", data.id).in("status", ["pending", "expired"]).select("email").maybeSingle();
    if (!inv) throw new Error("Invitation can no longer be resent");
    await audit(context.supabase, t, "resent_invitation", "invitation", data.id, inv.email);
    return { token };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin.from("team_invitations").update({ status: "revoked" }).eq("id", data.id).eq("status", "pending").select("email").maybeSingle();
    if (!inv) throw new Error("Only pending invitations can be revoked");
    await audit(context.supabase, t, "revoked_invitation", "invitation", data.id, inv.email);
    return { ok: true };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().min(20).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin.from("team_invitations").select("*").eq("token_hash", await sha256(data.token)).maybeSingle();
    if (!inv || inv.status === "revoked") return { ok: false, error: "This invitation is invalid or was revoked." };
    if (inv.status === "accepted") return { ok: false, error: "This invitation has already been used." };
    if (new Date(inv.expires_at) < new Date()) {
      await supabaseAdmin.from("team_invitations").update({ status: "expired" }).eq("id", inv.id);
      return { ok: false, error: "This invitation has expired. Ask an Admin to resend it." };
    }
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = (u.user?.email ?? "").toLowerCase();
    if (!u.user?.email_confirmed_at || email !== inv.email.toLowerCase()) {
      return { ok: false, error: `This invitation is for ${inv.email}. Sign in with that exact email address.` };
    }
    const { data: claimed } = await supabaseAdmin.from("team_invitations")
      .update({ status: "accepted", accepted_by: context.userId, accepted_at: new Date().toISOString() })
      .eq("id", inv.id).eq("status", "pending").select("id").maybeSingle();
    if (!claimed) return { ok: false, error: "This invitation has already been used." };
    const name = String(u.user.user_metadata?.["full_name"] ?? u.user.user_metadata?.["name"] ?? "");
    await supabaseAdmin.from("team_members").upsert({ user_id: context.userId, email, full_name: name, status: "active", deleted_at: null });
    await supabaseAdmin.from("user_roles").upsert({ user_id: context.userId, role: inv.role }, { onConflict: "user_id,role" });
    await audit(context.supabase, { userId: context.userId, email, role: inv.role }, "accepted_invitation", "invitation", inv.id, email, { role: inv.role });
    return { ok: true, error: null };
  });

/* ---------- Team management ---------- */

export const setMemberStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), status: z.enum(["active", "frozen"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId, true);
    if (data.userId === t.userId) throw new Error("You cannot change your own status");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin.from("team_members").update({ status: data.status }).eq("user_id", data.userId).is("deleted_at", null).select("email").maybeSingle();
    if (!m) throw new Error("Member not found");
    await audit(context.supabase, t, data.status === "frozen" ? "froze_account" : "unfroze_account", "team_member", data.userId, m.email);
    return { ok: true };
  });

export const deleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId, true);
    if (data.userId === t.userId) throw new Error("You cannot delete yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId);
    const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if (roles?.some((r) => r.role === "admin") && (count ?? 0) <= 1) throw new Error("Cannot remove the last Admin");
    const { data: m } = await supabaseAdmin.from("team_members").update({ deleted_at: new Date().toISOString(), status: "frozen" }).eq("user_id", data.userId).select("email").maybeSingle();
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await audit(context.supabase, t, "deleted_member", "team_member", data.userId, m?.email ?? "");
    return { ok: true };
  });

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), role: z.enum(["admin", "editor"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId, true);
    if (data.userId === t.userId) throw new Error("You cannot change your own role");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin.from("team_members").select("email").eq("user_id", data.userId).is("deleted_at", null).maybeSingle();
    if (!m) throw new Error("Member not found");
    if (data.role === "admin") {
      await supabaseAdmin.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin.from("user_roles").upsert({ user_id: data.userId, role: "editor" }, { onConflict: "user_id,role" });
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    }
    await audit(context.supabase, t, data.role === "admin" ? "promoted_to_admin" : "changed_to_editor", "team_member", data.userId, m.email);
    return { ok: true };
  });

export const updateMemberName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), fullName: z.string().trim().max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("team_members").update({ full_name: data.fullName }).eq("user_id", data.userId);
    await audit(context.supabase, t, "edited_member", "team_member", data.userId, data.fullName);
    return { ok: true };
  });

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireTeam(context.supabase, context.userId, true);
    const [{ data: members }, { data: roles }, { data: invites }] = await Promise.all([
      context.supabase.from("team_members").select("*").is("deleted_at", null).order("created_at"),
      context.supabase.from("user_roles").select("user_id, role"),
      context.supabase.from("team_invitations").select("id, email, role, status, expires_at, created_at, accepted_at").order("created_at", { ascending: false }).limit(100),
    ]);
    const now = Date.now();
    return {
      members: (members ?? []).map((m) => ({ ...m, role: roles?.some((r) => r.user_id === m.user_id && r.role === "admin") ? "admin" : "editor" })),
      invites: (invites ?? []).map((i) => ({ ...i, status: i.status === "pending" && new Date(i.expires_at).getTime() < now ? "expired" : i.status })),
    };
  });

export const listStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireTeam(context.supabase, context.userId, true);
    const { data: profiles } = await context.supabase.from("profiles").select("id, full_name, faculty, department, academic_year, current_target_exam, created_at").order("created_at", { ascending: false });
    const { data: team } = await context.supabase.from("team_members").select("user_id");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const emails = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? ""]));
    const teamIds = new Set((team ?? []).map((m) => m.user_id));
    return (profiles ?? []).filter((p) => !teamIds.has(p.id)).map((p) => ({ ...p, email: emails.get(p.id) ?? "" }));
  });

/* ---------- Academic content ---------- */

const TABLES = ["subjects", "units", "lessons", "qbank_questions", "team_flashcards", "kb_entries"] as const;
type Table = (typeof TABLES)[number];
const LABEL: Record<Table, string> = { subjects: "subject", units: "unit", lessons: "lesson", qbank_questions: "question", team_flashcards: "flashcard", kb_entries: "kb_entry" };
const FIELDS: Record<Table, string[]> = {
  subjects: ["name", "faculty", "department", "academic_year", "position"],
  units: ["subject_id", "name", "position"],
  lessons: ["unit_id", "name", "position"],
  qbank_questions: ["lesson_id", "stem", "options", "answer", "answers", "explanation", "difficulty"],
  team_flashcards: ["lesson_id", "front", "back"],
  kb_entries: ["title", "category", "content"],
};
const labelOf = (v: Record<string, unknown>) => String(v["name"] ?? v["title"] ?? v["stem"] ?? v["front"] ?? "").slice(0, 120);

export const saveContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ table: z.enum(TABLES), id: z.string().uuid().optional(), values: z.record(z.string(), z.unknown()) }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId, data.table === "kb_entries");
    const values: Record<string, unknown> = {};
    for (const k of FIELDS[data.table]) if (k in data.values) values[k] = data.values[k];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tbl = () => context.supabase.from(data.table) as any;
    if (data.id) {
      if (data.table === "qbank_questions") {
        const { data: cur } = await context.supabase.from("qbank_questions").select("*").eq("id", data.id).single();
        if (!cur) throw new Error("Question not found");
        await context.supabase.from("question_versions").insert({ question_id: cur.id, version: cur.version, snapshot: cur as never, changed_by: t.userId, changed_by_email: t.email, note: "before edit" });
        values["version"] = cur.version + 1;
        values["updated_by"] = t.userId;
      }
      const { error } = await tbl().update(values).eq("id", data.id);
      if (error) { await audit(context.supabase, t, "edited_content", LABEL[data.table], data.id, labelOf(values), {}, "failed"); throw new Error(error.message); }
      await audit(context.supabase, t, "edited_content", LABEL[data.table], data.id, labelOf(values));
      return { id: data.id };
    }
    values["created_by"] = t.userId;
    const { data: row, error } = await tbl().insert(values).select("id").single();
    if (error) throw new Error(error.message);
    await audit(context.supabase, t, "added_content", LABEL[data.table], row.id, labelOf(values));
    return { id: row.id as string };
  });

export const deleteContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ table: z.enum(TABLES), id: z.string().uuid(), label: z.string().max(200).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId, data.table === "kb_entries");
    if (data.table === "qbank_questions") {
      const { data: cur } = await context.supabase.from("qbank_questions").select("*").eq("id", data.id).maybeSingle();
      if (cur) await context.supabase.from("question_versions").insert({ question_id: cur.id, version: cur.version, snapshot: cur as never, changed_by: t.userId, changed_by_email: t.email, note: "deleted" });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase.from(data.table) as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.supabase, t, "deleted_content", LABEL[data.table], data.id, data.label ?? "");
    return { ok: true };
  });

export const restoreVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ versionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId, true);
    const { data: v } = await context.supabase.from("question_versions").select("*").eq("id", data.versionId).single();
    if (!v) throw new Error("Version not found");
    const snap = v.snapshot as Record<string, unknown>;
    const { data: cur } = await context.supabase.from("qbank_questions").select("*").eq("id", v.question_id).maybeSingle();
    if (!cur) throw new Error("The question was deleted; restoring deleted questions isn't supported");
    await context.supabase.from("question_versions").insert({ question_id: cur.id, version: cur.version, snapshot: cur as never, changed_by: t.userId, changed_by_email: t.email, note: `before restore to v${v.version}` });
    await context.supabase.from("qbank_questions").update({
      stem: String(snap["stem"]), options: snap["options"] as never, answer: Number(snap["answer"]),
      explanation: String(snap["explanation"] ?? ""), difficulty: String(snap["difficulty"] ?? "Medium"),
      version: cur.version + 1, updated_by: t.userId,
    }).eq("id", cur.id);
    await audit(context.supabase, t, "restored_version", "question", cur.id, String(snap["stem"]).slice(0, 120), { restored_version: v.version });
    return { ok: true };
  });

/* ---------- Resources (files) ---------- */

export const resourceUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ fileName: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireTeam(context.supabase, context.userId);
    const safe = data.fileName.replace(/[^\w.\-]+/g, "_").slice(-120);
    const path = `${crypto.randomUUID()}/${safe}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s, error } = await supabaseAdmin.storage.from("resources").createSignedUploadUrl(path);
    if (error || !s) throw new Error("Could not prepare upload");
    return { path: s.path, token: s.token };
  });

export const saveResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid().optional(), subject_id: z.string().uuid(), unit_id: z.string().uuid(), lesson_id: z.string().uuid().nullable(),
    file_name: z.string().max(200), storage_path: z.string().max(300), mime_type: z.string().max(120), size_bytes: z.number().int().nonnegative(),
    kind: z.enum(["course", "past_emd"]).default("course"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...vals } = data;
    if (id) {
      const { data: old } = await context.supabase.from("lesson_resources").select("storage_path").eq("id", id).single();
      const { error } = await context.supabase.from("lesson_resources").update({ file_name: vals.file_name, storage_path: vals.storage_path, mime_type: vals.mime_type, size_bytes: vals.size_bytes, uploaded_by: t.userId }).eq("id", id);
      if (error) throw new Error(error.message);
      if (old?.storage_path && !old.storage_path.startsWith("gdrive:")) await supabaseAdmin.storage.from("resources").remove([old.storage_path]);
      await audit(context.supabase, t, "replaced_file", "resource", id, vals.file_name);
      return { id };
    }
    const { data: row, error } = await context.supabase.from("lesson_resources").insert({ ...vals, uploaded_by: t.userId }).select("id").single();
    if (error || !row) throw new Error(error?.message ?? "Save failed");
    await audit(context.supabase, t, "uploaded_file", "resource", row.id, vals.file_name);
    return { id: row.id };
  });

export const resourceDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireTeam(context.supabase, context.userId);
    const { data: r } = await context.supabase.from("lesson_resources").select("storage_path").eq("id", data.id).single();
    if (!r) throw new Error("Not found");
    if (r.storage_path.startsWith("gdrive:")) return { url: `https://drive.google.com/file/d/${encodeURIComponent(r.storage_path.slice(7))}/view` };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.storage.from("resources").createSignedUrl(r.storage_path, 300);
    return { url: s?.signedUrl ?? "" };
  });

export const deleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId);
    const { data: r } = await context.supabase.from("lesson_resources").select("storage_path, file_name").eq("id", data.id).single();
    if (!r) throw new Error("Not found");
    await context.supabase.from("lesson_resources").delete().eq("id", data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!r.storage_path.startsWith("gdrive:")) await supabaseAdmin.storage.from("resources").remove([r.storage_path]);
    await audit(context.supabase, t, "deleted_file", "resource", data.id, r.file_name);
    return { ok: true };
  });

/* ---------- QBank bulk import ---------- */

const importQ = z.object({
  stem: z.string().trim().min(1).max(4000),
  options: z.array(z.string().trim().min(1).max(1000)).min(2).max(5),
  answers: z.array(z.number().int().min(0).max(4)).min(1).max(5),
  explanation: z.string().max(6000).default(""),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).default("Medium"),
});

export const bulkImportQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lessonId: z.string().uuid(), questions: z.array(importQ).min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId);
    const rows = data.questions.map((q) => {
      const answers = [...new Set(q.answers.filter((a) => a < q.options.length))].sort();
      if (!answers.length) throw new Error("Every question needs at least one valid correct option.");
      return { lesson_id: data.lessonId, stem: q.stem, options: q.options, answer: answers[0]!, answers, explanation: q.explanation, difficulty: q.difficulty, created_by: t.userId };
    });
    const { data: saved, error } = await context.supabase.from("qbank_questions").insert(rows).select("id");
    if (error) { await audit(context.supabase, t, "bulk_import", "question", null, `${rows.length} questions`, {}, "failed"); throw new Error(error.message); }
    await audit(context.supabase, t, "bulk_import", "question", data.lessonId, `${saved.length} questions`, { count: saved.length });
    return { count: saved.length };
  });

export const aiParseQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().trim().min(20).max(60000), context: z.string().max(300).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    await requireTeam(context.supabase, context.userId);
    const { wisenComplete, parseJson } = await import("./ai/gateway.server");
    const system = `You are Wisen AI, structuring raw past-exam text (French or English) from the Faculty of Medicine, Université Ferhat Abbas Sétif 1 into QCM/QCU questions. Keep each stem and option faithful to the source (fix only OCR spacing), keep the source language. Never invent or merge questions; skip unreadable ones. Max 5 options (A–E). If an answer key is present, use it exactly; otherwise determine the correct option(s) from established medical knowledge. A question may have one (QCU) or several (QCM) correct options. If an explanation is missing, write a concise medically accurate rationale explaining why the correct options are right and the distractors wrong. Difficulty is Easy, Medium or Hard.
Return JSON only: {"questions":[{"stem":"...","options":["..."],"answers":[0-based indices],"explanation":"...","difficulty":"Medium","keyFromSource":true}]}`;
    const r = await wisenComplete([{ role: "system", content: system }, { role: "user", content: `${data.context ? `Context: ${data.context}\n\n` : ""}RAW EXAM TEXT:\n${data.text}` }], { json: true });
    if (!r.ok) throw new Error(r.error === "credits" ? "Wisen AI is out of credits right now." : r.error === "busy" ? "Wisen AI is busy — try again in a minute." : "Wisen AI couldn't parse this text. Try again.");
    const parsed = parseJson<{ questions?: { stem?: string; options?: string[]; answers?: number[]; explanation?: string; difficulty?: string; keyFromSource?: boolean }[] }>(r.text);
    const qs = (parsed?.questions ?? []).flatMap((q) => {
      const options = (q.options ?? []).map((o) => String(o).trim()).filter(Boolean).slice(0, 5);
      const answers = [...new Set((q.answers ?? []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < options.length))];
      if (!q.stem || options.length < 2) return [];
      const difficulty = ["Easy", "Medium", "Hard"].includes(String(q.difficulty)) ? String(q.difficulty) : "Medium";
      return [{ stem: String(q.stem).trim(), options, answers, explanation: String(q.explanation ?? ""), difficulty, aiKey: !q.keyFromSource }];
    });
    if (!qs.length) throw new Error("No readable questions were found in this text.");
    return qs;
  });
