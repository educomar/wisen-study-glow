import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Streams a curriculum lesson file the signed-in student is allowed to see (RLS-checked). */
export const Route = createFileRoute("/api/curriculum-file/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token || !/^[0-9a-f-]{36}$/i.test(params.id)) return new Response("Unauthorized", { status: 401 });
        const sb = createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: r } = await sb.from("lesson_resources").select("storage_path").eq("id", params.id).maybeSingle();
        if (!r) return new Response("Not found", { status: 404 });
        let upstream: Response;
        if (r.storage_path.startsWith("gdrive:")) {
          upstream = await fetch(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(r.storage_path.slice(7))}&export=download&confirm=t`);
        } else {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin.storage.from("resources").createSignedUrl(r.storage_path, 60);
          if (!data) return new Response("Not found", { status: 404 });
          upstream = await fetch(data.signedUrl);
        }
        if (!upstream.ok || !upstream.body) return new Response("File unavailable", { status: 502 });
        return new Response(upstream.body, { headers: { "Content-Type": "application/pdf", "Cache-Control": "private, max-age=3600" } });
      },
    },
  },
});
