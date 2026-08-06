// Server-only helpers for the admin products dashboard.
// Imported by admin-products.functions.ts (never by client code directly).
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminProductSchema,
  adminVariantSchema,
  listFiltersSchema,
  stockOf,
  type AdminProduct,
  type AdminProductValues,
  type AdminVariant,
  type BulkAction,
  type ListFilters,
  type ProductFacets,
  type ProductStats,
} from "./admin-products.types";

type Db = SupabaseClient<any, any, any>;

export const PRODUCT_COLUMNS =
  "id,slug,name,sku,barcode,brand,supplier,collection,tags,price,sale_price,cost_price,weight_kg,stock,total_stock,reorder_level,track_inventory,backorders,location,description,seo_title,seo_description,categories,images,image_alts,variants,status,published_at,created_at,updated_at";

/** Throws when the caller is not an admin. Never trust the client. */
export async function assertAdmin(supabase: Db, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Permission check failed");
  if (!data) throw new Error("Not authorised");
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function normaliseVariant(raw: unknown): AdminVariant {
  const v = (raw ?? {}) as Record<string, unknown>;
  const parsed = adminVariantSchema.safeParse({
    size: str(v["size"], "One size") || "One size",
    colour: str(v["colour"]),
    material: str(v["material"]),
    sku: str(v["sku"]),
    barcode: str(v["barcode"]),
    price: num(v["price"]),
    stock: Math.max(0, Math.trunc(num(v["stock"]))),
    weight_kg: num(v["weight_kg"]),
    volume: str(v["volume"]),
    length: str(v["length"]),
    image: str(v["image"]),
    attributes:
      v["attributes"] && typeof v["attributes"] === "object" && !Array.isArray(v["attributes"])
        ? (v["attributes"] as Record<string, string>)
        : {},
  });
  return parsed.success
    ? parsed.data
    : adminVariantSchema.parse({ size: "One size", price: 0, stock: 0 });
}

export function mapRow(row: Record<string, unknown>): AdminProduct {
  const variants = Array.isArray(row["variants"])
    ? (row["variants"] as unknown[]).map(normaliseVariant)
    : [];
  return {
    id: str(row["id"]),
    slug: str(row["slug"]),
    name: str(row["name"]),
    sku: str(row["sku"]),
    barcode: str(row["barcode"]),
    brand: str(row["brand"]),
    supplier: str(row["supplier"]),
    collection: str(row["collection"]),
    tags: Array.isArray(row["tags"]) ? (row["tags"] as string[]) : [],
    price: num(row["price"]),
    sale_price: row["sale_price"] == null ? null : num(row["sale_price"]),
    cost_price: row["cost_price"] == null ? null : num(row["cost_price"]),
    weight_kg: num(row["weight_kg"], 0.5),
    stock: Math.trunc(num(row["stock"])),
    total_stock: Math.trunc(num(row["total_stock"])),
    reorder_level: Math.trunc(num(row["reorder_level"])),
    track_inventory: row["track_inventory"] !== false,
    backorders: row["backorders"] === true,
    location: str(row["location"]),
    description: str(row["description"]),
    seo_title: str(row["seo_title"]),
    seo_description: str(row["seo_description"]),
    categories: Array.isArray(row["categories"]) ? (row["categories"] as string[]) : [],
    images: Array.isArray(row["images"]) ? (row["images"] as string[]) : [],
    image_alts: Array.isArray(row["image_alts"]) ? (row["image_alts"] as string[]) : [],
    variants,
    status: (["draft", "published", "hidden", "archived", "scheduled"] as const).includes(
      row["status"] as never,
    )
      ? (row["status"] as AdminProduct["status"])
      : "draft",
    published_at: row["published_at"] == null ? null : String(row["published_at"]),
    created_at: String(row["created_at"] ?? new Date().toISOString()),
    updated_at: String(row["updated_at"] ?? new Date().toISOString()),
  };
}

/** Values written to the products table. */
export function toRow(values: AdminProductValues): Record<string, unknown> {
  const variable = values.variants.length > 0;
  return {
    slug: values.slug,
    name: values.name,
    sku: values.sku,
    barcode: values.barcode,
    brand: values.brand,
    supplier: values.supplier,
    collection: values.collection,
    tags: values.tags,
    price: values.price,
    sale_price: values.sale_price,
    cost_price: values.cost_price,
    weight_kg: values.weight_kg,
    stock: variable ? 0 : values.stock,
    reorder_level: values.reorder_level,
    track_inventory: values.track_inventory,
    backorders: values.backorders,
    location: values.location,
    description: values.description,
    seo_title: values.seo_title,
    seo_description: values.seo_description,
    categories: values.categories,
    images: values.images,
    image_alts: values.image_alts,
    variants: values.variants,
    status: values.status,
    published_at:
      values.status === "published" || values.status === "scheduled"
        ? (values.published_at ?? new Date().toISOString())
        : values.published_at,
  };
}

const ESCAPE_OR = /[,()"]/g;

function safeTerm(s: string): string {
  return s.replace(ESCAPE_OR, " ").trim();
}

/** Applies filters/sort/pagination server-side so huge catalogues stay fast. */
export async function queryProducts(
  supabase: Db,
  input: ListFilters,
): Promise<{ rows: AdminProduct[]; total: number }> {
  const f = listFiltersSchema.parse(input);
  let q = supabase.from("products").select(PRODUCT_COLUMNS, { count: "exact" });

  if (f.statuses.length) q = q.in("status", f.statuses);
  if (f.categories.length) q = q.overlaps("categories", f.categories);
  if (f.tags.length) q = q.overlaps("tags", f.tags);
  if (f.brands.length) q = q.in("brand", f.brands);
  if (f.collections.length) q = q.in("collection", f.collections);
  if (f.suppliers.length) q = q.in("supplier", f.suppliers);
  if (f.priceMin != null) q = q.gte("price", f.priceMin);
  if (f.priceMax != null) q = q.lte("price", f.priceMax);
  if (f.stockMin != null) q = q.gte("total_stock", f.stockMin);
  if (f.stockMax != null) q = q.lte("total_stock", f.stockMax);
  if (f.createdFrom) q = q.gte("created_at", f.createdFrom);
  if (f.createdTo) q = q.lte("created_at", f.createdTo);
  if (f.updatedFrom) q = q.gte("updated_at", f.updatedFrom);
  if (f.updatedTo) q = q.lte("updated_at", f.updatedTo);
  if (f.stockStatus === "out") q = q.lte("total_stock", 0);
  if (f.stockStatus === "in") q = q.gt("total_stock", 0);
  if (f.stockStatus === "low") q = q.gt("total_stock", 0).lte("total_stock", 5);

  const term = safeTerm(f.search);
  if (term) {
    const like = `%${term}%`;
    q = q.or(
      [
        `name.ilike.${like}`,
        `slug.ilike.${like}`,
        `sku.ilike.${like}`,
        `barcode.ilike.${like}`,
        `brand.ilike.${like}`,
        `collection.ilike.${like}`,
        `supplier.ilike.${like}`,
        `description.ilike.${like}`,
      ].join(","),
    );
  }

  const from = (f.page - 1) * f.pageSize;
  q = q.order(f.sort, { ascending: f.dir === "asc" }).range(from, from + f.pageSize - 1);

  const { data, error, count } = await q;
  if (error) {
    console.error("[admin-products] list failed", error);
    throw new Error("Could not load products");
  }
  return {
    rows: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
    total: count ?? 0,
  };
}

export async function computeMeta(
  supabase: Db,
): Promise<{ stats: ProductStats; facets: ProductFacets; categories: string[] }> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "slug,name,status,price,cost_price,total_stock,reorder_level,brand,collection,supplier,tags,categories,created_at,updated_at",
    );
  if (error) {
    console.error("[admin-products] meta failed", error);
    throw new Error("Could not load dashboard statistics");
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const brands = new Set<string>();
  const collections = new Set<string>();
  const suppliers = new Set<string>();
  const tags = new Set<string>();
  const categories = new Set<string>();

  let active = 0;
  let draft = 0;
  let archived = 0;
  let outOfStock = 0;
  let lowStock = 0;
  let inventoryValue = 0;
  let priceSum = 0;

  for (const r of rows) {
    const status = String(r["status"] ?? "draft");
    const stock = Math.trunc(num(r["total_stock"]));
    const price = num(r["price"]);
    const cost = r["cost_price"] == null ? price : num(r["cost_price"]);
    const reorder = Math.trunc(num(r["reorder_level"]));
    if (status === "published") active += 1;
    if (status === "draft") draft += 1;
    if (status === "archived") archived += 1;
    if (stock <= 0) outOfStock += 1;
    else if (reorder > 0 && stock <= reorder) lowStock += 1;
    inventoryValue += stock * cost;
    priceSum += price;
    if (r["brand"]) brands.add(String(r["brand"]));
    if (r["collection"]) collections.add(String(r["collection"]));
    if (r["supplier"]) suppliers.add(String(r["supplier"]));
    for (const t of (r["tags"] as string[] | null) ?? []) tags.add(t);
    for (const c of (r["categories"] as string[] | null) ?? []) categories.add(c);
  }

  const byCreated = [...rows].sort((a, b) =>
    String(b["created_at"]).localeCompare(String(a["created_at"])),
  );
  const byUpdated = [...rows].sort((a, b) =>
    String(b["updated_at"]).localeCompare(String(a["updated_at"])),
  );

  return {
    stats: {
      total: rows.length,
      active,
      draft,
      archived,
      outOfStock,
      lowStock,
      inventoryValue: Math.round(inventoryValue * 100) / 100,
      averagePrice: rows.length ? Math.round((priceSum / rows.length) * 100) / 100 : 0,
      newest: byCreated.slice(0, 5).map((r) => ({
        slug: String(r["slug"]),
        name: String(r["name"]),
        created_at: String(r["created_at"]),
      })),
      recentlyUpdated: byUpdated.slice(0, 5).map((r) => ({
        slug: String(r["slug"]),
        name: String(r["name"]),
        updated_at: String(r["updated_at"]),
      })),
    },
    facets: {
      brands: [...brands].sort(),
      collections: [...collections].sort(),
      suppliers: [...suppliers].sort(),
      tags: [...tags].sort(),
    },
    categories: [...categories].sort(),
  };
}

export async function writeAudit(
  supabase: Db,
  entry: {
    actorId: string;
    actorLabel: string;
    action: string;
    entity?: string;
    entityId?: string | null;
    summary: string;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from("admin_audit_log").insert({
    actor_id: entry.actorId,
    actor_label: entry.actorLabel.slice(0, 160),
    action: entry.action,
    entity: entry.entity ?? "product",
    entity_id: entry.entityId ?? null,
    summary: entry.summary.slice(0, 500),
    details: entry.details ?? {},
  });
  if (error) console.error("[admin-products] audit write failed", error.message);
}

export async function writeRevision(
  supabase: Db,
  entry: {
    productId: string;
    slug: string;
    snapshot: Record<string, unknown>;
    changedFields: string[];
    actorId: string;
    actorLabel: string;
    action: string;
  },
): Promise<void> {
  const { error } = await supabase.from("product_revisions").insert({
    product_id: entry.productId,
    product_slug: entry.slug,
    snapshot: entry.snapshot,
    changed_fields: entry.changedFields.slice(0, 60),
    actor_id: entry.actorId,
    actor_label: entry.actorLabel.slice(0, 160),
    action: entry.action,
  });
  if (error) console.error("[admin-products] revision write failed", error.message);
}

export function diffFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
): string[] {
  if (!before) return Object.keys(after);
  const changed: string[] = [];
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changed.push(key);
  }
  return changed;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Computes the patch a bulk action applies to one product. */
export function bulkPatch(
  product: AdminProduct,
  action: BulkAction,
): Record<string, unknown> | null {
  switch (action.type) {
    case "status":
      return {
        status: action.status,
        published_at:
          action.status === "published" || action.status === "scheduled"
            ? (product.published_at ?? new Date().toISOString())
            : product.published_at,
      };
    case "categories":
      return { categories: action.categories };
    case "brand":
      return { brand: action.brand };
    case "addTags":
      return { tags: [...new Set([...product.tags, ...action.tags])].slice(0, 50) };
    case "removeTags":
      return { tags: product.tags.filter((t) => !action.tags.includes(t)) };
    case "price": {
      const current =
        action.field === "price" ? product.price : (product.sale_price ?? product.price);
      let next = current;
      if (action.mode === "set") next = action.value;
      else {
        const delta = action.unit === "percent" ? (current * action.value) / 100 : action.value;
        next = action.mode === "increase" ? current + delta : current - delta;
      }
      return { [action.field]: Math.max(0, round2(next)) };
    }
    case "inventory": {
      if (product.variants.length) {
        const variants = product.variants.map((v) => {
          const cur = v.stock;
          let next = cur;
          if (action.mode === "set") next = action.value;
          else next = action.mode === "increase" ? cur + action.value : cur - action.value;
          return { ...v, stock: Math.max(0, Math.trunc(next)) };
        });
        return { variants };
      }
      const cur = stockOf(product);
      let next = cur;
      if (action.mode === "set") next = action.value;
      else next = action.mode === "increase" ? cur + action.value : cur - action.value;
      return { stock: Math.max(0, Math.trunc(next)) };
    }
    default:
      return null;
  }
}

export function describeBulk(action: BulkAction, count: number): string {
  const n = `${count} product${count === 1 ? "" : "s"}`;
  switch (action.type) {
    case "status":
      return `Set status "${action.status}" on ${n}`;
    case "delete":
      return `Deleted ${n}`;
    case "duplicate":
      return `Duplicated ${n}`;
    case "categories":
      return `Changed category on ${n}`;
    case "brand":
      return `Changed brand on ${n}`;
    case "addTags":
      return `Added tags to ${n}`;
    case "removeTags":
      return `Removed tags from ${n}`;
    case "price":
      return `Updated ${action.field === "price" ? "price" : "sale price"} on ${n}`;
    case "inventory":
      return `Adjusted inventory on ${n}`;
    default:
      return `Bulk update on ${n}`;
  }
}

/** Makes a unique slug by appending -copy / -copy-2 … */
export function copySlug(slug: string, taken: Set<string>): string {
  let candidate = `${slug}-copy`.slice(0, 110);
  let i = 2;
  while (taken.has(candidate)) {
    candidate = `${slug}-copy-${i}`.slice(0, 118);
    i += 1;
  }
  return candidate;
}

export function parseProductValues(input: unknown): AdminProductValues {
  return adminProductSchema.parse(input);
}
