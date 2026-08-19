/**
 * Admin data layer for the shipping system.
 *
 * All reads/writes go through the browser Supabase client; RLS restricts
 * writes to admins ("Admins manage …" policies) while reads stay public.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";

export type Carrier = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  is_default: boolean;
  origin_country: string;
  currency: string;
  max_weight_kg: number;
  weight_interval_kg: number;
  round_weight: boolean;
  free_shipping_threshold: number | null;
  sort_order: number;
};

export type RateGroup = {
  id: string;
  carrier_id: string;
  code: string;
  label: string | null;
  notes: string | null;
};

export type RateTier = {
  id?: string;
  rate_group_id?: string;
  max_weight_kg: number;
  price: number;
};

export type ServiceStatus = "rated" | "no_rate" | "no_service";

export type CountryRule = {
  id: string;
  carrier_id: string;
  country: string;
  country_code: string | null;
  status: ServiceStatus;
  rate_group_id: string | null;
};

export type Surcharge = {
  id: string;
  carrier_id: string;
  kind: "fuel" | "remote_area" | "peak_season" | "custom";
  label: string;
  calc: "percent" | "fixed";
  amount: number;
  country: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

export type ShippingMessage = {
  id: string;
  carrier_id: string | null;
  status: ServiceStatus;
  locale: string;
  body_html: string;
};

export type ImportBatch = {
  id: string;
  carrier_id: string | null;
  kind: string;
  file_name: string | null;
  user_label: string | null;
  rows_total: number;
  rows_created: number;
  rows_updated: number;
  rows_skipped: number;
  warnings: string[];
  snapshot: unknown;
  rolled_back_at: string | null;
  created_at: string;
};

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

/* ------------------------------------------------------------------ reads */

export function useCarriers() {
  return useQuery({
    queryKey: ["admin", "carriers"],
    queryFn: async (): Promise<Carrier[]> => {
      const rows = must(
        await supabase
          .from("shipping_carriers")
          .select("*")
          .order("sort_order")
          .order("name"),
      );
      return (rows as Carrier[]).map((c) => ({
        ...c,
        max_weight_kg: num(c.max_weight_kg),
        weight_interval_kg: num(c.weight_interval_kg, 0.5),
        free_shipping_threshold:
          c.free_shipping_threshold == null ? null : num(c.free_shipping_threshold),
      }));
    },
  });
}

export function useRateGroups(carrierId: string | undefined) {
  return useQuery({
    enabled: !!carrierId,
    queryKey: ["admin", "rate_groups", carrierId],
    queryFn: async (): Promise<(RateGroup & { tiers: RateTier[] })[]> => {
      const groups = must(
        await supabase
          .from("shipping_rate_groups")
          .select("id,carrier_id,code,label,notes")
          .eq("carrier_id", carrierId!)
          .order("code"),
      ) as RateGroup[];
      const tiers = must(
        await supabase
          .from("shipping_rate_tiers")
          .select("id,rate_group_id,max_weight_kg,price")
          .in("rate_group_id", groups.map((g) => g.id))
          .order("max_weight_kg"),
      ) as Required<RateTier>[];
      const byGroup = new Map<string, RateTier[]>();
      for (const t of tiers) {
        const list = byGroup.get(t.rate_group_id) ?? [];
        list.push({
          id: t.id,
          rate_group_id: t.rate_group_id,
          max_weight_kg: num(t.max_weight_kg),
          price: num(t.price),
        });
        byGroup.set(t.rate_group_id, list);
      }
      return groups.map((g) => ({ ...g, tiers: byGroup.get(g.id) ?? [] }));
    },
  });
}

export function useCountryRules(carrierId: string | undefined) {
  return useQuery({
    enabled: !!carrierId,
    queryKey: ["admin", "country_rules", carrierId],
    queryFn: async (): Promise<CountryRule[]> =>
      must(
        await supabase
          .from("shipping_country_rules")
          .select("id,carrier_id,country,country_code,status,rate_group_id")
          .eq("carrier_id", carrierId!)
          .order("country"),
      ) as CountryRule[],
  });
}

export function useSurcharges(carrierId: string | undefined) {
  return useQuery({
    enabled: !!carrierId,
    queryKey: ["admin", "surcharges", carrierId],
    queryFn: async (): Promise<Surcharge[]> => {
      const rows = must(
        await supabase
          .from("shipping_surcharges")
          .select("*")
          .eq("carrier_id", carrierId!)
          .order("created_at"),
      ) as Surcharge[];
      return rows.map((s) => ({ ...s, amount: num(s.amount) }));
    },
  });
}

