import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import {
  quote,
  type CarrierConfig,
  type Quote,
  type RateTier,
  type ShippingStatus,
  type Surcharge,
} from "./shipping-engine";

function publicClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

type Row = Record<string, unknown>;

function toCarrier(row: Row): CarrierConfig {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    currency: (row.currency as string) ?? "USD",
    originCountry: (row.origin_country as string) ?? "",
    maxWeightKg: Number(row.max_weight_kg ?? 0),
    weightIntervalKg: Number(row.weight_interval_kg ?? 0.5),
    roundWeight: Boolean(row.round_weight ?? true),
    freeShippingThreshold:
      row.free_shipping_threshold == null ? null : Number(row.free_shipping_threshold),
  };
}

async function loadCarrier(
  supabase: ReturnType<typeof publicClient>,
  carrierCode?: string,
): Promise<CarrierConfig | null> {
  let q = supabase
    .from("shipping_carriers")
    .select(
      "id,code,name,currency,origin_country,max_weight_kg,weight_interval_kg,round_weight,free_shipping_threshold",
    )
    .eq("is_active", true);
  if (carrierCode) q = q.eq("code", carrierCode);
  const { data, error } = await q
    .order("is_default", { ascending: false })
    .order("sort_order")
    .limit(1);
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as Row | undefined;
  return row ? toCarrier(row) : null;
}

async function loadCarriers(
  supabase: ReturnType<typeof publicClient>,
): Promise<CarrierConfig[]> {
  const { data, error } = await supabase
    .from("shipping_carriers")
    .select(
      "id,code,name,currency,origin_country,max_weight_kg,weight_interval_kg,round_weight,free_shipping_threshold",
    )
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toCarrier(r as Row));
}

export type ShippingDestination = { country: string; status: ShippingStatus };

/** Countries the active carrier knows about, with their service status. */
export const listShippingDestinations = createServerFn({ method: "GET" }).handler(
  async (): Promise<ShippingDestination[]> => {
    const supabase = publicClient();
    const carrier = await loadCarrier(supabase);
    if (!carrier) return [];
    const { data, error } = await supabase
      .from("shipping_country_rules")
      .select("country,status")
      .eq("carrier_id", carrier.id)
      .order("country");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Row) => ({
      country: r.country as string,
      status: r.status as ShippingStatus,
    }));
  },
);

export type ShippingQuoteResult = {
  quote: Quote | null;
  /** Admin-authored HTML shown when the destination can't be quoted. */
  message: string | null;
};

export const quoteShipping = createServerFn({ method: "POST" })
  .inputValidator((input: {
    country: string;
    weightKg: number;
    subtotal: number;
    carrierCode?: string;
  }) => {
    const country = String(input?.country ?? "").trim();
    const weightKg = Number(input?.weightKg ?? 0);
    const subtotal = Number(input?.subtotal ?? 0);
    if (!country) throw new Error("Country is required");
    if (!Number.isFinite(weightKg) || weightKg < 0) throw new Error("Invalid weight");
    if (!Number.isFinite(subtotal) || subtotal < 0) throw new Error("Invalid subtotal");
    return {
      country: country.slice(0, 120),
      weightKg,
      subtotal,
      carrierCode: input?.carrierCode ? String(input.carrierCode).slice(0, 60) : undefined,
    };
  })
  .handler(async ({ data }): Promise<ShippingQuoteResult> => {
    const supabase = publicClient();
    const carrier = await loadCarrier(supabase, data.carrierCode);
    if (!carrier) return { quote: null, message: null };
    return quoteForCarrier(supabase, carrier, data);
  });

async function quoteForCarrier(
  supabase: ReturnType<typeof publicClient>,
  carrier: CarrierConfig,
  data: { country: string; weightKg: number; subtotal: number },
): Promise<ShippingQuoteResult> {
    const { data: rules, error: ruleErr } = await supabase
      .from("shipping_country_rules")
      .select("status,rate_group_id")
      .eq("carrier_id", carrier.id)
      .ilike("country", data.country)
      .limit(1);
    if (ruleErr) throw new Error(ruleErr.message);
    const rule = (rules ?? [])[0] as Row | undefined;

    const status: ShippingStatus = rule
      ? (rule.status as ShippingStatus)
      : "no_service";

    let tiers: RateTier[] = [];
    if (status === "rated" && rule?.rate_group_id) {
      const { data: tierRows, error: tierErr } = await supabase
        .from("shipping_rate_tiers")
        .select("max_weight_kg,price")
        .eq("rate_group_id", rule.rate_group_id as string)
        .order("max_weight_kg");
      if (tierErr) throw new Error(tierErr.message);
      tiers = (tierRows ?? []).map((t: Row) => ({
        maxWeightKg: Number(t.max_weight_kg),
        price: Number(t.price),
      }));
    }

    const { data: surchargeRows, error: surErr } = await supabase
      .from("shipping_surcharges")
      .select("id,kind,label,calc,amount,country,is_active,starts_at,ends_at")
      .eq("carrier_id", carrier.id)
      .eq("is_active", true);
    if (surErr) throw new Error(surErr.message);
    const surcharges: Surcharge[] = (surchargeRows ?? []).map((s: Row) => ({
      id: s.id as string,
      kind: s.kind as Surcharge["kind"],
      label: s.label as string,
      calc: s.calc as Surcharge["calc"],
      amount: Number(s.amount),
      country: (s.country as string | null) ?? null,
      isActive: Boolean(s.is_active),
      startsAt: (s.starts_at as string | null) ?? null,
      endsAt: (s.ends_at as string | null) ?? null,
    }));

    const result = quote({
      carrier,
      status,
      tiers,
      surcharges,
      country: data.country,
      weightKg: data.weightKg,
      subtotal: data.subtotal,
    });

    let message: string | null = null;
    if (result.status !== "rated") {
      const { data: msgs } = await supabase
        .from("shipping_messages")
        .select("body_html")
        .eq("carrier_id", carrier.id)
        .eq("status", result.status)
        .limit(1);
      message = ((msgs ?? [])[0] as Row | undefined)?.body_html as string | null ?? null;
    }

    return { quote: result, message };
}

export type ShippingOption = {
  carrierCode: string;
  carrierName: string;
  quote: Quote | null;
  message: string | null;
};

/** Quotes for every active carrier, so the buyer can choose a delivery method. */
export const listShippingOptions = createServerFn({ method: "POST" })
  .inputValidator((input: { country: string; weightKg: number; subtotal: number }) => {
    const country = String(input?.country ?? "").trim();
    const weightKg = Number(input?.weightKg ?? 0);
    const subtotal = Number(input?.subtotal ?? 0);
    if (!country) throw new Error("Country is required");
    if (!Number.isFinite(weightKg) || weightKg < 0) throw new Error("Invalid weight");
    if (!Number.isFinite(subtotal) || subtotal < 0) throw new Error("Invalid subtotal");
    return { country: country.slice(0, 120), weightKg, subtotal };
  })
  .handler(async ({ data }): Promise<ShippingOption[]> => {
    const supabase = publicClient();
    const carriers = await loadCarriers(supabase);
    const results = await Promise.all(
      carriers.map(async (c) => {
        const r = await quoteForCarrier(supabase, c, data);
        return {
          carrierCode: c.code,
          carrierName: c.name,
          quote: r.quote,
          message: r.message,
        };
      }),
    );
    return results;
  });
