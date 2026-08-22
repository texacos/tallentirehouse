import { createFileRoute } from "@tanstack/react-router";

// Ziina payment status callback. The body is never trusted: we take only the
// payment-intent id and re-read the authoritative status from the Ziina API
// with our secret key before touching an order.
export const Route = createFileRoute("/api/public/ziina-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let intentId = "";
        try {
          const body = (await request.json()) as Record<string, unknown>;
          const data = (body["data"] ?? body) as Record<string, unknown>;
          const raw = data["id"] ?? data["payment_intent_id"] ?? body["id"];
          intentId = typeof raw === "string" ? raw.slice(0, 120) : "";
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (!intentId) return new Response("Bad request", { status: 400 });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { settleOrder } = await import("@/lib/checkout.server");
          const { data: order } = await supabaseAdmin
            .from("orders")
            .select("*")
            .eq("payment_intent_id", intentId)
            .maybeSingle();
          if (!order) return new Response("ok");
          await settleOrder(supabaseAdmin as never, order);
          return new Response("ok");
        } catch (e) {
          console.error("[ziina-webhook] failed", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
