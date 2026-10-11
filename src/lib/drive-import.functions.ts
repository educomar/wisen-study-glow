import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit, requireTeam } from "./team.server";

const FOLDER = "application/vnd.google-apps.folder";
type Item = { id: string; name: string; mimeType: string; size: number; createdTime: string | null; children?: Item[] };

/** Recursively crawls a Drive folder through the linked Google Drive connection, or a public folder with an API key. */
export const crawlDriveFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ folderId: z.string().regex(/^[\w-]{10,}$/), apiKey: z.string().trim().max(120).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireTeam(context.supabase, context.userId);
    const lov = process.env["LOVABLE_API_KEY"], conn = process.env["GOOGLE_DRIVE_API_KEY"];
    const useKey = Boolean(data.apiKey);
    if (!useKey && (!lov || !conn)) throw new Error("Google Drive isn't connected. Add a Google Drive API key to crawl a public folder.");
    let calls = 0, total = 0;
    const get = async (path: string, params: Record<string, string>) => {
      if (++calls > 400) throw new Error("This folder is too large to crawl at once. Import one subject at a time.");
      const qs = new URLSearchParams({ ...params, supportsAllDrives: "true", ...(useKey ? { key: data.apiKey! } : {}) });
      const url = useKey ? `https://www.googleapis.com/drive/v3${path}?${qs}` : `https://connector-gateway.lovable.dev/google_drive/drive/v3${path}?${qs}`;
      const res = await fetch(url, { headers: useKey ? {} : { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": conn! } });
      if (!res.ok) {
        const body = await res.text();
        console.error("drive crawl", res.status, body.slice(0, 300));
        if (res.status === 404) throw new Error("Folder not found. Check the link, and that it's shared with the connected account (or public when using an API key).");
        if (res.status === 403) throw new Error("Google Drive denied access to this folder.");
        throw new Error(`Google Drive error (${res.status}).`);
      }
      return res.json() as Promise<Record<string, unknown>>;
    };
    const root = await get(`/files/${data.folderId}`, { fields: "id,name,mimeType,createdTime" }) as { id: string; name: string; mimeType: string; createdTime?: string };
    if (root.mimeType !== FOLDER) throw new Error("This link points to a file, not a folder.");
    const list = async (id: string): Promise<Item[]> => {
      const out: Item[] = [];
      let pageToken = "";
      do {
        const r = await get("/files", {
          q: `'${id}' in parents and trashed = false`, pageSize: "1000", includeItemsFromAllDrives: "true",
          fields: "nextPageToken,files(id,name,mimeType,size,createdTime,shortcutDetails)", ...(pageToken ? { pageToken } : {}),
        }) as { nextPageToken?: string; files?: { id: string; name: string; mimeType: string; size?: string; createdTime?: string; shortcutDetails?: { targetId: string; targetMimeType: string } }[] };
        for (const f of r.files ?? []) {
          if (++total > 5000) throw new Error("More than 5,000 items — import a smaller folder.");
          const sc = f.mimeType === "application/vnd.google-apps.shortcut" ? f.shortcutDetails : undefined;
          out.push({ id: sc?.targetId ?? f.id, name: f.name, mimeType: sc?.targetMimeType ?? f.mimeType, size: Number(f.size ?? 0), createdTime: f.createdTime ?? null });
        }
        pageToken = r.nextPageToken ?? "";
      } while (pageToken);
      for (let i = 0; i < out.length; i += 6) {
        await Promise.all(out.slice(i, i + 6).filter((x) => x.mimeType === FOLDER).map(async (x) => { x.children = await list(x.id); }));
      }
      return out;
    };
    const tree: Item = { id: root.id, name: root.name, mimeType: FOLDER, size: 0, createdTime: root.createdTime ?? null, children: await list(root.id) };
    return { root: tree, total };
  });

/** Wisen AI title standardization for raw folder/file names. */
export const standardizeDriveNames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    items: z.array(z.object({ k: z.string().max(80), raw: z.string().max(300), type: z.enum(["subject", "unit", "lesson", "file"]) })).min(1).max(150),
    context: z.string().max(200).default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireTeam(context.supabase, context.userId);
    const { wisenComplete, parseJson } = await import("./ai/gateway.server");
    const system = `You are Wisen AI, standardizing Google Drive folder and file names for the curriculum of the Faculty of Medicine, Université Ferhat Abbas Sétif 1.
For each item return a clean, professional medical Title Case name:
- Remove professor names (Dr/Pr/Prof X), dates, years, academic-year ranges, course codes, numbering prefixes, emojis, underscores and version/status tags (cours_, TD_, TP_, v2, final, copie, new).
- Preserve the source language and official medical terminology exactly (do not translate; keep accents and acronyms like ECG, ADN, SNV).
- Do not invent content. Keep it concise. Files: do NOT include the file extension.
- For files, set "emd": true when it is a past exam (EMD, QCM, Rattrapage, Sujet, Examen), else false.
Return JSON only: {"items":[{"k":"<same k>","name":"...","emd":false}]}`;
    const r = await wisenComplete([{ role: "system", content: system }, { role: "user", content: `${data.context ? `Context: ${data.context}\n` : ""}${JSON.stringify(data.items)}` }], { json: true });
    if (!r.ok) throw new Error(r.error === "credits" ? "Wisen AI is out of credits right now." : r.error === "busy" ? "Wisen AI is busy — try again in a minute." : "Wisen AI couldn't standardize these names.");
    const parsed = parseJson<{ items?: { k?: string; name?: string; emd?: boolean }[] }>(r.text);
    const ok = new Set(data.items.map((i) => i.k));
    return (parsed?.items ?? []).filter((i) => i.k && ok.has(i.k) && i.name?.trim()).map((i) => ({ k: i.k!, name: i.name!.trim().slice(0, 200), emd: Boolean(i.emd) }));
  });

