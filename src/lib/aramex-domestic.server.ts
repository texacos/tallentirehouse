/**
 * Server-only data layer for the Aramex Domestic (Sri Lanka) carrier.
 *
 * Responsibilities: CSV ingestion, LKR→USD recalculation (versioned and
 * atomic), city resolution and quoting. All pricing rules live in the pure
 * `aramex-domestic.ts` module; this file only does I/O.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import {
  ARAMEX_DOMESTIC_CODE,
  ARAMEX_DOMESTIC_COUNTRY,
  ARAMEX_DOMESTIC_NAME,
  CHARGEABLE_RATE_GROUPS,
  MSG_CITY_UNMATCHED,
  MSG_INVALID_WEIGHT,
  MSG_NO_RATE_CITY,
  MSG_OVER_MAX_WEIGHT,
  cityKey,
  convertLkrToUsd,
  limitKey,
  parseRoundingRule,
  roundingSetting,
  searchCities,
  validateCityRows,
  validateRateRows,
  type ChargeableRateGroup,
  type CityRecord,
  type CsvIssue,
  type RateMatrix,
  type RoundingRule,
} from "./aramex-domestic";
import { quote, type CarrierConfig, type Quote, type RateTier, type Surcharge } from "./shipping-engine";

type Db = SupabaseClient<any, any, any>;

export const MSG_SELECT_CITY =
  "Select your delivery city in Sri Lanka to calculate the Aramex Domestic rate.";

/* ------------------------------------------------------------------ config */

export type AramexSettings = {
  rule: RoundingRule;
  rounding_mode: string;
  rounding_increment: number;
  rounding_decimals: number;
  rounding_changed_at: string | null;
  cities_imported_at: string | null;
  cities_source_filename: string;
  last_run_kind: string;
  last_run_at: string | null;
  last_status: string;
  last_error: string | null;
};

