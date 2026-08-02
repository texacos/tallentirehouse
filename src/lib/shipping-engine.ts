/**
 * Pure, carrier-agnostic shipping rate engine.
 *
 * No I/O, no Supabase, no React — it takes a fully-resolved snapshot of the
 * carrier configuration and returns a quote. This keeps the pricing rules
 * unit-testable and identical on server and client.
 */

export type ShippingStatus = "rated" | "no_rate" | "no_service";

export type SurchargeCalc = "percent" | "fixed";
export type SurchargeKind = "fuel" | "remote_area" | "peak_season" | "custom";

export type CarrierConfig = {
  id: string;
  code: string;
  name: string;
  currency: string;
  originCountry: string;
  maxWeightKg: number;
  weightIntervalKg: number;
  roundWeight: boolean;
  freeShippingThreshold: number | null;
};

export type RateTier = { maxWeightKg: number; price: number };

export type Surcharge = {
  id: string;
  kind: SurchargeKind;
  label: string;
  calc: SurchargeCalc;
  amount: number;
  country: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

/** Everything the engine needs for one destination, resolved by the caller. */
export type QuoteInput = {
  carrier: CarrierConfig;
  status: ShippingStatus;
  /** Ordered ascending by maxWeightKg. Empty for no_rate / no_service. */
  tiers: RateTier[];
  surcharges: Surcharge[];
  country: string;
  weightKg: number;
  /** Order subtotal in the carrier currency, for free-shipping thresholds. */
  subtotal: number;
  now?: Date;
};

export type AppliedSurcharge = {
  label: string;
  kind: SurchargeKind;
  amount: number;
};

export type Quote =
  | {
      status: "rated";
      carrierCode: string;
      carrierName: string;
      currency: string;
      country: string;
      billableWeightKg: number;
      baseAmount: number;
      surcharges: AppliedSurcharge[];
      total: number;
      free: boolean;
      tierMaxWeightKg: number;
    }
  | {
      status: "no_rate" | "no_service";
      carrierCode: string;
      carrierName: string;
      currency: string;
      country: string;
      billableWeightKg: number;
      /** Why the quote failed: unsupported country, or weight above the table. */
      reason: "unsupported" | "over_max_weight" | "no_tier";
    };

const money = (n: number) => Math.round(n * 100) / 100;

/** Round the actual weight up to the carrier's billing interval. */
export function billableWeight(weightKg: number, carrier: CarrierConfig): number {
  const w = Math.max(0, weightKg);
  if (!carrier.roundWeight || carrier.weightIntervalKg <= 0) return money(w);
  const steps = Math.ceil(w / carrier.weightIntervalKg - 1e-9);
  return money(Math.max(steps, 1) * carrier.weightIntervalKg);
}

function surchargeActive(s: Surcharge, country: string, now: Date): boolean {
  if (!s.isActive) return false;
  if (s.country && s.country.toLowerCase() !== country.toLowerCase()) return false;
  if (s.startsAt && new Date(s.startsAt) > now) return false;
  if (s.endsAt && new Date(s.endsAt) < now) return false;
  return true;
}

export function quote(input: QuoteInput): Quote {
  const { carrier, status, tiers, surcharges, country, weightKg, subtotal } = input;
  const now = input.now ?? new Date();
  const billable = billableWeight(weightKg, carrier);

  const base = {
    carrierCode: carrier.code,
    carrierName: carrier.name,
    currency: carrier.currency,
    country,
    billableWeightKg: billable,
  };

  if (status !== "rated") {
    return { ...base, status, reason: "unsupported" };
  }
  if (billable > carrier.maxWeightKg + 1e-9) {
    return { ...base, status: "no_rate", reason: "over_max_weight" };
  }

  const sorted = [...tiers].sort((a, b) => a.maxWeightKg - b.maxWeightKg);
  const tier = sorted.find((t) => billable <= t.maxWeightKg + 1e-9);
  if (!tier) return { ...base, status: "no_rate", reason: "no_tier" };

  const freeThreshold = carrier.freeShippingThreshold;
  const free = freeThreshold != null && subtotal >= freeThreshold;

  const baseAmount = free ? 0 : money(tier.price);
  const applied: AppliedSurcharge[] = free
    ? []
    : surcharges
        .filter((s) => surchargeActive(s, country, now))
        .map((s) => ({
          label: s.label,
          kind: s.kind,
          amount: money(s.calc === "percent" ? (baseAmount * s.amount) / 100 : s.amount),
        }))
        .filter((s) => s.amount !== 0);

  const total = money(applied.reduce((sum, s) => sum + s.amount, baseAmount));

  return {
    ...base,
    status: "rated",
    baseAmount,
    surcharges: applied,
    total,
    free,
    tierMaxWeightKg: Number(tier.maxWeightKg),
  };
}
