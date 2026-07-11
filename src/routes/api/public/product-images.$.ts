import { createFileRoute } from "@tanstack/react-router";

// Streams product images from the private `product-images` storage bucket.
// The bucket is private (workspace policy blocks public buckets) so we
// proxy reads through the server with a long cache lifetime.
export const Route = createFileRoute("/api/public/product-images/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = (params as { _splat?: string })._splat ?? "";
        if (!key) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { data, error } = await supabaseAdmin.storage
          .from("product-images")
          .download(key);

        if (error || !data) {
          return new Response("Not found", { status: 404 });
        }

        return new Response(data, {
          status: 200,
          headers: {
            "Content-Type": data.type || "application/octet-stream",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