export async function loadSettings(db: Db): Promise<AramexSettings> {
  const { data, error } = await db
    .from("aramex_domestic_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, any>;
  return {
    rule: parseRoundingRule(row),
    rounding_mode: row["rounding_mode"] ?? "increment",
    rounding_increment: Number(row["rounding_increment"] ?? 1),
    rounding_decimals: Number(row["rounding_decimals"] ?? 2),
    rounding_changed_at: row["rounding_changed_at"] ?? null,
    cities_imported_at: row["cities_imported_at"] ?? null,
    cities_source_filename: row["cities_source_filename"] ?? "",
    last_run_kind: row["last_run_kind"] ?? "",
    last_run_at: row["last_run_at"] ?? null,
    last_status: row["last_status"] ?? "idle",
    last_error: row["last_error"] ?? null,
  };
}

async function markRun(
  db: Db,
  patch: { kind: string; status: string; error?: string | null },
): Promise<void> {
  await db
    .from("aramex_domestic_settings")
    .update({
      last_run_kind: patch.kind,
      last_run_at: new Date().toISOString(),
      last_status: patch.status,
      last_error: patch.error ?? null,
    })
    .eq("id", true);
}

async function audit(
  db: Db,
  entry: {
    actorId: string | null;
    actorLabel: string;
    action: string;
    summary: string;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await db.from("admin_audit_log").insert({
    actor_id: entry.actorId,
    actor_label: entry.actorLabel.slice(0, 160),
    action: entry.action,
    entity: "aramex_domestic",
    entity_id: null,
    summary: entry.summary.slice(0, 500),
    details: entry.details ?? {},
  });
  if (error) console.error("[aramex-domestic] audit write failed", error.message);
}

/* ----------------------------------------------------------- exchange rate */

export type ExchangeRateRow = {
  id: string;
  rate: number;
  rate_date: string;
  fetched_at: string;
};

export async function loadExchangeRate(db: Db): Promise<ExchangeRateRow> {
  const { data, error } = await db
    .from("currency_rates")
    .select("id,rate,rate_date,fetched_at")
    .eq("base", "USD")
    .eq("quote", "LKR")
    .order("rate_date", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as Record<string, any> | undefined;
  if (!row) throw new Error("No USD/LKR exchange rate is stored yet — refresh the Currencies dashboard first.");
  const rate = Number(row["rate"]);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("The stored USD/LKR exchange rate is invalid.");
  return {
    id: row["id"] as string,
    rate,
    rate_date: row["rate_date"] as string,
    fetched_at: row["fetched_at"] as string,
  };
}

/* -------------------------------------------------------------- rate reads */

export type RateVersion = {
  id: string;
  status: string;
  weight_limits: number[];
  source_filename: string;
  exchange_rate: number | null;
  exchange_rate_date: string | null;
  exchange_rate_fetched_at: string | null;
  rounding_mode: string | null;
  rounding_setting: number | null;
  calculated_at: string | null;
  initiated_by: string;
  actor_label: string;
  created_at: string;
};

export type RateRow = {
  rate_group: ChargeableRateGroup;
  weight_limit_kg: number;
  lkr_rate: number;
  unrounded_usd: number | null;
  usd_rate: number | null;
};

export async function loadActiveVersion(
  db: Db,
): Promise<{ version: RateVersion; rates: RateRow[] } | null> {
  const { data, error } = await db
    .from("aramex_domestic_rate_versions")
    .select("*")
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const version = normalizeVersion(data as Record<string, any>);
  const { data: rateRows, error: rateErr } = await db
    .from("aramex_domestic_rates")
    .select("rate_group,weight_limit_kg,lkr_rate,unrounded_usd,usd_rate")
    .eq("version_id", version.id)
    .order("rate_group")
    .order("weight_limit_kg");
  if (rateErr) throw new Error(rateErr.message);
  return { version, rates: (rateRows ?? []).map(normalizeRate) };
}

function normalizeVersion(row: Record<string, any>): RateVersion {
  return {
    id: row["id"],
    status: row["status"],
    weight_limits: (row["weight_limits"] ?? []).map((n: unknown) => Number(n)),
    source_filename: row["source_filename"] ?? "",
    exchange_rate: row["exchange_rate"] == null ? null : Number(row["exchange_rate"]),
    exchange_rate_date: row["exchange_rate_date"] ?? null,
    exchange_rate_fetched_at: row["exchange_rate_fetched_at"] ?? null,
    rounding_mode: row["rounding_mode"] ?? null,
    rounding_setting: row["rounding_setting"] == null ? null : Number(row["rounding_setting"]),
    calculated_at: row["calculated_at"] ?? null,
    initiated_by: row["initiated_by"] ?? "manual",
    actor_label: row["actor_label"] ?? "",
    created_at: row["created_at"],
  };
}

function normalizeRate(row: Record<string, any>): RateRow {
  return {
    rate_group: row["rate_group"],
    weight_limit_kg: Number(row["weight_limit_kg"]),
    lkr_rate: Number(row["lkr_rate"]),
    unrounded_usd: row["unrounded_usd"] == null ? null : Number(row["unrounded_usd"]),
    usd_rate: row["usd_rate"] == null ? null : Number(row["usd_rate"]),
  };
}

export async function listVersionHistory(db: Db, limit = 20): Promise<RateVersion[]> {
  const { data, error } = await db
    .from("aramex_domestic_rate_versions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => normalizeVersion(r as Record<string, any>));
}

/* ------------------------------------------------------------ city storage */

export async function loadCities(db: Db): Promise<CityRecord[]> {
  const all: CityRecord[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("aramex_domestic_cities")
      .select("city,city_key,locality,district,rate_group")
      .order("city")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Record<string, any>[];
    all.push(
      ...rows.map((r) => ({
        city: r["city"],
        cityKey: r["city_key"],
        locality: r["locality"],
        district: r["district"],
        rateGroup: r["rate_group"],
      })),
    );
    if (rows.length < pageSize) break;
  }
  return all;
}

export async function countCities(db: Db): Promise<{ total: number; noRate: number }> {
  const total = await db
    .from("aramex_domestic_cities")
    .select("id", { count: "exact", head: true });
  const noRate = await db
    .from("aramex_domestic_cities")
    .select("id", { count: "exact", head: true })
    .eq("rate_group", "NO_RATE");
  return { total: total.count ?? 0, noRate: noRate.count ?? 0 };
}

export async function findCity(db: Db, city: string): Promise<CityRecord | null> {
  const key = cityKey(city);
  if (!key) return null;
  const { data, error } = await db
    .from("aramex_domestic_cities")
    .select("city,city_key,locality,district,rate_group")
    .eq("city_key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as Record<string, any>;
  return {
    city: r["city"],
    cityKey: r["city_key"],
    locality: r["locality"],
    district: r["district"],
    rateGroup: r["rate_group"],
  };
}

/** Server-side autocomplete: narrows in SQL, then ranks with the pure scorer. */
export async function suggestCities(db: Db, term: string, limit = 8): Promise<CityRecord[]> {
  const q = cityKey(term);
  if (q.length < 2) return [];
  const escaped = q.replace(/[%_]/g, (m) => `\\${m}`);
  const { data, error } = await db
    .from("aramex_domestic_cities")
    .select("city,city_key,locality,district,rate_group")
    .ilike("city_key", `%${escaped}%`)
    .limit(60);
  if (error) throw new Error(error.message);
  const records = (data ?? []).map((r: Record<string, any>) => ({
    city: r["city"],
    cityKey: r["city_key"],
    locality: r["locality"],
    district: r["district"],
    rateGroup: r["rate_group"],
  })) as CityRecord[];
  return searchCities(term, records, limit);
}

/* ------------------------------------------------------------ CSV ingestion */

function parseCsv(text: string): string[][] {
  const res = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
  });
  return (res.data ?? []).map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? "")) : []));
}

