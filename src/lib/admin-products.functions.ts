// Thin server-function wrappers for the admin products dashboard.
// All heavy lifting lives in admin-products.server.ts (server-fn splitting rule).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  adminProductSchema,
  bulkActionSchema,
  listFiltersSchema,
  type AdminProduct,
  type AuditEntry,
  type ProductFacets,
  type ProductStats,
  type RevisionEntry,
} from "./admin-products.types";
import {
  assertAdmin,
  bulkPatch,
  computeMeta,
  copySlug,
  describeBulk,
  diffFields,
  mapRow,
  parseProductValues,
  PRODUCT_COLUMNS,
  queryProducts,
  toRow,
  writeAudit,
  writeRevision,
} from "./admin-products.server";

const actorLabel = (claims: unknown): string => {
  const c = (claims ?? {}) as Record<string, unknown>;
  return typeof c["email"] === "string" ? c["email"] : "admin";
};

export const adminListProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listFiltersSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ rows: AdminProduct[]; total: number }> => {
    await assertAdmin(context.supabase, context.userId);
    return queryProducts(context.supabase, data);
  });

export const adminProductMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ stats: ProductStats; facets: ProductFacets; categories: string[] }> => {
      await assertAdmin(context.supabase, context.userId);
      return computeMeta(context.supabase);
    },
  );

export const adminSaveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => adminProductSchema.parse(input))
  .handler(async ({ data, context }): Promise<AdminProduct> => {
    await assertAdmin(context.supabase, context.userId);
    const values = parseProductValues(data);
    const row = toRow(values);

    const { data: existing } = await context.supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("slug", values.slug)
      .maybeSingle();

    let saved: Record<string, unknown> | null = null;
    if (existing) {
      const { data: updated, error } = await context.supabase
        .from("products")
        .update(row)
        .eq("slug", values.slug)
        .select(PRODUCT_COLUMNS)
        .single();
      if (error) {
        console.error("[admin-products] update failed", error);
        throw new Error("Could not save the product");
      }
      saved = updated as Record<string, unknown>;
    } else {
      const { data: inserted, error } = await context.supabase
        .from("products")
        .insert(row)
        .select(PRODUCT_COLUMNS)
        .single();
      if (error) {
        console.error("[admin-products] insert failed", error);
        throw new Error("Could not create the product");
      }
      saved = inserted as Record<string, unknown>;
    }

    const product = mapRow(saved);
    const changed = diffFields(
      existing ? (existing as Record<string, unknown>) : null,
      row,
    );
    await writeRevision(context.supabase, {
      productId: product.id,
      slug: product.slug,
      snapshot: (existing as Record<string, unknown>) ?? {},
      changedFields: changed,
      actorId: context.userId,
      actorLabel: actorLabel(context.claims),
      action: existing ? "update" : "create",
    });
    await writeAudit(context.supabase, {
      actorId: context.userId,
      actorLabel: actorLabel(context.claims),
      action: existing ? "product.update" : "product.create",
      entityId: product.id,
      summary: `${existing ? "Updated" : "Created"} "${product.name}"${
        changed.length ? ` (${changed.slice(0, 6).join(", ")})` : ""
      }`,
      details: { changed },
    });
    return product;
  });

export const adminBulkAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(1000),
        action: bulkActionSchema,
      })
      .parse(input),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ affected: number; undo: Array<{ id: string; patch: Record<string, unknown> }> }> => {
      await assertAdmin(context.supabase, context.userId);
      const { data: rows, error } = await context.supabase
        .from("products")
        .select(PRODUCT_COLUMNS)
        .in("id", data.ids);
      if (error) throw new Error("Could not load the selected products");
      const products = (rows ?? []).map((r) => mapRow(r as Record<string, unknown>));
      const label = actorLabel(context.claims);
      const undo: Array<{ id: string; patch: Record<string, unknown> }> = [];

      if (data.action.type === "delete") {
        for (const p of products) {
          await writeRevision(context.supabase, {
            productId: p.id,
            slug: p.slug,
            snapshot: p as unknown as Record<string, unknown>,
            changedFields: ["*"],
            actorId: context.userId,
            actorLabel: label,
            action: "delete",
          });
        }
        const { error: delErr } = await context.supabase
          .from("products")
          .delete()
          .in("id", data.ids);
        if (delErr) throw new Error("Could not delete the selected products");
        await writeAudit(context.supabase, {
          actorId: context.userId,
          actorLabel: label,
          action: "product.delete",
          summary: describeBulk(data.action, products.length),
          details: { slugs: products.map((p) => p.slug) },
        });
        return { affected: products.length, undo: [] };
      }

      if (data.action.type === "duplicate") {
        const { data: allSlugs } = await context.supabase.from("products").select("slug");
        const taken = new Set((allSlugs ?? []).map((r) => String((r as { slug: string }).slug)));
        const copies = products.map((p) => {
          const slug = copySlug(p.slug, taken);
          taken.add(slug);
          const values = parseProductValues({
            ...p,
            id: undefined,
            slug,
            name: `${p.name} (copy)`,
            status: "draft",
            published_at: null,
          });
          return toRow(values);
        });
        const { error: insErr } = await context.supabase.from("products").insert(copies);
        if (insErr) throw new Error("Could not duplicate the selected products");
        await writeAudit(context.supabase, {
          actorId: context.userId,
          actorLabel: label,
          action: "product.duplicate",
          summary: describeBulk(data.action, copies.length),
        });
        return { affected: copies.length, undo: [] };
      }

      let affected = 0;
      for (const p of products) {
        const patch = bulkPatch(p, data.action);
        if (!patch) continue;
        const before: Record<string, unknown> = {};
        for (const key of Object.keys(patch)) {
          before[key] = (p as unknown as Record<string, unknown>)[key];
        }
        const { error: upErr } = await context.supabase
          .from("products")
          .update(patch)
          .eq("id", p.id);
        if (upErr) continue;
        undo.push({ id: p.id, patch: before });
        affected += 1;
      }
      await writeAudit(context.supabase, {
        actorId: context.userId,
        actorLabel: label,
        action: `product.bulk.${data.action.type}`,
        summary: describeBulk(data.action, affected),
        details: { action: data.action },
      });
      return { affected, undo };
    },
  );

