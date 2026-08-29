import { describe, expect, it } from "vitest";
import {
  cityKey,
  convertLkrToUsd,
  describeRounding,
  limitKey,
  parseRoundingRule,
  scoreCity,
  searchCities,
  selectWeightBand,
  splitCanonicalCity,
  validateCityRows,
  validateRateRows,
  type CityRecord,
  type RoundingRule,
} from "./aramex-domestic";
import { billableWeight, quote } from "./shipping-engine";

const LIMITS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0];

const city = (c: string, g: CityRecord["rateGroup"]): CityRecord => ({
  city: c,
  cityKey: cityKey(c),
  ...splitCanonicalCity(c),
  rateGroup: g,
});

describe("city parsing and matching", () => {
  it("splits a canonical city into locality and district", () => {
    expect(splitCanonicalCity("Ambagamuwa Udabulathgama, Nuwara Eliya")).toEqual({
      locality: "Ambagamuwa Udabulathgama",
      district: "Nuwara Eliya",
    });
  });

  it("matches case-insensitively and ignores extra whitespace", () => {
    const r = city("Galle, Galle", "RATE_GROUP_2");
    expect(cityKey("  GALLE,   Galle ")).toBe("galle, galle");
    expect(scoreCity("galle", r)).toBeGreaterThan(0);
  });

  it("ranks an exact locality above a partial one", () => {
    const records = [city("Galle, Galle", "RATE_GROUP_2"), city("Galle Fort, Galle", "RATE_GROUP_2")];
    expect(searchCities("Galle", records)[0]!.city).toBe("Galle, Galle");
  });

  it("still suggests on a small misspelling", () => {
    const records = [city("Negombo, Gampaha", "RATE_GROUP_1")];
    expect(searchCities("Negomboo", records).length).toBe(1);
  });

  it("returns nothing for an unrelated term", () => {
    expect(searchCities("Zurich", [city("Galle, Galle", "RATE_GROUP_2")])).toEqual([]);
  });
});

describe("city CSV validation", () => {
  it("accepts a well-formed file", () => {
    const res = validateCityRows([
      ["City", "Rate Group"],
      ["Adampan, Mannar", "RATE_GROUP_4"],
      ["Ampara, Amparai", "NO_RATE"],
    ]);
    expect(res.ok).toBe(true);
    expect(res.rows).toHaveLength(2);
    expect(res.counts.NO_RATE).toBe(1);
  });

  it("rejects an unknown rate group, a duplicate and a bad header", () => {
    expect(validateCityRows([["Town", "Group"]]).ok).toBe(false);
    const dup = validateCityRows([
      ["City", "Rate Group"],
      ["Galle, Galle", "RATE_GROUP_1"],
      ["galle, galle", "RATE_GROUP_1"],
    ]);
    expect(dup.ok).toBe(false);
    const bad = validateCityRows([
      ["City", "Rate Group"],
      ["Galle, Galle", "RATE_GROUP_9"],
    ]);
    expect(bad.ok).toBe(false);
  });
});

describe("rate CSV validation", () => {
  const header = ["Rate Group", ...LIMITS.map(String)];
  const row = (g: string, start: number) => [g, ...LIMITS.map((_, i) => String(start + i * 100))];

  it("accepts the supplied Aramex layout", () => {
    const res = validateRateRows([
      header,
      row("RATE_GROUP_1", 689.96),
      row("RATE_GROUP_2", 1139.81),
      row("RATE_GROUP_3", 1319.75),
      row("RATE_GROUP_4", 1409.72),
    ]);
    expect(res.ok).toBe(true);
    expect(res.matrix!.weightLimitsKg).toEqual(LIMITS);
    expect(res.matrix!.prices.RATE_GROUP_1[limitKey(0.5)]).toBe("689.96");
  });

  it("rejects a missing group, a non-numeric price and non-increasing limits", () => {
    expect(validateRateRows([header, row("RATE_GROUP_1", 1)]).ok).toBe(false);
    const bad = validateRateRows([
      header,
      ["RATE_GROUP_1", ...LIMITS.map((_, i) => (i === 3 ? "abc" : "100"))],
      row("RATE_GROUP_2", 1),
      row("RATE_GROUP_3", 1),
      row("RATE_GROUP_4", 1),
    ]);
    expect(bad.ok).toBe(false);
    expect(validateRateRows([["Rate Group", "1.0", "0.5"]]).ok).toBe(false);
  });
});

