import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CountryZone = { country: string; zone: number };
export type ShippingRate = { zone: number; max_weight_kg: number; price_usd: number };

const countryZonesQuery = queryOptions({
  queryKey: ["country_zones"],
  queryFn: async (): Promise<CountryZone[]> => {
    const { data, error } = await supabase
      .from("country_zones" as never)
      .select("country,zone")
      .order("country");
    // Table is being rebuilt — treat as "no zones configured" instead of failing.
    if (error) return [];
    return (data ?? []) as CountryZone[];
  },
  staleTime: 5 * 60_000,
});

const shippingRatesQuery = queryOptions({
  queryKey: ["shipping_rates"],
  queryFn: async (): Promise<ShippingRate[]> => {
    const { data, error } = await supabase
      .from("shipping_rates" as never)
      .select("zone,max_weight_kg,price_usd")
      .order("zone")
      .order("max_weight_kg");
    if (error) throw new Error(error.message);
    return ((data ?? []) as ShippingRate[]).map((r) => ({
      zone: r.zone,
      max_weight_kg: Number(r.max_weight_kg),
      price_usd: Number(r.price_usd),
    }));
  },
  staleTime: 5 * 60_000,
});

export function useCountryZones() {
  return useQuery(countryZonesQuery);
}

export function useShippingRates() {
  return useQuery(shippingRatesQuery);
}

/**
 * Given the total order weight and the destination zone, find the cheapest
 * matching row (first row whose max_weight_kg is >= total weight). Returns
 * null when the weight exceeds the top of the table.
 */
export function calcShippingUSD(
  totalWeightKg: number,
  zone: number,
  rates: ShippingRate[],
): number | null {
  if (totalWeightKg <= 0) return 0;
  const zoneRates = rates
    .filter((r) => r.zone === zone)
    .sort((a, b) => a.max_weight_kg - b.max_weight_kg);
  for (const r of zoneRates) {
    if (totalWeightKg <= r.max_weight_kg + 1e-9) return r.price_usd;
  }
  return null;
}