export function useShippingMessages(carrierId: string | undefined) {
  return useQuery({
    enabled: !!carrierId,
    queryKey: ["admin", "shipping_messages", carrierId],
    queryFn: async (): Promise<ShippingMessage[]> =>
      must(
        await supabase
          .from("shipping_messages")
          .select("id,carrier_id,status,locale,body_html")
          .eq("carrier_id", carrierId!),
      ) as ShippingMessage[],
  });
}

export function useImportBatches(carrierId: string | undefined) {
  return useQuery({
    enabled: !!carrierId,
    queryKey: ["admin", "import_batches", carrierId],
    queryFn: async (): Promise<ImportBatch[]> =>
      must(
        await supabase
          .from("shipping_import_batches")
          .select("*")
          .eq("carrier_id", carrierId!)
          .order("created_at", { ascending: false })
          .limit(20),
      ) as unknown as ImportBatch[],
  });
}

/* -------------------------------------------------------------- mutations */

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin"] });
}

export function useSaveCarrier() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (c: Partial<Carrier> & { code: string; name: string }) => {
      if (c.is_default) {
        const { error } = await supabase
          .from("shipping_carriers")
          .update({ is_default: false })
          .neq("id", c.id ?? "00000000-0000-0000-0000-000000000000");
        if (error) throw new Error(error.message);
      }
      const payload = { ...c, updated_at: new Date().toISOString() };
      const { data, error } = c.id
        ? await supabase.from("shipping_carriers").update(payload).eq("id", c.id).select().single()
        : await supabase.from("shipping_carriers").insert(payload as never).select().single();
      if (error) throw new Error(error.message);
      return data as Carrier;
    },

    onSuccess: invalidate,
  });
}

export function useDeleteCarrier() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shipping_carriers").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useSaveRateGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      carrier_id: string;
      code: string;
      label?: string | null;
      notes?: string | null;
      tiers: RateTier[];
    }) => {
      let groupId = input.id;
      if (groupId) {
        const { error } = await supabase
          .from("shipping_rate_groups")
          .update({
            code: input.code,
            label: input.label ?? null,
            notes: input.notes ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", groupId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase
          .from("shipping_rate_groups")
          .insert({
            carrier_id: input.carrier_id,
            code: input.code,
            label: input.label ?? null,
            notes: input.notes ?? null,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        groupId = data.id as string;
      }
      // Replace the tier table wholesale — simplest correct semantics.
      const del = await supabase
        .from("shipping_rate_tiers")
        .delete()
        .eq("rate_group_id", groupId);
      if (del.error) throw new Error(del.error.message);
      const tiers = input.tiers
        .filter((t) => Number.isFinite(t.max_weight_kg) && Number.isFinite(t.price))
        .sort((a, b) => a.max_weight_kg - b.max_weight_kg)
        .map((t) => ({
          rate_group_id: groupId!,
          max_weight_kg: t.max_weight_kg,
          price: t.price,
        }));
      if (tiers.length) {
        const ins = await supabase.from("shipping_rate_tiers").insert(tiers);
        if (ins.error) throw new Error(ins.error.message);
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeleteRateGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shipping_rate_groups").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useSaveCountryRule() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (r: {
      id?: string;
      carrier_id: string;
      country: string;
      country_code?: string | null;
      status: ServiceStatus;
      rate_group_id: string | null;
    }) => {
      const payload = {
        carrier_id: r.carrier_id,
        country: r.country,
        country_code: r.country_code ?? null,
        status: r.status,
        rate_group_id: r.status === "rated" ? r.rate_group_id : null,
        updated_at: new Date().toISOString(),
      };
      const { error } = r.id
        ? await supabase.from("shipping_country_rules").update(payload).eq("id", r.id)
        : await supabase.from("shipping_country_rules").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteCountryRule() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shipping_country_rules").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useSaveSurcharge() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (s: Partial<Surcharge> & { carrier_id: string; label: string }) => {
      const payload = { ...s, updated_at: new Date().toISOString() };
      const { error } = s.id
        ? await supabase.from("shipping_surcharges").update(payload).eq("id", s.id)
        : await supabase.from("shipping_surcharges").insert(payload as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteSurcharge() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shipping_surcharges").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useSaveShippingMessage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (m: {
      id?: string;
      carrier_id: string;
      status: ServiceStatus;
      body_html: string;
    }) => {
      const payload = {
        carrier_id: m.carrier_id,
        status: m.status,
        locale: "en",
        body_html: m.body_html,
        updated_at: new Date().toISOString(),
      };
      const { error } = m.id
        ? await supabase.from("shipping_messages").update(payload).eq("id", m.id)
        : await supabase.from("shipping_messages").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

/* ------------------------------------------------------------ CSV parsing */

export type ImportResult = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  warnings: string[];
};

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s._-]+/g, "");

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    if (keys.includes(norm(k))) return (row[k] ?? "").trim();
  }
  return "";
}

