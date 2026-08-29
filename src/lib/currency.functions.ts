// Admin server functions for the Currencies dashboard.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CurrencyRateRow = {
  id: string;
  base: string;
  quote: string;
  rate_date: string;
  rate: number;
  inverse_rate: number | null;
  source: string;
  fetched_at: string;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Permission check failed");
  if (!data) throw new Error("Not authorised");
}

export const adminListRates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: CurrencyRateRow[] }> => {
    const db = context.supabase as any;
    await assertAdmin(db, context.userId);

    const { data, error } = await db
      .from("currency_rates")
      .select("*")
      .eq("base", "USD")
      .eq("quote", "LKR")
      .order("rate_date", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as CurrencyRateRow[] };
  });

export const adminRefreshRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; error?: string; aramexError?: string }> => {
    const db = context.supabase as any;
    await assertAdmin(db, context.userId);
    try {
      const { refreshUsdLkrRate } = await import("./currency.server");
      await refreshUsdLkrRate();

      // Aramex Domestic prices are quoted in LKR, so they follow the rate.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { recalculateRates } = await import("./aramex-domestic.server");
      const recalc = await recalculateRates(supabaseAdmin as never, {
        kind: "manual",
        actorId: context.userId,
        actorLabel: (context.claims as any)?.email ?? context.userId,
      });
      return { ok: true, aramexError: recalc.ok ? undefined : recalc.error };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Fetch failed" };
    }
  });