export type CityImportResult = {
  ok: boolean;
  issues: CsvIssue[];
  created: number;
  updated: number;
  total: number;
  noRate: number;
};

/** Replaces the whole city list atomically-ish: validate everything, then upsert. */
export async function importCities(
  db: Db,
  args: { csv: string; filename: string; actorId: string | null; actorLabel: string },
): Promise<CityImportResult> {
  const parsed = validateCityRows(parseCsv(args.csv));
  if (!parsed.ok) {
    return { ok: false, issues: parsed.issues.slice(0, 50), created: 0, updated: 0, total: 0, noRate: 0 };
  }

  const before = await loadCities(db);
  const beforeKeys = new Set(before.map((c) => c.cityKey));

  const now = new Date().toISOString();
  const payload = parsed.rows.map((r) => ({
    city: r.city,
    city_key: r.cityKey,
    locality: r.locality,
    district: r.district,
    rate_group: r.rateGroup,
    updated_at: now,
  }));

  for (let i = 0; i < payload.length; i += 500) {
    const { error } = await db
      .from("aramex_domestic_cities")
      .upsert(payload.slice(i, i + 500), { onConflict: "city_key" });
    if (error) throw new Error(`Could not save cities: ${error.message}`);
  }

  // Remove cities that are no longer in the authoritative file.
  const keepKeys = new Set(parsed.rows.map((r) => r.cityKey));
  const stale = before.filter((c) => !keepKeys.has(c.cityKey)).map((c) => c.cityKey);
  for (let i = 0; i < stale.length; i += 500) {
    const { error } = await db
      .from("aramex_domestic_cities")
      .delete()
      .in("city_key", stale.slice(i, i + 500));
    if (error) throw new Error(`Could not remove stale cities: ${error.message}`);
  }

  const created = parsed.rows.filter((r) => !beforeKeys.has(r.cityKey)).length;
  await db
    .from("aramex_domestic_settings")
    .update({ cities_imported_at: now, cities_source_filename: args.filename.slice(0, 200) })
    .eq("id", true);

  await audit(db, {
    actorId: args.actorId,
    actorLabel: args.actorLabel,
    action: "aramex_domestic.cities_import",
    summary: `Imported ${parsed.rows.length} Aramex Domestic cities from ${args.filename}`,
    details: { created, removed: stale.length, counts: parsed.counts },
  });

  return {
    ok: true,
    issues: [],
    created,
    updated: parsed.rows.length - created,
    total: parsed.rows.length,
    noRate: parsed.counts.NO_RATE,
  };
}

/* -------------------------------------------------- conversion / versioning */

