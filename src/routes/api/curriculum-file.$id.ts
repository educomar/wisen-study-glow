import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

function guessType(name: string, stored: string) {
  if (stored && stored !== "application/octet-stream") return stored;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return ({ pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } as Record<string, string>)[ext] ?? "application/octet-stream";
}

/**
 * Streams a curriculum file to a signed-in user. The token is verified with the auth server,
 * and the resource row is read *as that user*, so RLS (student profile match or active Team) decides access.
 */
export const Route = createFileRoute("/api/curriculum-file/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) return json(400, "Invalid file id");
        if (token.split(".").length !== 3) return json(401, "Sign in required");
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const sb = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
          global: { headers: { Authorization: `Bearer ${token}`, apikey: key } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: u, error: ue } = await sb.auth.getUser(token);
        if (ue || !u.user) return json(401, "Session expired");

        const { data: r, error } = await sb.from("lesson_resources").select("storage_path,file_name,mime_type").eq("id", params.id).maybeSingle();
        if (error) return json(500, "Lookup failed");
        if (!r) return json(404, "File not found or not available for your year");

        const type = guessType(r.file_name, r.mime_type);
        let upstream: Response;
        try {
          if (r.storage_path.startsWith("gdrive:")) {
            const id = r.storage_path.slice(7);
            if (!/^[\w-]{10,}$/.test(id)) return json(500, "Bad file reference");
            upstream = await fetch(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`, { redirect: "follow" });
          } else {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data } = await supabaseAdmin.storage.from("resources").createSignedUrl(r.storage_path, 60);
            if (!data) return json(404, "File missing from storage");
            upstream = await fetch(data.signedUrl);
          }
        } catch {
          return json(502, "File source unreachable");
        }
        // Drive returns an HTML page (not the file) when the file isn't shared publicly or is quota-limited.
        const upType = upstream.headers.get("content-type") ?? "";
        if (!upstream.ok || !upstream.body || upType.includes("text/html")) return json(502, "File is not available from its source right now");

        const safeName = r.file_name.replace(/[^\w.\- ()]/g, "_");
        const headers = new Headers({
          "Content-Type": type,
          "Content-Disposition": `inline; filename="${safeName}"`,
          "Cache-Control": "private, max-age=600",
          "X-Content-Type-Options": "nosniff",
          Vary: "Authorization",
        });
        const len = upstream.headers.get("content-length");
        if (len) headers.set("Content-Length", len);
        return new Response(upstream.body, { headers });
      },
    },
  },
});
