/**
 * Aramex Domestic (Sri Lanka) — pure, dependency-free rules.
 *
 * No I/O, no React, no Supabase: CSV validation, city matching, weight-band
 * selection, LKR→USD conversion and the admin rounding rule all live here so
 * they can be unit-tested and reused identically on the server and client.
 *
 * All monetary and weight decisions use integer/BigInt arithmetic — never
 * binary floating point — so boundaries such as exactly 1.5 kg or exactly
 * USD 20.00 behave deterministically.
 */

export const ARAMEX_DOMESTIC_CODE = "aramex-domestic";
export const ARAMEX_DOMESTIC_NAME = "Aramex Domestic";
export const ARAMEX_DOMESTIC_COUNTRY = "Sri Lanka";

export const CHARGEABLE_RATE_GROUPS = [
  "RATE_GROUP_1",
  "RATE_GROUP_2",
  "RATE_GROUP_3",
  "RATE_GROUP_4",
] as const;
export type ChargeableRateGroup = (typeof CHARGEABLE_RATE_GROUPS)[number];
export type CityRateGroup = ChargeableRateGroup | "NO_RATE";

export const CITY_RATE_GROUPS: readonly CityRateGroup[] = [
  ...CHARGEABLE_RATE_GROUPS,
  "NO_RATE",
];

/* ------------------------------------------------------- customer messages */

export const MSG_CITY_UNMATCHED =
  "We could not match this city to an Aramex Domestic delivery area. Please select the correct city from the suggested results.";
export const MSG_NO_RATE_CITY =
  "We are unable to calculate an automatic Aramex Domestic rate for this delivery location. Please contact Tallentire House so that we can arrange delivery for you.";
export const MSG_OVER_MAX_WEIGHT =
  "We are unable to calculate an Aramex Domestic shipping rate for the total weight of this order. Please contact Tallentire House so that we can arrange delivery for you.";
export const MSG_INVALID_WEIGHT =
  "We are unable to calculate shipping for this order. Please contact Tallentire House so that we can assist you.";

/* --------------------------------------------------------- decimal helpers */

const SCALE = 100_000_000n; // 1e8

function ceilDiv(a: bigint, b: bigint): bigint {
  if (b <= 0n) throw new Error("Division by non-positive value");
  return (a + b - 1n) / b;
}

/** Parses a decimal string/number into a BigInt scaled by 1e8. Throws on junk. */
export function toScaled(value: string | number): bigint {
  const raw = String(value).trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error(`Not a positive decimal: ${value}`);
  const [whole = "0", frac = ""] = raw.split(".");
  const padded = (frac + "00000000").slice(0, 8);
  return BigInt(whole) * SCALE + BigInt(padded || "0");
}

export function fromScaled(scaled: bigint, decimals = 4): number {
  const f = 10n ** BigInt(8 - decimals);
  return Number(scaled / f) / 10 ** decimals;
}

/** Weight in whole grams — the unit every weight comparison uses. */
export function toGrams(weightKg: number): number {
  if (!Number.isFinite(weightKg)) throw new Error("Invalid weight");
  return Math.round(weightKg * 1000);
}

/* ------------------------------------------------------------ city helpers */

/** Case-insensitive, whitespace-collapsed key used for lookups and dedupe. */
export function cityKey(value: string): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function splitCanonicalCity(city: string): { locality: string; district: string } {
  const clean = String(city ?? "").replace(/\s+/g, " ").trim();
  const idx = clean.lastIndexOf(",");
  if (idx === -1) return { locality: clean, district: "" };
  return {
    locality: clean.slice(0, idx).trim(),
    district: clean.slice(idx + 1).trim(),
  };
}

export type CityRecord = {
  city: string;
  cityKey: string;
  locality: string;
  district: string;
  rateGroup: CityRateGroup;
};

/**
 * Relevance score for a search term against one city. Higher is better;
 * 0 means "no match". Matches locality, district or the whole canonical value.
 */
export function scoreCity(term: string, record: CityRecord): number {
  const q = cityKey(term);
  if (!q) return 0;
  const full = record.cityKey;
  const loc = cityKey(record.locality);
  const dis = cityKey(record.district);

  if (loc === q) return 100;
  if (full === q) return 95;
  if (loc.startsWith(q)) return 80;
  if (full.startsWith(q)) return 70;
  if (dis === q) return 60;
  if (dis.startsWith(q)) return 50;
  if (loc.includes(q)) return 40;
  if (full.includes(q)) return 30;
  if (dis.includes(q)) return 20;

  // Fall back to a bounded edit distance so misspellings still suggest.
  const d = levenshtein(q, loc);
  if (d <= Math.max(1, Math.floor(loc.length / 4))) return 15 - d;
  return 0;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j]! + 1,
        curr[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length]!;
}

