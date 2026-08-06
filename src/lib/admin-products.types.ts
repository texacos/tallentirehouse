// Shared, client-safe types + validation for the admin products dashboard.
import { z } from "zod";

export const PRODUCT_STATUSES = [
  "draft",
  "published",
  "hidden",
  "archived",
  "scheduled",
] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const STATUS_LABEL: Record<ProductStatus, string> = {
  draft: "Draft",
  published: "Published",
  hidden: "Hidden",
  archived: "Archived",
  scheduled: "Scheduled",
};

export type StockLevel = "in" | "low" | "out" | "archived";

export const adminVariantSchema = z.object({
  size: z.string().trim().min(1).max(60),
  colour: z.string().trim().max(60).default(""),
  material: z.string().trim().max(60).default(""),
  sku: z.string().trim().max(60).default(""),
  barcode: z.string().trim().max(60).default(""),
  price: z.coerce.number().min(0).max(1_000_000),
  stock: z.coerce.number().int().min(0).max(10_000_000),
  weight_kg: z.coerce.number().min(0).max(1000).default(0),
  volume: z.string().trim().max(40).default(""),
  length: z.string().trim().max(40).default(""),
  image: z.string().trim().max(500).default(""),
  attributes: z.record(z.string(), z.string().max(200)).default({}),
});
export type AdminVariant = z.infer<typeof adminVariantSchema>;

export const adminProductSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  name: z.string().trim().min(1, "Name is required").max(160),
  sku: z.string().trim().max(60).default(""),
  barcode: z.string().trim().max(60).default(""),
  brand: z.string().trim().max(80).default(""),
  supplier: z.string().trim().max(80).default(""),
  collection: z.string().trim().max(80).default(""),
  tags: z.array(z.string().trim().min(1).max(40)).max(50).default([]),
  price: z.coerce.number().min(0, "Price must be 0 or more").max(1_000_000),
  sale_price: z.coerce.number().min(0).max(1_000_000).nullable().default(null),
  cost_price: z.coerce.number().min(0).max(1_000_000).nullable().default(null),
  weight_kg: z.coerce.number().min(0).max(1000),
  stock: z.coerce.number().int().min(0).max(10_000_000),
  reorder_level: z.coerce.number().int().min(0).max(1_000_000).default(0),
  track_inventory: z.boolean().default(true),
  backorders: z.boolean().default(false),
  location: z.string().trim().max(80).default(""),
  description: z.string().trim().max(8000).default(""),
  seo_title: z.string().trim().max(160).default(""),
  seo_description: z.string().trim().max(320).default(""),
  categories: z.array(z.string().min(1).max(80)).min(1, "Pick at least one category"),
  images: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  image_alts: z.array(z.string().trim().max(200)).max(30).default([]),
  variants: z.array(adminVariantSchema).max(200).default([]),
  status: z.enum(PRODUCT_STATUSES).default("draft"),
  published_at: z.string().nullable().default(null),
});
export type AdminProductInput = z.input<typeof adminProductSchema>;
export type AdminProductValues = z.infer<typeof adminProductSchema>;

export type AdminProduct = AdminProductValues & {
  id: string;
  total_stock: number;
  created_at: string;
  updated_at: string;
};

export const SORT_FIELDS = [
  "name",
  "price",
  "total_stock",
  "updated_at",
  "created_at",
  "sku",
] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const SORT_LABEL: Record<SortField, string> = {
  name: "Name",
  price: "Price",
  total_stock: "Stock",
  updated_at: "Updated",
  created_at: "Created",
  sku: "SKU",
};

export const listFiltersSchema = z.object({
  search: z.string().trim().max(120).default(""),
  statuses: z.array(z.enum(PRODUCT_STATUSES)).default([]),
  categories: z.array(z.string().max(80)).max(40).default([]),
  brands: z.array(z.string().max(80)).max(40).default([]),
  collections: z.array(z.string().max(80)).max(40).default([]),
  suppliers: z.array(z.string().max(80)).max(40).default([]),
  tags: z.array(z.string().max(40)).max(40).default([]),
  stockStatus: z.enum(["any", "in", "low", "out"]).default("any"),
  priceMin: z.number().min(0).nullable().default(null),
  priceMax: z.number().min(0).nullable().default(null),
  stockMin: z.number().int().min(0).nullable().default(null),
  stockMax: z.number().int().min(0).nullable().default(null),
  createdFrom: z.string().max(30).nullable().default(null),
  createdTo: z.string().max(30).nullable().default(null),
  updatedFrom: z.string().max(30).nullable().default(null),
  updatedTo: z.string().max(30).nullable().default(null),
  sort: z.enum(SORT_FIELDS).default("updated_at"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).max(10_000).default(1),
  pageSize: z.union([
    z.literal(25),
    z.literal(50),
    z.literal(100),
    z.literal(250),
    z.literal(500),
  ]).default(50),
});
export type ListFilters = z.infer<typeof listFiltersSchema>;

