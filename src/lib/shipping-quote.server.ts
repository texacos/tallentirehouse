// Server-only shipping quote, reusable from checkout with any Supabase client.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  quote,
  type CarrierConfig,
  type Quote,
  type RateTier,
  type ShippingStatus,
  type Surcharge,
} from "./shipping-engine";

type Db = SupabaseClient<any, any, any>;
type Row = Record<string, unknown>;

export async function quoteShippingFor(
  db: Db,
  args: { country: string; weightKg: number; subtotal: number; carrierCode: string },
): Promise<{ quote: Quote | null; carrierName: string }> {
  const { data: carriers, error } = await db
    .from("shipping_carriers")
    .select(
      "id,code,name,currency,origin_country,max_weight_kg,weight_interval_kg,round_weight,free_shipping_threshold",
    )
    .eq("is_active", true)
    .eq("code", args.carrierCode)
    .limit(1);
  if (error) throw new Error(error.message);
  const row = (carriers ?? [])[0] as Row | undefined;
  if (!row) return { quote: null, carrierName: "" };

  const carrier: CarrierConfig = {
    id: row["id"] as string,
    code: row["code"] as string,
    name: row["name"] as string,
    currency: (row["currency"] as string) ?? "USD",
    originCountry: (row["origin_country"] as string) ?? "",
    maxWeightKg: Number(row["max_weight_kg"] ?? 0),
    weightIntervalKg: Number(row["weight_interval_kg"] ?? 0.5),
    roundWeight: Boolean(row["round_weight"] ?? true),
    freeShippingThreshold:
      row["free_shipping_threshold"] == null ? null : Number(row["free_shipping_threshold"]),
  };

  const { data: rules } = await db
    .from("shipping_country_rules")
    .select("status,rate_group_id")
    .eq("carrier_id", carrier.id)
    .ilike("country", args.country)
    .limit(1);
  const rule = (rules ?? [])[0] as Row | undefined;
  const status: ShippingStatus = rule ? (rule["status"] as ShippingStatus) : "no_service";

  let tiers: RateTier[] = [];
  if (status === "rated" && rule?.["rate_group_id"]) {
    const { data: tierRows } = await db
      .from("shipping_rate_tiers")
      .select("max_weight_kg,price")
      .eq("rate_group_id", rule["rate_group_id"] as string)
      .order("max_weight_kg");
    tiers = (tierRows ?? []).map((t: Row) => ({
      maxWeightKg: Number(t["max_weight_kg"]),
      price: Number(t["price"]),
    }));
  }

  const { data: surchargeRows } = await db
    .from("shipping_surcharges")
    .select("id,kind,label,calc,amount,country,is_active,starts_at,ends_at")
    .eq("carrier_id", carrier.id)
    .eq("is_active", true);
  const surcharges: Surcharge[] = (surchargeRows ?? []).map((s: Row) => ({
    id: s["id"] as string,
    kind: s["kind"] as Surcharge["kind"],
    label: s["label"] as string,
    calc: s["calc"] as Surcharge["calc"],
    amount: Number(s["amount"]),
    country: (s["country"] as string | null) ?? null,
    isActive: true,
    startsAt: (s["starts_at"] as string | null) ?? null,
    endsAt: (s["ends_at"] as string | null) ?? null,
  }));

  const result = quote({
    carrier,
    status,
    tiers,
    surcharges,
    country: args.country,
    weightKg: args.weightKg,
    subtotal: args.subtotal,
  });

  return { quote: result, carrierName: carrier.name };
}