const fileZ = z.object({ driveId: z.string().regex(/^[\w-]{10,}$/), name: z.string().trim().min(1).max(200), mimeType: z.string().max(120), size: z.number().int().nonnegative(), createdTime: z.string().max(40).nullable(), kind: z.enum(["course", "past_emd"]) });
const ref = { matchId: z.string().uuid().or(z.literal("")), name: z.string().trim().max(200) };
const lessonZ = z.object({ ...ref, files: z.array(fileZ).max(500) });
const unitZ = z.object({ ...ref, lessons: z.array(lessonZ).max(300), files: z.array(fileZ).max(500) });
const subjectZ = z.object({ ...ref, units: z.array(unitZ).max(100) });

/** Creates subjects → units → lessons → lesson_resources (gdrive:<id>) in one audited batch. Existing Drive files are skipped. */
export const commitDriveImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    department: z.string().trim().min(2).max(60), academicYear: z.number().int().min(1).max(7),
    level: z.enum(["year", "subject", "unit"]), folderId: z.string().max(80), subjects: z.array(subjectZ).min(1).max(40),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await requireTeam(context.supabase, context.userId);
    const sb = context.supabase;
    const count = { subjects: 0, units: 0, lessons: 0, files: 0, skipped: 0 };
    const allIds = data.subjects.flatMap((s) => s.units.flatMap((u) => [...u.files, ...u.lessons.flatMap((l) => l.files)].map((f) => `gdrive:${f.driveId}`)));
    const existing = new Set<string>();
    for (let i = 0; i < allIds.length; i += 200) {
      const { data: rows } = await sb.from("lesson_resources").select("storage_path").in("storage_path", allIds.slice(i, i + 200));
      for (const r of rows ?? []) existing.add(r.storage_path);
    }
    const need = (name: string, what: string) => { if (!name) throw new Error(`A new ${what} needs a name.`); return name; };
    const one = async <T,>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) => { const { data: d, error } = await p; if (error || !d) throw new Error(error?.message ?? "Save failed"); return d; };
    const addFiles = async (subject_id: string, unit_id: string, lesson_id: string | null, files: z.infer<typeof fileZ>[]) => {
      const rows = files.filter((f) => !existing.has(`gdrive:${f.driveId}`)).map((f) => {
        existing.add(`gdrive:${f.driveId}`);
        return { subject_id, unit_id, lesson_id, file_name: f.name, storage_path: `gdrive:${f.driveId}`, mime_type: f.mimeType || "application/octet-stream", size_bytes: f.size, kind: f.kind, drive_created_at: f.createdTime, uploaded_by: t.userId };
      });
      count.skipped += files.length - rows.length;
      if (!rows.length) return;
      const { error } = await sb.from("lesson_resources").insert(rows);
      if (error) throw new Error(error.message);
      count.files += rows.length;
    };
    try {
      for (const [si, s] of data.subjects.entries()) {
        const subject_id = s.matchId || (await one(sb.from("subjects").insert({ name: need(s.name, "subject"), department: data.department, academic_year: data.academicYear, faculty: "Faculty of Medicine — Sétif 1", position: 100 + si, created_by: t.userId }).select("id").single())).id;
        if (!s.matchId) count.subjects++;
        for (const [ui, u] of s.units.entries()) {
          const unit_id = u.matchId || (await one(sb.from("units").insert({ subject_id, name: need(u.name, "unit"), position: 100 + ui, created_by: t.userId }).select("id").single())).id;
          if (!u.matchId) count.units++;
          await addFiles(subject_id, unit_id, null, u.files);
          for (const [li, l] of u.lessons.entries()) {
            const lesson_id = l.matchId || (await one(sb.from("lessons").insert({ unit_id, name: need(l.name, "lesson"), position: 100 + li, created_by: t.userId }).select("id").single())).id;
            if (!l.matchId) count.lessons++;
            await addFiles(subject_id, unit_id, lesson_id, l.files);
          }
        }
      }
    } catch (e) {
      await audit(sb, t, "drive_import", "curriculum", null, `Drive ${data.folderId}`, { ...count, level: data.level, error: (e as Error).message }, "failed");
      throw new Error(`Import stopped: ${(e as Error).message}. Items saved before the error were kept; re-running skips files already imported.`);
    }
    await audit(sb, t, "drive_import", "curriculum", null, `Drive ${data.folderId}`, { ...count, level: data.level, department: data.department, year: data.academicYear });
    return count;
  });