/** Map free-text CSV values onto a service status + rate-group code. */
export function readStatus(raw: string): { status: ServiceStatus; groupCode: string | null } {
  const v = norm(raw);
  if (!v || v === "norate" || v === "noratehere" || v === "n/a" || v === "na")
    return { status: "no_rate", groupCode: null };
  if (v === "noservice" || v === "notserviced" || v === "none")
    return { status: "no_service", groupCode: null };
  return { status: "rated", groupCode: raw.trim() };
}

function parseCsv(text: string): Record<string, string>[] {
  const res = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  return (res.data ?? []).filter((r) => r && Object.keys(r).length > 0);
}

/**
 * rate_groups.csv — accepts either
 *  wide:  max_weight_kg, RATE_GROUP_1, RATE_GROUP_2, …
 *  long:  rate_group, max_weight_kg, price
 */
export function parseRateGroupsCsv(text: string): {
  groups: Map<string, RateTier[]>;
  warnings: string[];
} {
  const rows = parseCsv(text);
  const groups = new Map<string, RateTier[]>();
  const warnings: string[] = [];
  if (!rows.length) return { groups, warnings: ["File contained no rows."] };

  const headers = Object.keys(rows[0]);
  const weightKeys = ["maxweightkg", "weight", "kg", "maxweight", "weightkg", "uptokg"];
  const weightHeader = headers.find((h) => weightKeys.includes(norm(h)));
  const groupHeader = headers.find((h) =>
    ["rategroup", "group", "rategroupcode", "code"].includes(norm(h)),
  );
  const priceHeader = headers.find((h) => ["price", "priceusd", "rate", "amount"].includes(norm(h)));

  if (groupHeader && priceHeader) {
    for (const [i, row] of rows.entries()) {
      const code = (row[groupHeader] ?? "").trim();
      const w = Number(row[weightHeader ?? ""] ?? NaN);
      const p = Number(row[priceHeader] ?? NaN);
      if (!code || !Number.isFinite(w) || !Number.isFinite(p)) {
        warnings.push(`Row ${i + 2}: skipped (missing group, weight or price).`);
        continue;
      }
      const list = groups.get(code) ?? [];
      list.push({ max_weight_kg: w, price: p });
      groups.set(code, list);
    }
    return { groups, warnings };
  }

  const wHeader = weightHeader ?? headers[0];
  const groupCols = headers.filter((h) => h !== wHeader && h.trim() !== "");
  if (!groupCols.length) return { groups, warnings: ["No rate-group columns found."] };
  for (const [i, row] of rows.entries()) {
    const w = Number(row[wHeader] ?? NaN);
    if (!Number.isFinite(w)) {
      warnings.push(`Row ${i + 2}: skipped (invalid weight "${row[wHeader]}").`);
      continue;
    }
    for (const col of groupCols) {
      const raw = (row[col] ?? "").replace(/[^0-9.\-]/g, "");
      if (raw === "") continue;
      const p = Number(raw);
      if (!Number.isFinite(p)) continue;
      const list = groups.get(col.trim()) ?? [];
      list.push({ max_weight_kg: w, price: p });
      groups.set(col.trim(), list);
    }
  }
  return { groups, warnings };
}

/** country_rate_groups.csv — country + rate group / status column. */
export function parseCountryRulesCsv(text: string): {
  rules: { country: string; countryCode: string | null; status: ServiceStatus; groupCode: string | null }[];
  warnings: string[];
} {
  const rows = parseCsv(text);
  const warnings: string[] = [];
  const rules: {
    country: string;
    countryCode: string | null;
    status: ServiceStatus;
    groupCode: string | null;
  }[] = [];
  for (const [i, row] of rows.entries()) {
    const country = pick(row, ["country", "countryname", "destination", "destinationcountry"]);
    if (!country) {
      warnings.push(`Row ${i + 2}: skipped (no country).`);
      continue;
    }
    const code = pick(row, ["countrycode", "iso", "isocode", "code2"]) || null;
    const rawGroup =
      pick(row, ["rategroup", "rategroupcode", "group", "zone", "ratetable"]) ||
      pick(row, ["status", "service"]);
    const { status, groupCode } = readStatus(rawGroup);
    rules.push({ country, countryCode: code, status, groupCode });
  }
  return { rules, warnings };
}