const PATCHABLE = new Set([
  "price",
  "sale_price",
  "cost_price",
  "stock",
  "variants",
  "status",
  "published_at",
  "tags",
  "brand",
  "categories",
]);

export const adminApplyPatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        patches: z
          .array(z.object({ id: z.string().uuid(), patch: z.record(z.string(), z.unknown()) }))
          .min(1)
          .max(1000),
        reason: z.string().max(120).default("undo"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ affected: number }> => {
    await assertAdmin(context.supabase, context.userId);
    let affected = 0;
    for (const item of data.patches) {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(item.patch)) if (PATCHABLE.has(k)) clean[k] = v;
      if (!Object.keys(clean).length) continue;
      const { error } = await context.supabase.from("products").update(clean).eq("id", item.id);
      if (!error) affected += 1;
    }
    await writeAudit(context.supabase, {
      actorId: context.userId,
      actorLabel: actorLabel(context.claims),
      action: "product.undo",
      summary: `${data.reason}: reverted ${affected} product${affected === 1 ? "" : "s"}`,
    });
    return { affected };
  });

export const adminRestoreProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ products: z.array(adminProductSchema).min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ restored: number }> => {
    await assertAdmin(context.supabase, context.userId);
    const rows = data.products.map((p) => toRow(parseProductValues(p)));
    const { error } = await context.supabase
      .from("products")
      .upsert(rows, { onConflict: "slug" });
    if (error) throw new Error("Could not restore the products");
    await writeAudit(context.supabase, {
      actorId: context.userId,
      actorLabel: actorLabel(context.claims),
      action: "product.restore",
      summary: `Restored ${rows.length} product${rows.length === 1 ? "" : "s"}`,
    });
    return { restored: rows.length };
  });

export const adminProductRevisions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ productId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<RevisionEntry[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("product_revisions")
      .select("id,product_slug,changed_fields,actor_label,action,created_at,snapshot")
      .eq("product_id", data.productId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Could not load the change history");
    return (rows ?? []) as unknown as RevisionEntry[];
  });

export const adminAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<AuditEntry[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("admin_audit_log")
      .select("id,actor_label,action,entity,entity_id,summary,created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error("Could not load the audit log");
    return (rows ?? []) as unknown as AuditEntry[];
  });

const prefsSchema = z.object({
  visible_columns: z.array(z.string().max(40)).max(40).default([]),
  saved_filters: z
    .array(z.object({ name: z.string().max(60), filters: z.record(z.string(), z.unknown()) }))
    .max(30)
    .default([]),
  favourites: z.array(z.string().max(120)).max(200).default([]),
  recent_products: z.array(z.string().max(120)).max(20).default([]),
  page_size: z.number().int().min(25).max(500).default(50),
});
export type AdminPrefs = z.infer<typeof prefsSchema>;

export const adminGetPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPrefs | null> => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("admin_preferences")
      .select("visible_columns,saved_filters,favourites,recent_products,page_size")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) return null;
    if (!data) return null;
    const parsed = prefsSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  });

export const adminSavePrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => prefsSchema.partial().parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("admin_preferences")
      .upsert({ user_id: context.userId, ...data }, { onConflict: "user_id" });
    if (error) {
      console.error("[admin-products] prefs save failed", error);
      throw new Error("Could not save your preferences");
    }
    return { ok: true };
  });

export const adminImportProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ products: z.array(adminProductSchema).min(1).max(2000) }).parse(input),
  )
  .handler(
    async ({ data, context }): Promise<{ created: number; updated: number }> => {
      await assertAdmin(context.supabase, context.userId);
      const slugs = data.products.map((p) => p.slug);
      const { data: existing } = await context.supabase
        .from("products")
        .select("slug")
        .in("slug", slugs);
      const known = new Set((existing ?? []).map((r) => String((r as { slug: string }).slug)));
      const rows = data.products.map((p) => toRow(parseProductValues(p)));
      const { error } = await context.supabase
        .from("products")
        .upsert(rows, { onConflict: "slug" });
      if (error) {
        console.error("[admin-products] import failed", error);
        throw new Error("Import failed — no changes were applied");
      }
      const updated = slugs.filter((s) => known.has(s)).length;
      const created = slugs.length - updated;
      await writeAudit(context.supabase, {
        actorId: context.userId,
        actorLabel: actorLabel(context.claims),
        action: "product.import",
        summary: `Imported CSV: ${created} created, ${updated} updated`,
      });
      return { created, updated };
    },
  );

export const adminExportProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listFiltersSchema.parse(input))
  .handler(async ({ data, context }): Promise<AdminProduct[]> => {
    await assertAdmin(context.supabase, context.userId);
    const result = await queryProducts(context.supabase, {
      ...data,
      page: 1,
      pageSize: 500,
    });
    return result.rows;
  });
