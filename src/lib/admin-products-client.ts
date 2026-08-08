// Client-side hooks for the admin products dashboard.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminApplyPatches,
  adminAuditLog,
  adminBulkAction,
  adminExportProducts,
  adminGetPrefs,
  adminImportProducts,
  adminListProducts,
  adminProductMeta,
  adminProductRevisions,
  adminRestoreProducts,
  adminSavePrefs,
  type AdminPrefs,
} from "./admin-products.functions";
import type {
  AdminProduct,
  AdminProductValues,
  BulkAction,
  ListFilters,
} from "./admin-products.types";
import { adminSaveProduct } from "./admin-products.functions";

export const ADMIN_KEYS = {
  list: (f: ListFilters) => ["admin-products", "list", f] as const,
  meta: ["admin-products", "meta"] as const,
  prefs: ["admin-products", "prefs"] as const,
  audit: ["admin-products", "audit"] as const,
  revisions: (id: string) => ["admin-products", "revisions", id] as const,
};

export function useAdminList(filters: ListFilters, enabled = true) {
  const fn = useServerFn(adminListProducts);
  return useQuery({
    queryKey: ADMIN_KEYS.list(filters),
    queryFn: () => fn({ data: filters }),
    enabled,
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function useAdminMeta(enabled = true) {
  const fn = useServerFn(adminProductMeta);
  return useQuery({
    queryKey: ADMIN_KEYS.meta,
    queryFn: () => fn({ data: undefined }),
    enabled,
    staleTime: 60_000,
  });
}

export function useAdminPrefs(enabled = true) {
  const fn = useServerFn(adminGetPrefs);
  return useQuery({
    queryKey: ADMIN_KEYS.prefs,
    queryFn: () => fn({ data: undefined }),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useSavePrefs() {
  const fn = useServerFn(adminSavePrefs);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AdminPrefs>) => fn({ data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.prefs }),
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["admin-products"] });
  qc.invalidateQueries({ queryKey: ["products"] });
}

export function useSaveProduct() {
  const fn = useServerFn(adminSaveProduct);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: AdminProductValues) =>
      fn({ data: values as unknown as never }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useBulkAction() {
  const fn = useServerFn(adminBulkAction);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids: string[]; action: BulkAction }) =>
      fn({ data: input as unknown as never }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useApplyPatches() {
  const fn = useServerFn(adminApplyPatches);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { patches: Array<{ id: string; patchJson: string }>; reason?: string }) =>
      fn({ data: input as unknown as never }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useRestoreProducts() {
  const fn = useServerFn(adminRestoreProducts);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (products: AdminProduct[]) =>
      fn({ data: { products } as unknown as never }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useImportProducts() {
  const fn = useServerFn(adminImportProducts);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (products: AdminProductValues[]) =>
      fn({ data: { products } as unknown as never }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useExportProducts() {
  const fn = useServerFn(adminExportProducts);
  return useMutation({
    mutationFn: (filters: ListFilters) => fn({ data: filters }),
  });
}

export function useRevisions(productId: string | null) {
  const fn = useServerFn(adminProductRevisions);
  return useQuery({
    queryKey: ADMIN_KEYS.revisions(productId ?? "none"),
    queryFn: () => fn({ data: { productId: productId as string } }),
    enabled: !!productId,
  });
}

export function useAuditLog(enabled = true) {
  const fn = useServerFn(adminAuditLog);
  return useQuery({
    queryKey: ADMIN_KEYS.audit,
    queryFn: () => fn({ data: { limit: 50 } }),
    enabled,
    staleTime: 30_000,
  });
}
