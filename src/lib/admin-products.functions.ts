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
  duplicateSkuMessage,
  isUniqueViolation,
  generateSku,
  skuFieldsChanged,
  loose,
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
    const db = loose(context.supabase);
    await assertAdmin(db, context.userId);
    return queryProducts(db, data);
  });

export const adminProductMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ stats: ProductStats; facets: ProductFacets; categories: string[] }> => {
      const db = loose(context.supabase);
      await assertAdmin(db, context.userId);
      return computeMeta(db);
    },
  );

export const adminSaveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => adminProductSchema.parse(input))
  .handler(async ({ data, context }): Promise<AdminProduct> => {
    const db = loose(context.supabase);
    await assertAdmin(db, context.userId);
    const values = parseProductValues(data);
    const row = toRow(values);

    const { data: existing } = await db
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("slug", values.slug)
      .maybeSingle();

    let saved: Record<string, unknown>;
    if (!existing) {
      if (!String(row["sku"] ?? "").trim()) {
        row["sku"] = await generateSku(db, values);
      }
    } else if (skuFieldsChanged(existing as Record<string, unknown>, values)) {
      // Category, design or colour changed -> keep the SKU in sync.
      row["sku"] = await generateSku(db, values, {
        currentSku: String((existing as Record<string, unknown>)["sku"] ?? ""),
        excludeSlug: values.slug,
      });
    }

    // Backend uniqueness check: no two products may share a SKU (case-insensitive).
    const sku = String(row["sku"] ?? "").trim();
    if (sku) {
      const { data: clash } = await db
        .from("products")
        .select("id,slug,name")
        .ilike("sku", sku)
        .limit(2);
      const conflict = (clash ?? []).find(
        (r: { slug: string }) => String(r.slug) !== values.slug,
      );
      if (conflict) throw new Error(duplicateSkuMessage(sku));
    }

    if (existing) {
      const { data: updated, error } = await db
        .from("products")
        .update(row)
        .eq("slug", values.slug)
        .select(PRODUCT_COLUMNS)
        .single();
      if (error) {
        console.error("[admin-products] update failed", error);
        throw new Error(isUniqueViolation(error) ? duplicateSkuMessage(sku) : "Could not save the product");
      }
      saved = updated as Record<string, unknown>;
    } else {
      const { data: inserted, error } = await db
        .from("products")
        .insert(row)
        .select(PRODUCT_COLUMNS)
        .single();
      if (error) {
        console.error("[admin-products] insert failed", error);
        throw new Error(isUniqueViolation(error) ? duplicateSkuMessage(sku) : "Could not create the product");
      }
      saved = inserted as Record<string, unknown>;
    }


    const product = mapRow(saved);
    const changed = diffFields(existing ? (existing as Record<string, unknown>) : null, row);
    await writeRevision(db, {
      productId: product.id,
      slug: product.slug,
      snapshot: (existing as Record<string, unknown>) ?? {},
      changedFields: changed,
      actorId: context.userId,
      actorLabel: actorLabel(context.claims),
      action: existing ? "update" : "create",
    });
    await writeAudit(db, {
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
    }): Promise<{
      affected: number;
      undo: Array<{ id: string; patchJson: string }>;
      deleted: AdminProduct[];
    }> => {
      const db = loose(context.supabase);
      await assertAdmin(db, context.userId);
      const { data: rows, error } = await db
        .from("products")
        .select(PRODUCT_COLUMNS)
        .in("id", data.ids);
      if (error) throw new Error("Could not load the selected products");
      const products = (rows ?? []).map((r: Record<string, unknown>) => mapRow(r));
      const label = actorLabel(context.claims);
      const undo: Array<{ id: string; patchJson: string }> = [];

      if (data.action.type === "delete") {
        for (const p of products) {
          await writeRevision(db, {
            productId: p.id,
            slug: p.slug,
            snapshot: p as unknown as Record<string, unknown>,
            changedFields: ["*"],
            actorId: context.userId,
            actorLabel: label,
            action: "delete",
          });
        }
        const { error: delErr } = await db.from("products").delete().in("id", data.ids);
        if (delErr) throw new Error("Could not delete the selected products");

        // Purge stored image folders (master + derivatives) for the deleted
        // products, keeping any image still referenced by a surviving product.
        const { purgeManagedImages } = await import("./product-images.server");
        const { data: remaining } = await db.from("products").select("images");
        const keep = (remaining ?? []).flatMap((r: { images: string[] | null }) => r.images ?? []);
        const purged = await purgeManagedImages(
          db,
          products.flatMap((p) => p.images ?? []),
          keep,
        );

        await writeAudit(db, {
          actorId: context.userId,
          actorLabel: label,
          action: "product.delete",
          summary: describeBulk(data.action, products.length),
          details: { slugs: products.map((p) => p.slug), imagesPurged: purged.length },
        });
        return { affected: products.length, undo: [], deleted: products };
      }

      if (data.action.type === "duplicate") {
        const { data: allSlugs } = await db.from("products").select("slug");
        const taken = new Set(
          (allSlugs ?? []).map((r: { slug: string }) => String(r.slug)),
        );
        let made = 0;
        for (const p of products) {
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
          const copy = toRow(values);
          // Each copy needs its own SKU — SKUs are unique across products.
          copy["sku"] = await generateSku(db, values);
          const { error: insErr } = await db.from("products").insert(copy);
          if (insErr) {
            console.error("[admin-products] duplicate failed", insErr);
            throw new Error(
              isUniqueViolation(insErr)
                ? "Could not duplicate: the generated SKU already exists. Try again."
                : "Could not duplicate the selected products",
            );
          }
          made += 1;
        }
        const copies = { length: made };

        await writeAudit(db, {
          actorId: context.userId,
          actorLabel: label,
          action: "product.duplicate",
          summary: describeBulk(data.action, copies.length),
        });
        return { affected: copies.length, undo: [], deleted: [] };
      }

      let affected = 0;
      for (const p of products) {
        const patch = bulkPatch(p, data.action);
        if (!patch) continue;
        const before: Record<string, unknown> = {};
        for (const key of Object.keys(patch)) {
          before[key] = (p as unknown as Record<string, unknown>)[key];
        }
        const { error: upErr } = await db.from("products").update(patch).eq("id", p.id);
        if (upErr) continue;
        undo.push({ id: p.id, patchJson: JSON.stringify(before) });
        affected += 1;
      }
      await writeAudit(db, {
        actorId: context.userId,
        actorLabel: label,
        action: `product.bulk.${data.action.type}`,
        summary: describeBulk(data.action, affected),
        details: { action: data.action },
      });
      return { affected, undo, deleted: [] };
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
          .array(z.object({ id: z.string().uuid(), patchJson: z.string().max(200_000) }))
          .min(1)
          .max(1000),
        reason: z.string().max(120).default("undo"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ affected: number }> => {
    const db = loose(context.supabase);
    await assertAdmin(db, context.userId);
    let affected = 0;
    for (const item of data.patches) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(item.patchJson);
      } catch {
        continue;
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (PATCHABLE.has(k)) clean[k] = v;
      }
      if (!Object.keys(clean).length) continue;
      const { error } = await db.from("products").update(clean).eq("id", item.id);
      if (!error) affected += 1;
    }
    await writeAudit(db, {
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
    const db = loose(context.supabase);
    await assertAdmin(db, context.userId);
    const rows = data.products.map((p) => toRow(parseProductValues(p)));
    const { error } = await db.from("products").upsert(rows, { onConflict: "slug" });
    if (error) throw new Error("Could not restore the products");
    await writeAudit(db, {
      actorId: context.userId,
      actorLabel: actorLabel(context.claims),
      action: "product.restore",
      summary: `Restored ${rows.length} product${rows.length === 1 ? "" : "s"}`,
    });
    return { restored: rows.length };
  });

export const adminProductRevisions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ productId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<RevisionEntry[]> => {
    const db = loose(context.supabase);
    await assertAdmin(db, context.userId);
    const { data: rows, error } = await db
      .from("product_revisions")
      .select("id,product_slug,changed_fields,actor_label,action,created_at,snapshot")
      .eq("product_id", data.productId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Could not load the change history");
    return (rows ?? []).map((r: Record<string, unknown>) => ({
      id: String(r["id"]),
      product_slug: String(r["product_slug"]),
      changed_fields: Array.isArray(r["changed_fields"]) ? (r["changed_fields"] as string[]) : [],
      actor_label: String(r["actor_label"] ?? ""),
      action: String(r["action"] ?? "update"),
      created_at: String(r["created_at"]),
      snapshotJson: JSON.stringify(r["snapshot"] ?? {}),
    }));
  });

export const adminAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<AuditEntry[]> => {
    const db = loose(context.supabase);
    await assertAdmin(db, context.userId);
    const { data: rows, error } = await db
      .from("admin_audit_log")
      .select("id,actor_label,action,entity,entity_id,summary,created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error("Could not load the audit log");
    return (rows ?? []).map((r: Record<string, unknown>) => ({
      id: String(r["id"]),
      actor_label: String(r["actor_label"] ?? ""),
      action: String(r["action"] ?? ""),
      entity: String(r["entity"] ?? "product"),
      entity_id: r["entity_id"] == null ? null : String(r["entity_id"]),
      summary: String(r["summary"] ?? ""),
      created_at: String(r["created_at"]),
    }));
  });

const prefsSchema = z.object({
  visible_columns: z.array(z.string().max(40)).max(40).default([]),
  saved_filters: z
    .array(z.object({ name: z.string().max(60), filtersJson: z.string().max(8000) }))
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
    const db = loose(context.supabase);
    await assertAdmin(db, context.userId);
    const { data, error } = await db
      .from("admin_preferences")
      .select("visible_columns,saved_filters,favourites,recent_products,page_size")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !data) return null;
    const parsed = prefsSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  });

export const adminSavePrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => prefsSchema.partial().parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = loose(context.supabase);
    await assertAdmin(db, context.userId);
    const { error } = await db
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
  .handler(async ({ data, context }): Promise<{ created: number; updated: number }> => {
    const db = loose(context.supabase);
    await assertAdmin(db, context.userId);
    const slugs = data.products.map((p) => p.slug);
    const { data: existing } = await db.from("products").select("slug").in("slug", slugs);
    const known = new Set((existing ?? []).map((r: { slug: string }) => String(r.slug)));
    const rows = data.products.map((p) => toRow(parseProductValues(p)));

    // Reject the whole import when SKUs collide inside the file or with other products.
    const seen = new Map<string, string>();
    for (const r of rows) {
      const s = String(r["sku"] ?? "").trim().toLowerCase();
      if (!s) continue;
      const prev = seen.get(s);
      if (prev && prev !== String(r["slug"] ?? "")) {
        throw new Error(`Import failed — SKU "${r["sku"]}" appears more than once in the file`);
      }
      seen.set(s, String(r["slug"] ?? ""));
    }
    if (seen.size) {
      const { data: clashes } = await db.from("products").select("slug,sku");
      for (const c of (clashes ?? []) as Array<{ slug: string; sku: string | null }>) {
        const s = String(c.sku ?? "").trim().toLowerCase();
        if (!s) continue;
        const incomingSlug = seen.get(s);
        if (incomingSlug && incomingSlug !== String(c.slug)) {
          throw new Error(
            `Import failed — SKU "${c.sku}" is already used by another product. No changes were applied.`,
          );
        }
      }
    }

    const { error } = await db.from("products").upsert(rows, { onConflict: "slug" });
    if (error) {
      console.error("[admin-products] import failed", error);
      throw new Error(
        isUniqueViolation(error)
          ? "Import failed — duplicate SKU detected. No changes were applied."
          : "Import failed — no changes were applied",
      );
    }

    const updated = slugs.filter((s) => known.has(s)).length;
    const created = slugs.length - updated;
    await writeAudit(db, {
      actorId: context.userId,
      actorLabel: actorLabel(context.claims),
      action: "product.import",
      summary: `Imported CSV: ${created} created, ${updated} updated`,
    });
    return { created, updated };
  });

export const adminExportProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listFiltersSchema.parse(input))
  .handler(async ({ data, context }): Promise<AdminProduct[]> => {
    const db = loose(context.supabase);
    await assertAdmin(db, context.userId);
    const result = await queryProducts(db, { ...data, page: 1, pageSize: 500 });
    return result.rows;
  });
