import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminHeroCreate,
  adminHeroDelete,
  adminHeroList,
  adminHeroReorder,
  adminHeroSaveSettings,
  adminHeroUpdate,
  getHeroConfig,
} from "./hero.functions";
import type { HeroConfig } from "./hero";

export const heroConfigQueryOptions = queryOptions({
  queryKey: ["hero", "public"],
  queryFn: () => getHeroConfig(),
  staleTime: 60_000,
});

export function useHeroConfig(): HeroConfig | undefined {
  return useQuery(heroConfigQueryOptions).data;
}

const ADMIN_KEY = ["hero", "admin"] as const;

export function useAdminHero(enabled: boolean) {
  const fn = useServerFn(adminHeroList);
  return useQuery({
    queryKey: ADMIN_KEY,
    queryFn: () => fn(),
    enabled,
  });
}

function useHeroMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ADMIN_KEY });
      void qc.invalidateQueries({ queryKey: ["hero", "public"] });
    },
  });
}

export function useHeroCreate() {
  const fn = useServerFn(adminHeroCreate);
  return useHeroMutation((data: Parameters<typeof adminHeroCreate>[0]["data"]) =>
    fn({ data }),
  );
}

export function useHeroUpdate() {
  const fn = useServerFn(adminHeroUpdate);
  return useHeroMutation((data: Parameters<typeof adminHeroUpdate>[0]["data"]) =>
    fn({ data }),
  );
}

export function useHeroReorder() {
  const fn = useServerFn(adminHeroReorder);
  return useHeroMutation((ids: string[]) => fn({ data: { ids } }));
}

export function useHeroDelete() {
  const fn = useServerFn(adminHeroDelete);
  return useHeroMutation((id: string) => fn({ data: { id } }));
}

export function useHeroSettingsSave() {
  const fn = useServerFn(adminHeroSaveSettings);
  return useHeroMutation((data: Parameters<typeof adminHeroSaveSettings>[0]["data"]) =>
    fn({ data }),
  );
}

/** Turns a thrown server error into an admin-friendly sentence. */
export function heroErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (!raw || /supabase|storage|postgres|policy|jwt|bucket/i.test(raw)) {
    return "Something went wrong. Please try again.";
  }
  return raw;
}