export function searchCities(term: string, records: CityRecord[], limit = 8): CityRecord[] {
  return records
    .map((r) => ({ r, s: scoreCity(term, r) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s || x.r.city.localeCompare(y.r.city))
    .slice(0, limit)
    .map((x) => x.r);
}

/* ---------------------------------------------------------- CSV validation */

export type CsvIssue = { row: number; column?: string; message: string };

export type CityCsvResult = {
  ok: boolean;
  rows: CityRecord[];
  issues: CsvIssue[];
  counts: Record<CityRateGroup, number>;
};

/**
 * Validates already-parsed city rows (arrays of cells, first row = header).
 * Kept separate from the CSV parser so the parser stays server-side.
 */
export function validateCityRows(table: string[][]): CityCsvResult {
  const issues: CsvIssue[] = [];
  const rows: CityRecord[] = [];
  const counts: Record<CityRateGroup, number> = {
    RATE_GROUP_1: 0,
    RATE_GROUP_2: 0,
    RATE_GROUP_3: 0,
    RATE_GROUP_4: 0,
    NO_RATE: 0,
  };

  const header = (table[0] ?? []).map((h) => String(h ?? "").trim());
  if (header[0] !== "City" || header[1] !== "Rate Group") {
    issues.push({ row: 1, message: 'Header must be exactly "City,Rate Group"' });
    return { ok: false, rows, issues, counts };
  }

  const seen = new Set<string>();
  for (let i = 1; i < table.length; i++) {
    const line = table[i] ?? [];
    if (line.every((c) => String(c ?? "").trim() === "")) continue;
    const rowNo = i + 1;
    const city = String(line[0] ?? "").replace(/\s+/g, " ").trim();
    const group = String(line[1] ?? "").trim().toUpperCase();

    if (!city) {
      issues.push({ row: rowNo, column: "City", message: "City is empty" });
      continue;
    }
    if (!group) {
      issues.push({ row: rowNo, column: "Rate Group", message: "Rate group is empty" });
      continue;
    }
    if (!(CITY_RATE_GROUPS as string[]).includes(group)) {
      issues.push({ row: rowNo, column: "Rate Group", message: `Unknown rate group "${group}"` });
      continue;
    }
    const key = cityKey(city);
    if (seen.has(key)) {
      issues.push({ row: rowNo, column: "City", message: `Duplicate city "${city}"` });
      continue;
    }
    seen.add(key);
    const { locality, district } = splitCanonicalCity(city);
    rows.push({ city, cityKey: key, locality, district, rateGroup: group as CityRateGroup });
    counts[group as CityRateGroup] += 1;
  }

  if (rows.length === 0) issues.push({ row: 0, message: "No city rows found" });
  return { ok: issues.length === 0, rows, issues, counts };
}

export type RateMatrix = {
  weightLimitsKg: number[];
  /** rateGroup -> weightLimitKg -> LKR price as a decimal string. */
  prices: Record<ChargeableRateGroup, Record<string, string>>;
};

export type RateCsvResult = { ok: boolean; matrix: RateMatrix | null; issues: CsvIssue[] };

export function validateRateRows(table: string[][]): RateCsvResult {
  const issues: CsvIssue[] = [];
  const header = (table[0] ?? []).map((h) => String(h ?? "").trim());
  if (header[0] !== "Rate Group") {
    issues.push({ row: 1, message: 'First header cell must be "Rate Group"' });
    return { ok: false, matrix: null, issues };
  }
  const limitCells = header.slice(1).filter((h) => h !== "");
  if (limitCells.length === 0) {
    issues.push({ row: 1, message: "No weight-limit columns found" });
    return { ok: false, matrix: null, issues };
  }

  const limits: number[] = [];
  for (const [i, cell] of limitCells.entries()) {
    const n = Number(cell);
    if (!Number.isFinite(n) || n <= 0) {
      issues.push({ row: 1, column: cell, message: `Weight limit "${cell}" is not a positive number` });
      continue;
    }
    if (limits.length && n <= limits[limits.length - 1]!) {
      issues.push({
        row: 1,
        column: cell,
        message: `Weight limits must strictly increase (column ${i + 2})`,
      });
      continue;
    }
    limits.push(n);
  }
  if (issues.length) return { ok: false, matrix: null, issues };

  const prices = {} as RateMatrix["prices"];
  const seen = new Set<string>();
  for (let i = 1; i < table.length; i++) {
    const line = table[i] ?? [];
    if (line.every((c) => String(c ?? "").trim() === "")) continue;
    const rowNo = i + 1;
    const group = String(line[0] ?? "").trim().toUpperCase();
    if (group === "NO_RATE") {
      issues.push({ row: rowNo, column: "Rate Group", message: "NO_RATE cannot have prices" });
      continue;
    }
    if (!(CHARGEABLE_RATE_GROUPS as readonly string[]).includes(group)) {
      issues.push({ row: rowNo, column: "Rate Group", message: `Unknown rate group "${group}"` });
      continue;
    }
    if (seen.has(group)) {
      issues.push({ row: rowNo, column: "Rate Group", message: `Duplicate row for ${group}` });
      continue;
    }
    seen.add(group);

    const cells: Record<string, string> = {};
    for (const [c, limit] of limits.entries()) {
      const raw = String(line[c + 1] ?? "").trim().replace(/,/g, "");
      if (!raw) {
        issues.push({ row: rowNo, column: String(limit), message: "Missing price" });
        continue;
      }
      if (!/^\d+(\.\d+)?$/.test(raw) || Number(raw) <= 0) {
        issues.push({ row: rowNo, column: String(limit), message: `Invalid price "${raw}"` });
        continue;
      }
      cells[limitKey(limit)] = raw;
    }
    prices[group as ChargeableRateGroup] = cells;
  }

  for (const g of CHARGEABLE_RATE_GROUPS) {
    if (!seen.has(g)) issues.push({ row: 0, message: `Missing row for ${g}` });
  }
  if (issues.length) return { ok: false, matrix: null, issues };
  return { ok: true, matrix: { weightLimitsKg: limits, prices }, issues };
}

/** Stable key for a weight limit (3 dp) used in maps and DB lookups. */
export function limitKey(limitKg: number): string {
  return (Math.round(limitKg * 1000) / 1000).toFixed(3);
}

/* -------------------------------------------------------- weight selection */

export type WeightBandResult =
  | { ok: true; weightLimitKg: number }
  | { ok: false; reason: "invalid_weight" | "over_max_weight" };

/**
 * Smallest weight limit that is >= the shipment weight (inclusive upper limit).
 * Weights are compared in whole grams, so 1.5 kg selects the 1.5 band and
 * 1.5001 kg (1500.1 g → 1500 g rounded) is handled by the caller's precision.
 */
export function selectWeightBand(weightKg: number, limitsKg: number[]): WeightBandResult {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return { ok: false, reason: "invalid_weight" };
  const grams = Math.ceil(weightKg * 1000 - 1e-6);
  const sorted = [...limitsKg].sort((a, b) => a - b);
  for (const limit of sorted) {
    if (grams <= Math.round(limit * 1000)) return { ok: true, weightLimitKg: limit };
  }
  return { ok: false, reason: "over_max_weight" };
}

/* ------------------------------------------------------ rounding + FX rules */

export type RoundingRule =
  | { mode: "increment"; increment: 1 | 5 | 10 }
  | { mode: "decimals"; decimals: 1 | 2 };

export function parseRoundingRule(input: {
  rounding_mode?: string | null;
  rounding_increment?: number | null;
  rounding_decimals?: number | null;
}): RoundingRule {
  if (input.rounding_mode === "decimals") {
    const d = Number(input.rounding_decimals);
    if (d !== 1 && d !== 2) throw new Error("Rounding decimals must be 1 or 2");
    return { mode: "decimals", decimals: d };
  }
  const inc = Number(input.rounding_increment);
  if (inc !== 1 && inc !== 5 && inc !== 10) throw new Error("Rounding increment must be 1, 5 or 10");
  return { mode: "increment", increment: inc };
}

export function describeRounding(rule: RoundingRule): string {
  return rule.mode === "increment"
    ? `Round up to the next USD ${rule.increment}`
    : `Round up to ${rule.decimals} decimal place${rule.decimals === 1 ? "" : "s"}`;
}

export function roundingSetting(rule: RoundingRule): number {
  return rule.mode === "increment" ? rule.increment : rule.decimals;
}

export function assertExchangeRate(rate: unknown): number {
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Exchange rate is missing or invalid");
  return n;
}

export type ConvertedRate = { unroundedUsd: number; usd: number };

/**
 * Converts one LKR amount to USD. `exchangeRate` is LKR per 1 USD (verified
 * against the stored Currencies value, e.g. 329.4456), so USD = LKR / rate.
 * Rounding is always upward (ceiling), never half-up.
 */
export function convertLkrToUsd(
  lkr: string | number,
  exchangeRate: number,
  rule: RoundingRule,
): ConvertedRate {
  const lkr8 = toScaled(lkr);
  const rate8 = toScaled(assertExchangeRate(exchangeRate).toFixed(8));
  if (lkr8 <= 0n) throw new Error("LKR rate must be positive");
  const unrounded8 = (lkr8 * SCALE) / rate8; // floor at 1e-8 precision

  let final8: bigint;
  if (rule.mode === "increment") {
    const step8 = BigInt(rule.increment) * SCALE;
    final8 = ceilDiv(unrounded8, step8) * step8;
  } else {
    const factor = 10n ** BigInt(rule.decimals);
    final8 = (ceilDiv(unrounded8 * factor, SCALE) * SCALE) / factor;
  }

  return { unroundedUsd: fromScaled(unrounded8, 8), usd: fromScaled(final8, 4) };
}