/* -------------------------------------------------------------- importers */

async function logBatch(input: {
  carrierId: string;
  kind: string;
  fileName: string | null;
  userLabel: string | null;
  result: ImportResult;
  snapshot: unknown;
}) {
  await supabase.from("shipping_import_batches").insert({
    carrier_id: input.carrierId,
    kind: input.kind,
    file_name: input.fileName,
    user_label: input.userLabel,
    rows_total: input.result.total,
    rows_created: input.result.created,
    rows_updated: input.result.updated,
    rows_skipped: input.result.skipped,
    warnings: input.result.warnings.slice(0, 200),
    snapshot: input.snapshot as never,
  });
}

export function useImportRateGroups() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      carrierId,
      text,
      fileName,
      userLabel,
    }: {
      carrierId: string;
      text: string;
      fileName: string;
      userLabel: string | null;
    }): Promise<ImportResult> => {
      const { groups, warnings } = parseRateGroupsCsv(text);
      const existing = must(
        await supabase
          .from("shipping_rate_groups")
          .select("id,code")
          .eq("carrier_id", carrierId),
      ) as { id: string; code: string }[];
      const existingIds = existing.map((g) => g.id);
      const snapshotTiers = existingIds.length
        ? must(
            await supabase
              .from("shipping_rate_tiers")
              .select("rate_group_id,max_weight_kg,price")
              .in("rate_group_id", existingIds),
          )
        : [];
      const byCode = new Map(existing.map((g) => [g.code, g.id]));

      let created = 0;
      let updated = 0;
      for (const [code, tiers] of groups) {
        let id = byCode.get(code);
        if (id) {
          updated++;
          const del = await supabase
            .from("shipping_rate_tiers")
            .delete()
            .eq("rate_group_id", id);
          if (del.error) throw new Error(del.error.message);
        } else {
          const { data, error } = await supabase
            .from("shipping_rate_groups")
            .insert({ carrier_id: carrierId, code })
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          id = data.id as string;
          byCode.set(code, id);
          created++;
        }
        const rows = tiers
          .sort((a, b) => a.max_weight_kg - b.max_weight_kg)
          .map((t) => ({ rate_group_id: id!, max_weight_kg: t.max_weight_kg, price: t.price }));
        for (let i = 0; i < rows.length; i += 500) {
          const ins = await supabase.from("shipping_rate_tiers").insert(rows.slice(i, i + 500));
          if (ins.error) throw new Error(ins.error.message);
        }
      }

      const result: ImportResult = {
        total: groups.size,
        created,
        updated,
        skipped: 0,
        warnings,
      };
      await logBatch({
        carrierId,
        kind: "rate_groups",
        fileName,
        userLabel,
        result,
        snapshot: { groups: existing, tiers: snapshotTiers },
      });
      return result;
    },
    onSuccess: invalidate,
  });
}

export function useImportCountryRules() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      carrierId,
      text,
      fileName,
      userLabel,
    }: {
      carrierId: string;
      text: string;
      fileName: string;
      userLabel: string | null;
    }): Promise<ImportResult> => {
      const { rules, warnings } = parseCountryRulesCsv(text);
      const existing = must(
        await supabase
          .from("shipping_country_rules")
          .select("id,country,country_code,status,rate_group_id")
          .eq("carrier_id", carrierId),
      ) as CountryRule[];
      const groups = must(
        await supabase.from("shipping_rate_groups").select("id,code").eq("carrier_id", carrierId),
      ) as { id: string; code: string }[];
      const groupByCode = new Map(groups.map((g) => [norm(g.code), g.id]));
      const ruleByCountry = new Map(existing.map((r) => [norm(r.country), r]));

      let created = 0;
      let updated = 0;
      let skipped = 0;
      for (const r of rules) {
        let rateGroupId: string | null = null;
        if (r.status === "rated") {
          rateGroupId = groupByCode.get(norm(r.groupCode ?? "")) ?? null;
          if (!rateGroupId) {
            warnings.push(`${r.country}: rate group "${r.groupCode}" not found — skipped.`);
            skipped++;
            continue;
          }
        }
        const payload = {
          carrier_id: carrierId,
          country: r.country,
          country_code: r.countryCode,
          status: r.status,
          rate_group_id: rateGroupId,
          updated_at: new Date().toISOString(),
        };
        const hit = ruleByCountry.get(norm(r.country));
        if (hit) {
          const { error } = await supabase
            .from("shipping_country_rules")
            .update(payload)
            .eq("id", hit.id);
          if (error) throw new Error(error.message);
          updated++;
        } else {
          const { error } = await supabase.from("shipping_country_rules").insert(payload);
          if (error) throw new Error(error.message);
          created++;
        }
      }

      const result: ImportResult = {
        total: rules.length,
        created,
        updated,
        skipped,
        warnings,
      };
      await logBatch({
        carrierId,
        kind: "country_rules",
        fileName,
        userLabel,
        result,
        snapshot: { rules: existing },
      });
      return result;
    },
    onSuccess: invalidate,
  });
}