export type RecalcResult = {
  ok: boolean;
  error?: string;
  issues?: CsvIssue[];
  versionId?: string;
  rateCount?: number;
  exchangeRate?: number;
  exchangeRateDate?: string;
};

type LkrSource = { weightLimitsKg: number[]; matrix: RateMatrix["prices"]; filename: string };

function sourceFromRates(version: RateVersion, rates: RateRow[]): LkrSource {
  const matrix = {} as RateMatrix["prices"];
  for (const g of CHARGEABLE_RATE_GROUPS) matrix[g] = {};
  for (const r of rates) {
    matrix[r.rate_group][limitKey(r.weight_limit_kg)] = r.lkr_rate.toFixed(4);
  }
  return {
    weightLimitsKg: version.weight_limits,
    matrix,
    filename: version.source_filename,
  };
}

/**
 * Builds a new candidate rate version from an LKR source, converts every cell
 * with the current exchange rate and rounding rule, then activates it in a
 * single step. The previous version stays live until activation succeeds.
 */
async function buildAndActivate(
  db: Db,
  args: {
    source: LkrSource;
    kind: "manual" | "scheduled" | "import";
    actorId: string | null;
    actorLabel: string;
  },
): Promise<RecalcResult> {
  const settings = await loadSettings(db);
  const fx = await loadExchangeRate(db);
  const rule = settings.rule;

  const rows: {
    rate_group: ChargeableRateGroup;
    weight_limit_kg: number;
    lkr_rate: number;
    unrounded_usd: number;
    usd_rate: number;
  }[] = [];

  for (const group of CHARGEABLE_RATE_GROUPS) {
    const cells = args.source.matrix[group];
    if (!cells) throw new Error(`Missing LKR prices for ${group}`);
    for (const limit of args.source.weightLimitsKg) {
      const lkr = cells[limitKey(limit)];
      if (!lkr) throw new Error(`Missing LKR price for ${group} at ${limit} kg`);
      const { unroundedUsd, usd } = convertLkrToUsd(lkr, fx.rate, rule);
      if (!(usd > 0)) throw new Error(`Converted price for ${group} at ${limit} kg is not positive`);
      rows.push({
        rate_group: group,
        weight_limit_kg: limit,
        lkr_rate: Number(lkr),
        unrounded_usd: unroundedUsd,
        usd_rate: usd,
      });
    }
  }

  const now = new Date().toISOString();
  const { data: version, error: versionErr } = await db
    .from("aramex_domestic_rate_versions")
    .insert({
      status: "candidate",
      weight_limits: args.source.weightLimitsKg,
      source_filename: args.source.filename,
      exchange_rate_id: fx.id,
      exchange_rate: fx.rate,
      exchange_rate_date: fx.rate_date,
      exchange_rate_fetched_at: fx.fetched_at,
      rounding_mode: rule.mode,
      rounding_setting: roundingSetting(rule),
      calculated_at: now,
      initiated_by: args.kind,
      actor_id: args.actorId,
      actor_label: args.actorLabel.slice(0, 160),
    })
    .select("id")
    .single();
  if (versionErr) throw new Error(versionErr.message);
  const versionId = (version as Record<string, any>)["id"] as string;

  const { error: rateErr } = await db
    .from("aramex_domestic_rates")
    .insert(rows.map((r) => ({ ...r, version_id: versionId })));
  if (rateErr) {
    await db.from("aramex_domestic_rate_versions").delete().eq("id", versionId);
    throw new Error(rateErr.message);
  }

  const { error: activateErr } = await db.rpc("aramex_activate_rate_version", {
    _version_id: versionId,
  });
  if (activateErr) {
    await db.from("aramex_domestic_rate_versions").delete().eq("id", versionId);
    throw new Error(activateErr.message);
  }

  await audit(db, {
    actorId: args.actorId,
    actorLabel: args.actorLabel,
    action: `aramex_domestic.rates_${args.kind === "import" ? "import" : "recalculate"}`,
    summary: `Aramex Domestic rates ${args.kind === "import" ? "imported and converted" : "recalculated"} at ${fx.rate} LKR/USD (${rows.length} prices)`,
    details: {
      versionId,
      kind: args.kind,
      exchangeRate: fx.rate,
      exchangeRateDate: fx.rate_date,
      rounding: { mode: rule.mode, setting: roundingSetting(rule) },
      rateCount: rows.length,
    },
  });

  return {
    ok: true,
    versionId,
    rateCount: rows.length,
    exchangeRate: fx.rate,
    exchangeRateDate: fx.rate_date,
  };
}

