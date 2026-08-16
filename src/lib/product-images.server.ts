// Server-only product image plumbing: re-validates every uploaded buffer and
// writes it to the private `product-images` bucket under a UUID folder.
import type { SupabaseClient } from "@supabase/supabase-js";
import { decodeBase64, inspectImage } from "./hero.server";
import {
  managedImageId,
  MAX_PRODUCT_IMAGE_BYTES,
  PRODUCT_IMAGE_BUCKET,
  PRODUCT_IMAGE_SIZE,
  PRODUCT_IMAGE_WIDTHS,
} from "./product-images";

type Db = SupabaseClient<any, any, any>;

export class ProductImageError extends Error {}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function assertImageId(id: string): string {
  if (!UUID_RE.test(id)) throw new ProductImageError("Invalid image reference.");
  return id.toLowerCase();
}

export type IncomingAsset = { w: number; h: number; mime: string; base64: string };
type CheckedAsset = { bytes: Uint8Array; mime: string; w: number; h: number };

/** Validates one buffer: real format, declared type, square geometry. */
function checkAsset(asset: IncomingAsset, expect: number): CheckedAsset {
  const bytes = decodeBase64(asset.base64);
  if (bytes.byteLength > MAX_PRODUCT_IMAGE_BYTES) {
    throw new ProductImageError("Upload rejected: file exceeds the 8 MB limit.");
  }
  const info = inspectImage(bytes);
  if (!info || !ALLOWED.has(info.mime)) {
    throw new ProductImageError("Upload rejected: only JPEG, PNG and WebP images are accepted.");
  }
  if (info.mime !== asset.mime) {
    throw new ProductImageError("Upload rejected: declared file type does not match its contents.");
  }
  if (info.width !== expect || info.height !== expect) {
    throw new ProductImageError(
      `Upload rejected: image must be exactly ${expect} × ${expect} pixels (received ${info.width} × ${info.height}).`,
    );
  }
  return { bytes, mime: info.mime, w: info.width, h: info.height };
}

/** Uploads master + derivatives; rolls back partial writes on failure. */
export async function storeProductImage(
  db: Db,
  imageId: string,
  master: IncomingAsset,
  derivatives: IncomingAsset[],
): Promise<{ basePath: string }> {
  if (derivatives.length === 0 || derivatives.length > 12) {
    throw new ProductImageError("Upload rejected: unexpected number of image variants.");
  }
  const checkedMaster = checkAsset(master, PRODUCT_IMAGE_SIZE);
  const checked = derivatives.map((d) => {
    if (!(PRODUCT_IMAGE_WIDTHS as readonly number[]).includes(d.w)) {
      throw new ProductImageError("Upload rejected: unexpected image size.");
    }
    return checkAsset(d, d.w);
  });

  const basePath = assertImageId(imageId);
  const uploaded: string[] = [];

  const put = async (path: string, file: CheckedAsset) => {
    const { error } = await db.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, file.bytes, {
      contentType: file.mime,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      throw new ProductImageError("Upload failed while saving the image. Please try again.");
    }
    uploaded.push(path);
  };

  try {
    await put(`${basePath}/original/master.${EXT[checkedMaster.mime]}`, checkedMaster);
    for (const file of checked) {
      await put(`${basePath}/optimized/w${file.w}.${EXT[file.mime]}`, file);
    }
    return { basePath };
  } catch (err) {
    if (uploaded.length) {
      await db.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .remove(uploaded)
        .catch(() => undefined);
    }
    throw err;
  }
}

/** Removes every object stored under one image folder. */
export async function removeProductImage(db: Db, imageId: string): Promise<void> {
  const safe = assertImageId(imageId);
  const paths: string[] = [];
  for (const folder of ["original", "optimized"]) {
    const { data } = await db.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .list(`${safe}/${folder}`, { limit: 100 });
    for (const entry of data ?? []) paths.push(`${safe}/${folder}/${entry.name}`);
  }
  if (paths.length) await db.storage.from(PRODUCT_IMAGE_BUCKET).remove(paths);
}

/**
 * Deletes every managed image folder referenced by `urls`, skipping ids that
 * are still referenced by another product (`keepUrls`). Legacy/static URLs are
 * ignored. Never throws — image cleanup must not fail a product deletion.
 */
export async function purgeManagedImages(
  db: Db,
  urls: string[],
  keepUrls: string[] = [],
): Promise<string[]> {
  const keep = new Set(
    keepUrls.map((u) => managedImageId(u)).filter((id): id is string => Boolean(id)),
  );
  const targets = new Set(
    urls.map((u) => managedImageId(u)).filter((id): id is string => Boolean(id) && !keep.has(id!)),
  );
  const removed: string[] = [];
  for (const id of targets) {
    try {
      await removeProductImage(db, id);
      removed.push(id);
    } catch {
      // ignore: orphaned objects are cleaned up separately
    }
  }
  return removed;
}
