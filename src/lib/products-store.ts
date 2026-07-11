import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { fetchAllProducts } from "./products.functions";
import type { Product } from "./products";

export const productsQueryOptions = queryOptions({
  queryKey: ["products"],
  queryFn: () => fetchAllProducts(),
  staleTime: 30_000,
});

/** Suspense-friendly — use inside route components that prefetch in the loader. */
export function useProducts(): Product[] {
  return useSuspenseQuery(productsQueryOptions).data;
}

/** Non-suspending version — for providers that mount above the router (e.g. cart). */
export function useProductsOptional(): Product[] {
  return useQuery(productsQueryOptions).data ?? [];
}

export function useProduct(slug: string): Product | undefined {
  return useProducts().find((p) => p.slug === slug);
}
