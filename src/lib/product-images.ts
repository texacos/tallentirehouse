// Shared, browser-safe constants and helpers for product image handling.
//
// Managed images live in the private `product-images` bucket and are served
// through /api/public/product-images/* with immutable caching. The stored URL
// always points at the 1200px JPEG so legacy consumers keep working; the
// responsive variants are derived from the same UUID folder by convention.

export const PRODUCT_IMAGE_BUCKET = "product-images";
export const PRODUCT_IMAGE_SIZE = 1200;
export const PRODUCT_IMAGE_WIDTHS = [400, 700, 1200] as const;
export const MAX_PRODUCT_IMAGE_BYTES = 8 * 1024 * 1024;
export const PRODUCT_IMAGE_PREFIX = "/api/public/product-images/";
export const ACCEPTED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

const MANAGED_RE =
  /^\/api\/public\/product-images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/optimized\/w1200\.jpg$/i;

/** Returns the asset id when a URL is a pipeline-managed product image. */
export function managedImageId(url: string): string | null {
  const m = MANAGED_RE.exec(url ?? "");
  return m ? m[1]!.toLowerCase() : null;
}

export function managedImageUrl(id: string, width: number, ext: "jpg" | "webp"): string {
  return `${PRODUCT_IMAGE_PREFIX}${id}/optimized/w${width}.${ext}`;
}

export function primaryImageUrl(id: string): string {
  return managedImageUrl(id, PRODUCT_IMAGE_SIZE, "jpg");
}

export type ResponsiveSources = {
  webp: string;
  jpeg: string;
  src: string;
} | null;

/** Builds <picture> srcsets for a managed image, or null for legacy URLs. */
export function responsiveSources(url: string): ResponsiveSources {
  const id = managedImageId(url);
  if (!id) return null;
  const set = (ext: "jpg" | "webp") =>
    PRODUCT_IMAGE_WIDTHS.map((w) => `${managedImageUrl(id, w, ext)} ${w}w`).join(", ");
  return { webp: set("webp"), jpeg: set("jpg"), src: primaryImageUrl(id) };
}

/** "linen-cushion_01.JPG" → "Linen cushion 01" (used to prefill alt text). */
export function altFromFilename(filename: string): string {
  return filename
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
    .slice(0, 200);
}