/** Restore the pre-import state captured in a batch snapshot. */
export function useRollbackBatch() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (batch: ImportBatch) => {
      const snap = (batch.snapshot ?? {}) as {
        rules?: CountryRule[];
        groups?: { id: string; code: string }[];
        tiers?: { rate_group_id: string; max_weight_kg: number; price: number }[];
      };
      if (!batch.carrier_id) throw new Error("Batch has no carrier.");

      if (batch.kind === "country_rules") {
        const del = await supabase
          .from("shipping_country_rules")
          .delete()
          .eq("carrier_id", batch.carrier_id);
        if (del.error) throw new Error(del.error.message);
        const rows = (snap.rules ?? []).map((r) => ({
          carrier_id: batch.carrier_id!,
          country: r.country,
          country_code: r.country_code,
          status: r.status,
          rate_group_id: r.rate_group_id,
        }));
        for (let i = 0; i < rows.length; i += 500) {
          const ins = await supabase.from("shipping_country_rules").insert(rows.slice(i, i + 500));
          if (ins.error) throw new Error(ins.error.message);
        }
      } else if (batch.kind === "rate_groups") {
        const keep = new Set((snap.groups ?? []).map((g) => g.id));
        const current = must(
          await supabase
            .from("shipping_rate_groups")
            .select("id")
            .eq("carrier_id", batch.carrier_id),
        ) as { id: string }[];
        const toDelete = current.filter((g) => !keep.has(g.id)).map((g) => g.id);
        if (toDelete.length) {
          const del = await supabase.from("shipping_rate_groups").delete().in("id", toDelete);
          if (del.error) throw new Error(del.error.message);
        }
        if (keep.size) {
          const delTiers = await supabase
            .from("shipping_rate_tiers")
            .delete()
            .in("rate_group_id", [...keep]);
          if (delTiers.error) throw new Error(delTiers.error.message);
        }
        const rows = snap.tiers ?? [];
        for (let i = 0; i < rows.length; i += 500) {
          const ins = await supabase.from("shipping_rate_tiers").insert(rows.slice(i, i + 500));
          if (ins.error) throw new Error(ins.error.message);
        }
      } else {
        throw new Error(`Cannot roll back "${batch.kind}" imports.`);
      }

      const { error } = await supabase
        .from("shipping_import_batches")
        .update({ rolled_back_at: new Date().toISOString() })
        .eq("id", batch.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

/* -------------------------------------------------------------- exporters */

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function rateGroupsToCsv(groups: (RateGroup & { tiers: RateTier[] })[]): string {
  const weights = [...new Set(groups.flatMap((g) => g.tiers.map((t) => t.max_weight_kg)))].sort(
    (a, b) => a - b,
  );
  const codes = groups.map((g) => g.code);
  const lines = [["max_weight_kg", ...codes].join(",")];
  for (const w of weights) {
    const cells = groups.map((g) => {
      const t = g.tiers.find((x) => Math.abs(x.max_weight_kg - w) < 1e-9);
      return t ? String(t.price) : "";
    });
    lines.push([String(w), ...cells].join(","));
  }
  return lines.join("\n");
}

export function countryRulesToCsv(
  rules: CountryRule[],
  groups: { id: string; code: string }[],
): string {
  const codeById = new Map(groups.map((g) => [g.id, g.code]));
  const lines = ["country,country_code,rate_group"];
  for (const r of rules) {
    const value =
      r.status === "rated" ? (codeById.get(r.rate_group_id ?? "") ?? "") : r.status.replace("_", " ");
    lines.push(
      [r.country, r.country_code ?? "", value]
        .map((c) => (c.includes(",") ? `"${c}"` : c))
        .join(","),
    );
  }
  return lines.join("\n");
}
