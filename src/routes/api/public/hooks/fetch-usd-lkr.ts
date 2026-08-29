import { createFileRoute } from "@tanstack/react-router";

// Scheduled endpoint: fetches the CBSL indicative USD/LKR spot rate and stores
// it. Called weekly by the database scheduler with the backend anon key.
export const Route = createFileRoute("/api/public/hooks/fetch-usd-lkr")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        const expected =
          process.env["SUPABASE_ANON_KEY"] ??
          process.env["SUPABASE_PUBLISHABLE_KEY"] ??
          "";

        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { refreshUsdLkrRate } = await import("@/lib/currency.server");
          const result = await refreshUsdLkrRate();

          // Aramex Domestic prices are held in LKR, so a new rate must be
          // applied straight away. A failure here never disturbs the live
          // prices — it is recorded and reported in the Shipping dashboard.
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { recalculateRates } = await import("@/lib/aramex-domestic.server");
          const recalc = await recalculateRates(supabaseAdmin as never, {
            kind: "scheduled",
            actorId: null,
            actorLabel: "scheduled task",
          });

          return Response.json({ ...result, aramexDomestic: recalc });
        } catch (e) {

          console.error("USD/LKR rate fetch failed", e);
          return new Response(
            JSON.stringify({
              ok: false,
              error: e instanceof Error ? e.message : "Fetch failed",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
