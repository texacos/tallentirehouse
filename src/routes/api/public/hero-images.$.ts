import { createFileRoute } from "@tanstack/react-router";

// Streams hero images from the private `hero-slides` bucket with immutable
// caching. Paths are UUID-scoped and strictly validated, so no user-supplied
// string can ever reach an unrelated storage object.
const SAFE_PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(original|optimized)\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/i;

export const Route = createFileRoute("/api/public/hero-images/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = (params as { _splat?: string })._splat ?? "";
        if (!SAFE_PATH.test(key)) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { data, error } = await supabaseAdmin.storage
          .from("hero-slides")
          .download(key);

        if (error || !data) return new Response("Not found", { status: 404 });

        return new Response(data, {
          status: 200,
          headers: {
            "Content-Type": data.type || "application/octet-stream",
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": "inline",
          },
        });
      },
    },
  },
});
