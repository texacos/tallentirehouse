import { queryOptions, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SiteSettings = {
  hideOutOfStock: boolean;
  productShippingNote: string;
};

export const DEFAULT_SHIPPING_NOTE =
  "Made to order. Ships within 2–3 weeks. Worldwide shipping calculated at checkout.";

const DEFAULTS: SiteSettings = {
  hideOutOfStock: false,
  productShippingNote: DEFAULT_SHIPPING_NOTE,
};

async function fetchSiteSettings(): Promise<SiteSettings> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("key,value");
  if (error) throw new Error(error.message);
  const map = new Map<string, unknown>();
  for (const row of data ?? []) map.set(row.key as string, row.value);
  return {
    hideOutOfStock: Boolean(map.get("hide_out_of_stock") ?? false),
  };
}

export const siteSettingsQueryOptions = queryOptions({
  queryKey: ["site_settings"],
  queryFn: fetchSiteSettings,
  staleTime: 30_000,
});

export function useSiteSettings(): SiteSettings {
  return useQuery(siteSettingsQueryOptions).data ?? DEFAULTS;
}

export function useUpdateSiteSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key, value: value as never }, { onConflict: "key" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site_settings"] }),
  });
}