export const DEFAULT_FILTERS: ListFilters = listFiltersSchema.parse({});

export const PAGE_SIZES = [25, 50, 100, 250, 500] as const;

export const COLUMNS = [
  { key: "image", label: "Image", always: true },
  { key: "name", label: "Product", always: true },
  { key: "sku", label: "SKU" },
  { key: "category", label: "Category" },
  { key: "price", label: "Price" },
  { key: "sale_price", label: "Sale price" },
  { key: "stock", label: "Stock" },
  { key: "stock_status", label: "Stock status" },
  { key: "status", label: "Status" },
  { key: "visibility", label: "Visibility" },
  { key: "updated_at", label: "Updated" },
] as const;
export type ColumnKey = (typeof COLUMNS)[number]["key"];

export const DEFAULT_COLUMNS: ColumnKey[] = [
  "image",
  "name",
  "sku",
  "category",
  "price",
  "stock",
  "stock_status",
  "status",
  "updated_at",
];

export const bulkActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("status"), status: z.enum(PRODUCT_STATUSES) }),
  z.object({ type: z.literal("delete") }),
  z.object({ type: z.literal("duplicate") }),
  z.object({ type: z.literal("categories"), categories: z.array(z.string().max(80)).min(1).max(20) }),
  z.object({ type: z.literal("brand"), brand: z.string().trim().max(80) }),
  z.object({ type: z.literal("addTags"), tags: z.array(z.string().trim().min(1).max(40)).min(1).max(20) }),
  z.object({ type: z.literal("removeTags"), tags: z.array(z.string().trim().min(1).max(40)).min(1).max(20) }),
  z.object({
    type: z.literal("price"),
    mode: z.enum(["set", "increase", "decrease"]),
    field: z.enum(["price", "sale_price"]),
    unit: z.enum(["amount", "percent"]),
    value: z.number().min(0).max(1_000_000),
  }),
  z.object({
    type: z.literal("inventory"),
    mode: z.enum(["set", "increase", "decrease"]),
    value: z.number().int().min(0).max(10_000_000),
  }),
]);
export type BulkAction = z.infer<typeof bulkActionSchema>;

/** Total units on hand — variants win when present. */
export function stockOf(p: Pick<AdminProduct, "variants" | "stock" | "total_stock">): number {
  if (typeof p.total_stock === "number") return p.total_stock;
  if (p.variants.length) return p.variants.reduce((n, v) => n + (v.stock ?? 0), 0);
  return p.stock ?? 0;
}

export function stockLevel(p: AdminProduct): StockLevel {
  if (p.status === "archived") return "archived";
  const n = stockOf(p);
  if (n <= 0) return "out";
  if (p.reorder_level > 0 && n <= p.reorder_level) return "low";
  return "in";
}

export const STOCK_LEVEL_LABEL: Record<StockLevel, string> = {
  in: "In stock",
  low: "Low stock",
  out: "Out of stock",
  archived: "Archived",
};

export function isVisible(p: AdminProduct): boolean {
  if (p.status === "published") return true;
  if (p.status === "scheduled" && p.published_at) {
    return new Date(p.published_at).getTime() <= Date.now();
  }
  return false;
}

export function margin(p: Pick<AdminProduct, "price" | "sale_price" | "cost_price">) {
  const sell = p.sale_price ?? p.price;
  const cost = p.cost_price;
  if (!cost || cost <= 0 || sell <= 0) return null;
  return {
    profit: sell - cost,
    marginPct: ((sell - cost) / sell) * 100,
    markupPct: ((sell - cost) / cost) * 100,
  };
}

export function emptyProduct(): AdminProductValues {
  return adminProductSchema.parse({
    slug: "new-product",
    name: "",
    price: 0,
    weight_kg: 0.5,
    stock: 0,
    categories: [],
  });
}

export type ProductStats = {
  total: number;
  active: number;
  draft: number;
  archived: number;
  outOfStock: number;
  lowStock: number;
  inventoryValue: number;
  averagePrice: number;
  newest: Array<{ slug: string; name: string; created_at: string }>;
  recentlyUpdated: Array<{ slug: string; name: string; updated_at: string }>;
};

export type ProductFacets = {
  brands: string[];
  collections: string[];
  suppliers: string[];
  tags: string[];
};

export type AuditEntry = {
  id: string;
  actor_label: string;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string;
  created_at: string;
};

export type RevisionEntry = {
  id: string;
  product_slug: string;
  changed_fields: string[];
  actor_label: string;
  action: string;
  created_at: string;
  snapshot: Record<string, unknown>;
};