/** Imports the domestic rate CSV (LKR) and publishes converted USD prices. */
export async function importRates(
  db: Db,
  args: { csv: string; filename: string; actorId: string | null; actorLabel: string },
): Promise<RecalcResult> {
  const parsed = validateRateRows(parseCsv(args.csv));
  if (!parsed.ok || !parsed.matrix) {
    return { ok: false, error: "The rate CSV could not be validated.", issues: parsed.issues.slice(0, 50) };
  }
  try {
    const result = await buildAndActivate(db, {
      source: {
        weightLimitsKg: parsed.matrix.weightLimitsKg,
        matrix: parsed.matrix.prices,
        filename: args.filename.slice(0, 200),
      },
      kind: "import",
      actorId: args.actorId,
      actorLabel: args.actorLabel,
    });
    await markRun(db, { kind: "import", status: "success" });
    return result;
  } catch (e) {
    const error = e instanceof Error ? e.message : "Import failed";
    await markRun(db, { kind: "import", status: "failed", error });
    return { ok: false, error };
  }
}

/** Re-converts the stored LKR prices with the newest exchange rate. */
export async function recalculateRates(
  db: Db,
  args: { kind: "manual" | "scheduled"; actorId: string | null; actorLabel: string },
): Promise<RecalcResult> {
  try {
    const active = await loadActiveVersion(db);
    if (!active) {
      throw new Error("Import the Aramex Domestic rate CSV before recalculating.");
    }
    const result = await buildAndActivate(db, {
      source: sourceFromRates(active.version, active.rates),
      kind: args.kind,
      actorId: args.actorId,
      actorLabel: args.actorLabel,
    });
    await markRun(db, { kind: args.kind, status: "success" });
    return result;
  } catch (e) {
    const error = e instanceof Error ? e.message : "Recalculation failed";
    console.error("[aramex-domestic] recalculation failed", e);
    await markRun(db, { kind: args.kind, status: "failed", error });
    await audit(db, {
      actorId: args.actorId,
      actorLabel: args.actorLabel,
      action: "aramex_domestic.rates_recalculate_failed",
      summary: `Aramex Domestic recalculation failed: ${error}`,
      details: { kind: args.kind },
    });
    return { ok: false, error };
  }
}

