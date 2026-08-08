// Client-safe CSV helpers for the admin products dashboard.
import Papa from "papaparse";
import {
  adminProductSchema,
  type AdminProduct,
  type AdminProductValues,
} from "./admin-products.types";

export const CSV_COLUMNS = [
  "slug",
  "name",
  "sku",
  "barcode",
  "brand",
  "supplier",
  "collection",
  "tags",
  "price",
  "sale_price",
  "cost_price",
  "weight_kg",
  "stock",
  "reorder_level",
  "track_inventory",
  "backorders",
  "location",
  "status",
  "published_at",
  "categories",
  "images",
  "image_alts",
  "seo_title",
  "seo_description",
  "description",
  "variants",
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

export function productToCsvRow(p: AdminProduct): Record<CsvColumn, string> {
  return {
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    brand: p.brand,
    supplier: p.supplier,
    collection: p.collection,
    tags: p.tags.join("|"),
    price: String(p.price),
    sale_price: p.sale_price == null ? "" : String(p.sale_price),
    cost_price: p.cost_price == null ? "" : String(p.cost_price),
    weight_kg: String(p.weight_kg),
    stock: String(p.stock),
    reorder_level: String(p.reorder_level),
    track_inventory: p.track_inventory ? "true" : "false",
    backorders: p.backorders ? "true" : "false",
    location: p.location,
    status: p.status,
    published_at: p.published_at ?? "",
    categories: p.categories.join("|"),
    images: p.images.join("|"),
    image_alts: p.image_alts.join("|"),
    seo_title: p.seo_title,
    seo_description: p.seo_description,
    description: p.description,
    variants: p.variants.length ? JSON.stringify(p.variants) : "",
  };
}

export function toCsv(products: AdminProduct[]): string {
  return Papa.unparse({
    fields: [...CSV_COLUMNS],
    data: products.map(productToCsvRow),
  });
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type FieldMap = Partial<Record<CsvColumn, string>>;

export type ImportPreview = {
  headers: string[];
  rows: Array<Record<string, string>>;
};

export function parseCsv(text: string): ImportPreview {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const rows = (parsed.data ?? []).filter(Boolean);
  const headers = parsed.meta.fields ?? (rows[0] ? Object.keys(rows[0]) : []);
  return { headers, rows };
}

/** Best-effort automatic mapping between CSV headers and product fields. */
export function autoMap(headers: string[]): FieldMap {
  const map: FieldMap = {};
  for (const col of CSV_COLUMNS) {
    const match = headers.find(
      (h) => h.trim().toLowerCase().replace(/\s+/g, "_") === col,
    );
    if (match) map[col] = match;
  }
  return map;
}

const list = (v: string | undefined) =>
  (v ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

const bool = (v: string | undefined, fallback: boolean) => {
  const s = (v ?? "").trim().toLowerCase();
  if (!s) return fallback;
  return s === "true" || s === "1" || s === "yes";
};

const numOrNull = (v: string | undefined) => {
  const s = (v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export type RowResult =
  | { ok: true; index: number; product: AdminProductValues }
  | { ok: false; index: number; error: string };

export function validateRows(
  rows: Array<Record<string, string>>,
  map: FieldMap,
): RowResult[] {
  const get = (row: Record<string, string>, col: CsvColumn) => {
    const header = map[col];
    return header ? row[header] : undefined;
  };
  return rows.map((row, i) => {
    let variants: unknown = [];
    const rawVariants = (get(row, "variants") ?? "").trim();
    if (rawVariants) {
      try {
        const parsed = JSON.parse(rawVariants);
        variants = Array.isArray(parsed) ? parsed : [];
      } catch {
        return { ok: false, index: i, error: "Variants column is not valid JSON" };
      }
    }
    const candidate = {
      slug: (get(row, "slug") ?? "").trim().toLowerCase(),
      name: (get(row, "name") ?? "").trim(),
      sku: (get(row, "sku") ?? "").trim(),
      barcode: (get(row, "barcode") ?? "").trim(),
      brand: (get(row, "brand") ?? "").trim(),
      supplier: (get(row, "supplier") ?? "").trim(),
      collection: (get(row, "collection") ?? "").trim(),
      tags: list(get(row, "tags")),
      price: Number(get(row, "price") ?? 0) || 0,
      sale_price: numOrNull(get(row, "sale_price")),
      cost_price: numOrNull(get(row, "cost_price")),
      weight_kg: Number(get(row, "weight_kg") ?? 0.5) || 0,
      stock: Math.trunc(Number(get(row, "stock") ?? 0) || 0),
      reorder_level: Math.trunc(Number(get(row, "reorder_level") ?? 0) || 0),
      track_inventory: bool(get(row, "track_inventory"), true),
      backorders: bool(get(row, "backorders"), false),
      location: (get(row, "location") ?? "").trim(),
      description: (get(row, "description") ?? "").trim(),
      seo_title: (get(row, "seo_title") ?? "").trim(),
      seo_description: (get(row, "seo_description") ?? "").trim(),
      categories: list(get(row, "categories")),
      images: list(get(row, "images")),
      image_alts: list(get(row, "image_alts")),
      variants,
      status: (get(row, "status") ?? "draft").trim() || "draft",
      published_at: (get(row, "published_at") ?? "").trim() || null,
    };
    const result = adminProductSchema.safeParse(candidate);
    if (!result.success) {
      const issue = result.error.issues[0];
      return {
        ok: false,
        index: i,
        error: `${issue.path.join(".") || "row"}: ${issue.message}`,
      };
    }
    return { ok: true, index: i, product: result.data };
  });
}

export function errorReportCsv(results: RowResult[]): string {
  const bad = results.filter((r): r is Extract<RowResult, { ok: false }> => !r.ok);
  return Papa.unparse({
    fields: ["row", "error"],
    data: bad.map((r) => ({ row: String(r.index + 2), error: r.error })),
  });
}
