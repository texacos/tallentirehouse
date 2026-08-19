import { queryOptions, useQuery } from "@tanstack/react-query";
import {
  listShippingDestinations,
  listShippingOptions,
  quoteShipping,
  type ShippingDestination,
  type ShippingOption,
  type ShippingQuoteResult,
} from "./shipping.functions";

export type { ShippingDestination, ShippingQuoteResult, ShippingOption };
export type { Quote } from "./shipping-engine";

export const shippingDestinationsQuery = queryOptions({
  queryKey: ["shipping_destinations"],
  queryFn: async (): Promise<ShippingDestination[]> => {
    try {
      return await listShippingDestinations();
    } catch {
      return [];
    }
  },
  staleTime: 5 * 60_000,
});

export function useShippingDestinations() {
  return useQuery(shippingDestinationsQuery);
}

/** Live shipping quote for the current destination + basket weight. */
export function useShippingQuote(params: {
  country: string;
  weightKg: number;
  subtotal: number;
  enabled?: boolean;
}) {
  const { country, weightKg, subtotal, enabled = true } = params;
  return useQuery({
    queryKey: ["shipping_quote", country, weightKg, subtotal],
    enabled: enabled && !!country.trim() && weightKg >= 0,
    staleTime: 60_000,
    queryFn: (): Promise<ShippingQuoteResult> =>
      quoteShipping({ data: { country: country.trim(), weightKg, subtotal } }),
  });
}

/** All active carriers quoted for the current destination + basket. */
export function useShippingOptions(params: {
  country: string;
  weightKg: number;
  subtotal: number;
  enabled?: boolean;
}) {
  const { country, weightKg, subtotal, enabled = true } = params;
  return useQuery({
    queryKey: ["shipping_options", country, weightKg, subtotal],
    enabled: enabled && !!country.trim() && weightKg >= 0,
    staleTime: 60_000,
    queryFn: (): Promise<ShippingOption[]> =>
      listShippingOptions({ data: { country: country.trim(), weightKg, subtotal } }),
  });
}