describe("weight bands", () => {
  it("selects the smallest band that covers the weight, inclusive of the limit", () => {
    expect(selectWeightBand(0.2, LIMITS)).toEqual({ ok: true, weightLimitKg: 0.5 });
    expect(selectWeightBand(0.5, LIMITS)).toEqual({ ok: true, weightLimitKg: 0.5 });
    expect(selectWeightBand(0.51, LIMITS)).toEqual({ ok: true, weightLimitKg: 1.0 });
    expect(selectWeightBand(1.5, LIMITS)).toEqual({ ok: true, weightLimitKg: 1.5 });
    expect(selectWeightBand(6, LIMITS)).toEqual({ ok: true, weightLimitKg: 6 });
  });

  it("refuses weights above the table and non-positive weights", () => {
    expect(selectWeightBand(6.01, LIMITS)).toEqual({ ok: false, reason: "over_max_weight" });
    expect(selectWeightBand(0, LIMITS)).toEqual({ ok: false, reason: "invalid_weight" });
    expect(selectWeightBand(Number.NaN, LIMITS)).toEqual({ ok: false, reason: "invalid_weight" });
  });

  it("agrees with the shared shipping engine used at checkout", () => {
    const carrier = {
      id: "c",
      code: "aramex-domestic",
      name: "Aramex Domestic",
      currency: "USD",
      originCountry: "Sri Lanka",
      maxWeightKg: 6,
      weightIntervalKg: 0.5,
      roundWeight: true,
      freeShippingThreshold: null,
    };
    const tiers = LIMITS.map((l, i) => ({ maxWeightKg: l, price: 10 + i }));
    for (const w of [0.1, 0.5, 0.75, 1, 1.5, 2.4, 3.0, 5.9, 6]) {
      const engine = quote({
        carrier,
        status: "rated",
        tiers,
        surcharges: [],
        country: "Sri Lanka",
        weightKg: w,
        subtotal: 100,
      });
      const pure = selectWeightBand(w, LIMITS);
      expect(pure.ok).toBe(true);
      expect(engine.status).toBe("rated");
      if (engine.status === "rated" && pure.ok) {
        expect(engine.tierMaxWeightKg).toBe(pure.weightLimitKg);
      }
    }
    expect(billableWeight(0.6, carrier)).toBe(1);
  });
});

describe("LKR to USD conversion", () => {
  const rate = 329.4456; // LKR per 1 USD, as stored by the Currencies dashboard

  it("divides by the rate rather than multiplying", () => {
    const { unroundedUsd } = convertLkrToUsd("689.96", rate, { mode: "decimals", decimals: 2 });
    expect(unroundedUsd).toBeCloseTo(689.96 / rate, 6);
    expect(unroundedUsd).toBeLessThan(10);
  });

  it("always rounds upward to the next whole dollar", () => {
    const rule: RoundingRule = { mode: "increment", increment: 1 };
    expect(convertLkrToUsd("689.96", rate, rule).usd).toBe(3); // 2.094… → 3
    expect(convertLkrToUsd("4051.01", rate, rule).usd).toBe(13); // 12.29… → 13
  });

  it("leaves an exact multiple untouched", () => {
    // Exactly USD 2.00 worth of rupees must stay at 2, not jump to 3.
    const exact = (2 * rate).toFixed(4);
    expect(convertLkrToUsd(exact, rate, { mode: "increment", increment: 1 }).usd).toBe(2);
    expect(convertLkrToUsd(exact, rate, { mode: "decimals", decimals: 2 }).usd).toBe(2);
  });

  it("supports 5 and 10 dollar increments", () => {
    expect(convertLkrToUsd("4051.01", rate, { mode: "increment", increment: 5 }).usd).toBe(15);
    expect(convertLkrToUsd("4051.01", rate, { mode: "increment", increment: 10 }).usd).toBe(20);
  });

  it("supports decimal rounding", () => {
    expect(convertLkrToUsd("689.96", rate, { mode: "decimals", decimals: 2 }).usd).toBe(2.1);
    expect(convertLkrToUsd("689.96", rate, { mode: "decimals", decimals: 1 }).usd).toBe(2.1);
    expect(convertLkrToUsd("750.14", rate, { mode: "decimals", decimals: 2 }).usd).toBe(2.28);
  });

  it("never produces a zero or negative price", () => {
    expect(convertLkrToUsd("0.01", rate, { mode: "decimals", decimals: 2 }).usd).toBeGreaterThan(0);
    expect(() => convertLkrToUsd("0", rate, { mode: "decimals", decimals: 2 })).toThrow();
    expect(() => convertLkrToUsd("100", 0, { mode: "decimals", decimals: 2 })).toThrow();
    expect(() => convertLkrToUsd("abc", rate, { mode: "decimals", decimals: 2 })).toThrow();
  });

  it("is stable across the whole supplied table", () => {
    const prices = ["689.96", "1139.81", "1319.75", "1409.72", "7469.85"];
    for (const p of prices) {
      const r = convertLkrToUsd(p, rate, { mode: "increment", increment: 1 });
      expect(r.usd).toBeGreaterThanOrEqual(r.unroundedUsd);
      expect(r.usd - r.unroundedUsd).toBeLessThan(1);
    }
  });
});

describe("rounding rules", () => {
  it("parses and describes stored settings", () => {
    expect(parseRoundingRule({ rounding_mode: "increment", rounding_increment: 5 })).toEqual({
      mode: "increment",
      increment: 5,
    });
    expect(parseRoundingRule({ rounding_mode: "decimals", rounding_decimals: 1 })).toEqual({
      mode: "decimals",
      decimals: 1,
    });
    expect(() => parseRoundingRule({ rounding_mode: "increment", rounding_increment: 3 })).toThrow();
    expect(describeRounding({ mode: "increment", increment: 10 })).toMatch(/USD 10/);
  });
});
