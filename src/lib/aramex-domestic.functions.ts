// Server functions for the Aramex Domestic carrier (public city lookup +
// admin import / conversion / diagnostics). Thin wrappers only.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  describeRounding,
  parseRoundingRule,
  type CityRateGroup,
  type CsvIssue,
  type RoundingRule,
} from "./aramex-domestic";

export type CitySuggestion = { city: string; rateGroup: CityRateGroup };

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

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

/* --------------------------------------------------------------- public API */

export const suggestAramexCities = createServerFn({ method: "POST" })
  .inputValidator((input: { term: string }) => ({
    term: String(input?.term ?? "").trim().slice(0, 120),
  }))
  .handler(async ({ data }): Promise<CitySuggestion[]> => {
    if (data.term.length < 2) return [];
    const { suggestCities } = await import("./aramex-domestic.server");
    const rows = await suggestCities(publicClient() as never, data.term, 8);
    return rows.map((r) => ({ city: r.city, rateGroup: r.rateGroup }));
  });

/* ---------------------------------------------------------------- admin API */

export type AramexOverview = {
  cities: { total: number; noRate: number; importedAt: string | null; filename: string };
  rounding: { mode: string; increment: number; decimals: number; label: string; changedAt: string | null };
  lastRun: { kind: string; at: string | null; status: string; error: string | null };
  exchangeRate: { rate: number; date: string; fetchedAt: string } | null;
  active:
    | {
        versionId: string;
        weightLimits: number[];
        calculatedAt: string | null;
        exchangeRate: number | null;
        exchangeRateDate: string | null;
        roundingMode: string | null;
        roundingSetting: number | null;
        initiatedBy: string;
        sourceFilename: string;
        rates: {
          rate_group: string;
          weight_limit_kg: number;
          lkr_rate: number;
          unrounded_usd: number | null;
          usd_rate: number | null;
        }[];
      }
    | null;
  history: {
    id: string;
    status: string;
    createdAt: string;
    initiatedBy: string;
    actorLabel: string;
    exchangeRate: number | null;
    exchangeRateDate: string | null;
    roundingMode: string | null;
    roundingSetting: number | null;
  }[];
};

export const adminAramexOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AramexOverview> => {
    await assertAdmin(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never;
    const {
      loadSettings,
      loadActiveVersion,
      listVersionHistory,
      countCities,
      loadExchangeRate,
    } = await import("./aramex-domestic.server");

    const settings = await loadSettings(db);
    const active = await loadActiveVersion(db);
    const history = await listVersionHistory(db, 20);
    const cities = await countCities(db);

    let exchangeRate: AramexOverview["exchangeRate"] = null;
    try {
      const fx = await loadExchangeRate(db);
      exchangeRate = { rate: fx.rate, date: fx.rate_date, fetchedAt: fx.fetched_at };
    } catch {
      exchangeRate = null;
    }

    return {
      cities: {
        total: cities.total,
        noRate: cities.noRate,
        importedAt: settings.cities_imported_at,
        filename: settings.cities_source_filename,
      },
      rounding: {
        mode: settings.rounding_mode,
        increment: settings.rounding_increment,
        decimals: settings.rounding_decimals,
        label: describeRounding(settings.rule),
        changedAt: settings.rounding_changed_at,
      },
      lastRun: {
        kind: settings.last_run_kind,
        at: settings.last_run_at,
        status: settings.last_status,
        error: settings.last_error,
      },
      exchangeRate,
      active: active
        ? {
            versionId: active.version.id,
            weightLimits: active.version.weight_limits,
            calculatedAt: active.version.calculated_at,
            exchangeRate: active.version.exchange_rate,
            exchangeRateDate: active.version.exchange_rate_date,
            roundingMode: active.version.rounding_mode,
            roundingSetting: active.version.rounding_setting,
            initiatedBy: active.version.initiated_by,
            sourceFilename: active.version.source_filename,
            rates: active.rates,
          }
        : null,
      history: history.map((v) => ({
        id: v.id,
        status: v.status,
        createdAt: v.created_at,
        initiatedBy: v.initiated_by,
        actorLabel: v.actor_label,
        exchangeRate: v.exchange_rate,
        exchangeRateDate: v.exchange_rate_date,
        roundingMode: v.rounding_mode,
        roundingSetting: v.rounding_setting,
      })),
    };
  });

function csvInput(input: { csv: string; filename: string }) {
  const csv = String(input?.csv ?? "");
  if (!csv.trim()) throw new Error("The file is empty");
  if (csv.length > 4_000_000) throw new Error("The file is too large (4 MB limit)");
  return { csv, filename: String(input?.filename ?? "upload.csv").slice(0, 200) };
}