export async function setRounding(
  db: Db,
  args: { rule: RoundingRule; actorId: string | null; actorLabel: string },
): Promise<RecalcResult> {
  const { error } = await db
    .from("aramex_domestic_settings")
    .update({
      rounding_mode: args.rule.mode,
      rounding_increment: args.rule.mode === "increment" ? args.rule.increment : 1,
      rounding_decimals: args.rule.mode === "decimals" ? args.rule.decimals : 2,
      rounding_changed_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) throw new Error(error.message);

  await audit(db, {
    actorId: args.actorId,
    actorLabel: args.actorLabel,
    action: "aramex_domestic.rounding_changed",
    summary: `Aramex Domestic rounding set to ${args.rule.mode} (${roundingSetting(args.rule)})`,
    details: { rule: args.rule },
  });

  const active = await loadActiveVersion(db);
  if (!active) return { ok: true };
  return recalculateRates(db, {
    kind: "manual",
    actorId: args.actorId,
    actorLabel: args.actorLabel,
  });
}

/* ----------------------------------------------------------------- quoting */

export type AramexQuoteResult = {
  quote: Quote | null;
  message: string | null;
  /** Everything needed to reproduce this price later, stored on the order. */
  snapshot: Record<string, unknown> | null;
};

export function isAramexDomestic(carrierCode: string): boolean {
  return carrierCode === ARAMEX_DOMESTIC_CODE;
}

/**
 * Quotes Aramex Domestic. The city (not the country) chooses the rate group;
 * the weight band is selected by the shared engine, whose 0.5 kg interval and
 * inclusive upper limits match the Aramex table exactly.
 */
export async function quoteAramexDomestic(
  db: Db,
  carrier: CarrierConfig,
  args: { country: string; city: string; weightKg: number; subtotal: number },
): Promise<AramexQuoteResult> {
  const base = {
    carrierCode: carrier.code,
    carrierName: carrier.name,
    currency: carrier.currency,
    country: args.country,
    billableWeightKg: 0,
  };

  if ((args.country ?? "").trim().toLowerCase() !== ARAMEX_DOMESTIC_COUNTRY.toLowerCase()) {
    return {
      quote: { ...base, status: "no_service", reason: "unsupported" },
      message: null,
      snapshot: null,
    };
  }
  if (!Number.isFinite(args.weightKg) || args.weightKg <= 0) {
    return {
      quote: { ...base, status: "no_rate", reason: "no_tier" },
      message: MSG_INVALID_WEIGHT,
      snapshot: null,
    };
  }

  const cityInput = (args.city ?? "").trim();
  if (!cityInput) {
    return {
      quote: { ...base, status: "no_rate", reason: "unsupported" },
      message: MSG_SELECT_CITY,
      snapshot: null,
    };
  }

  const record = await findCity(db, cityInput);
  if (!record) {
    return {
      quote: { ...base, status: "no_rate", reason: "unsupported" },
      message: MSG_CITY_UNMATCHED,
      snapshot: null,
    };
  }
  if (record.rateGroup === "NO_RATE") {
    return {
      quote: { ...base, status: "no_rate", reason: "unsupported" },
      message: MSG_NO_RATE_CITY,
      snapshot: null,
    };
  }

  const active = await loadActiveVersion(db);
  if (!active) {
    return {
      quote: { ...base, status: "no_rate", reason: "no_tier" },
      message: MSG_INVALID_WEIGHT,
      snapshot: null,
    };
  }

  const tiers: RateTier[] = active.rates
    .filter((r) => r.rate_group === record.rateGroup && r.usd_rate != null)
    .map((r) => ({ maxWeightKg: r.weight_limit_kg, price: r.usd_rate! }))
    .sort((a, b) => a.maxWeightKg - b.maxWeightKg);

  const { data: surchargeRows } = await db
    .from("shipping_surcharges")
    .select("id,kind,label,calc,amount,country,is_active,starts_at,ends_at")
    .eq("carrier_id", carrier.id)
    .eq("is_active", true);
  const surcharges: Surcharge[] = (surchargeRows ?? []).map((s: Record<string, any>) => ({
    id: s["id"],
    kind: s["kind"],
    label: s["label"],
    calc: s["calc"],
    amount: Number(s["amount"]),
    country: s["country"] ?? null,
    isActive: true,
    startsAt: s["starts_at"] ?? null,
    endsAt: s["ends_at"] ?? null,
  }));

  const result = quote({
    carrier: { ...carrier, maxWeightKg: Math.max(...tiers.map((t) => t.maxWeightKg), 0) },
    status: "rated",
    tiers,
    surcharges,
    country: args.country,
    weightKg: args.weightKg,
    subtotal: args.subtotal,
  });

  if (result.status !== "rated") {
    return { quote: result, message: MSG_OVER_MAX_WEIGHT, snapshot: null };
  }

  return {
    quote: result,
    message: null,
    snapshot: {
      carrier: ARAMEX_DOMESTIC_NAME,
      carrierCode: ARAMEX_DOMESTIC_CODE,
      city: record.city,
      rateGroup: record.rateGroup,
      weightKg: args.weightKg,
      billableWeightKg: result.billableWeightKg,
      weightLimitKg: result.tierMaxWeightKg,
      usdRate: result.baseAmount,
      total: result.total,
      rateVersionId: active.version.id,
      exchangeRate: active.version.exchange_rate,
      exchangeRateDate: active.version.exchange_rate_date,
      roundingMode: active.version.rounding_mode,
      roundingSetting: active.version.rounding_setting,
      calculatedAt: active.version.calculated_at,
      quotedAt: new Date().toISOString(),
    },
  };
}