export const adminImportAramexCities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(csvInput)
  .handler(async ({ data, context }): Promise<{
    ok: boolean;
    error?: string;
    issues?: CsvIssue[];
    created?: number;
    updated?: number;
    total?: number;
    noRate?: number;
  }> => {
    await assertAdmin(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { importCities } = await import("./aramex-domestic.server");
    try {
      const res = await importCities(supabaseAdmin as never, {
        csv: data.csv,
        filename: data.filename,
        actorId: context.userId,
        actorLabel: (context.claims as any)?.email ?? context.userId,
      });
      return res.ok
        ? { ok: true, created: res.created, updated: res.updated, total: res.total, noRate: res.noRate }
        : { ok: false, error: "The city CSV could not be validated.", issues: res.issues };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Import failed" };
    }
  });

export const adminImportAramexRates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(csvInput)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { importRates } = await import("./aramex-domestic.server");
    return importRates(supabaseAdmin as never, {
      csv: data.csv,
      filename: data.filename,
      actorId: context.userId,
      actorLabel: (context.claims as any)?.email ?? context.userId,
    });
  });

export const adminRecalculateAramexRates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recalculateRates } = await import("./aramex-domestic.server");
    return recalculateRates(supabaseAdmin as never, {
      kind: "manual",
      actorId: context.userId,
      actorLabel: (context.claims as any)?.email ?? context.userId,
    });
  });

export const adminSetAramexRounding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mode: string; increment?: number; decimals?: number }) => {
    const rule: RoundingRule = parseRoundingRule({
      rounding_mode: String(input?.mode ?? "increment"),
      rounding_increment: Number(input?.increment ?? 1),
      rounding_decimals: Number(input?.decimals ?? 2),
    });
    return { rule };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { setRounding } = await import("./aramex-domestic.server");
    try {
      return await setRounding(supabaseAdmin as never, {
        rule: data.rule,
        actorId: context.userId,
        actorLabel: (context.claims as any)?.email ?? context.userId,
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Could not save rounding" };
    }
  });

export type AramexTestResult = {
  matchedCity: string | null;
  rateGroup: string | null;
  message: string | null;
  billableWeightKg: number | null;
  weightLimitKg: number | null;
  total: number | null;
};

export const adminTestAramexRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { city: string; weightKg: number; subtotal?: number }) => ({
    city: String(input?.city ?? "").trim().slice(0, 160),
    weightKg: Number(input?.weightKg ?? 0),
    subtotal: Number(input?.subtotal ?? 0),
  }))
  .handler(async ({ data, context }): Promise<AramexTestResult> => {
    await assertAdmin(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never;
    const { quoteAramexDomestic, findCity } = await import("./aramex-domestic.server");
    const { ARAMEX_DOMESTIC_CODE, ARAMEX_DOMESTIC_COUNTRY } = await import("./aramex-domestic");

    const { data: carrierRow } = await supabaseAdmin
      .from("shipping_carriers")
      .select("id,code,name,currency,origin_country,max_weight_kg,weight_interval_kg,round_weight,free_shipping_threshold")
      .eq("code", ARAMEX_DOMESTIC_CODE)
      .maybeSingle();
    if (!carrierRow) {
      return {
        matchedCity: null,
        rateGroup: null,
        message: "The Aramex Domestic carrier is not configured.",
        billableWeightKg: null,
        weightLimitKg: null,
        total: null,
      };
    }
    const r = carrierRow as Record<string, any>;
    const record = await findCity(db, data.city);
    const res = await quoteAramexDomestic(
      db,
      {
        id: r["id"],
        code: r["code"],
        name: r["name"],
        currency: r["currency"] ?? "USD",
        originCountry: r["origin_country"] ?? "",
        maxWeightKg: Number(r["max_weight_kg"] ?? 6),
        weightIntervalKg: Number(r["weight_interval_kg"] ?? 0.5),
        roundWeight: Boolean(r["round_weight"] ?? true),
        freeShippingThreshold:
          r["free_shipping_threshold"] == null ? null : Number(r["free_shipping_threshold"]),
      },
      {
        country: ARAMEX_DOMESTIC_COUNTRY,
        city: data.city,
        weightKg: data.weightKg,
        subtotal: data.subtotal,
      },
    );

    const q = res.quote;
    return {
      matchedCity: record?.city ?? null,
      rateGroup: record?.rateGroup ?? null,
      message: res.message,
      billableWeightKg: q?.billableWeightKg ?? null,
      weightLimitKg: q && q.status === "rated" ? q.tierMaxWeightKg : null,
      total: q && q.status === "rated" ? q.total : null,
    };
  });
