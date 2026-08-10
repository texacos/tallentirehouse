// Server-only hero helpers: untrusted-input validation and storage plumbing.
// Never imported by client code directly (blocked by the .server filename).
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  HERO_HEIGHT,
  HERO_WIDTH,
  MAX_UPLOAD_BYTES,
  type HeroVariant,
} from "./hero";

type Db = SupabaseClient<any, any, any>;

export const HERO_BUCKET = "hero-slides";
export const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export class HeroError extends Error {}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(id: string): string {
  if (!UUID_RE.test(id)) throw new HeroError("Invalid slide reference.");
  return id.toLowerCase();
}

export function decodeBase64(b64: string): Uint8Array {
  if (typeof b64 !== "string" || b64.length === 0 || b64.length > 24_000_000) {
    throw new HeroError("Upload rejected: malformed payload.");
  }
  let binary: string;
  try {
    binary = atob(b64);
  } catch {
    throw new HeroError("Upload rejected: malformed payload.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function ascii(bytes: Uint8Array, at: number, s: string): boolean {
  return s.split("").every((c, k) => bytes[at + k] === c.charCodeAt(0));
}

/** Parses real format + pixel dimensions from the file signature. */
export function inspectImage(
  bytes: Uint8Array,
): { mime: string; width: number; height: number } | null {
  if (bytes.length < 16) return null;

  // PNG
  if (
    bytes[0] === 0x89 &&
    ascii(bytes, 1, "PNG") &&
    ascii(bytes, 12, "IHDR")
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return {
      mime: "image/png",
      width: view.getUint32(16),
      height: view.getUint32(20),
    };
  }

  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = bytes[i + 1]!;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isSof) {
        return {
          mime: "image/jpeg",
          height: (bytes[i + 5]! << 8) | bytes[i + 6]!,
          width: (bytes[i + 7]! << 8) | bytes[i + 8]!,
        };
      }
      if (len <= 0) return null;
      i += 2 + len;
    }
    return null;
  }

  // WebP
  if (ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) {
    const chunk = String.fromCharCode(...bytes.subarray(12, 16));
    if (chunk === "VP8X" && bytes.length > 30) {
      const w = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
      const h = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
      return { mime: "image/webp", width: w, height: h };
    }
    if (chunk === "VP8 " && bytes.length > 30) {
      if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
      const w = ((bytes[27]! << 8) | bytes[26]!) & 0x3fff;
      const h = ((bytes[29]! << 8) | bytes[28]!) & 0x3fff;
      return { mime: "image/webp", width: w, height: h };
    }
    if (chunk === "VP8L" && bytes.length > 25) {
      if (bytes[20] !== 0x2f) return null;
      const b = bytes;
      const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
      const w = (bits & 0x3fff) + 1;
      const h = ((bits >> 14) & 0x3fff) + 1;
      return { mime: "image/webp", width: w, height: h };
    }
    return null;
  }

  return null;
}

export type IncomingAsset = { w: number; h: number; mime: string; base64: string };

type CheckedAsset = { bytes: Uint8Array; mime: string; w: number; h: number };

/** Validates one uploaded buffer against the expected format and geometry. */
export function checkAsset(asset: IncomingAsset, expectW: number): CheckedAsset {
  const bytes = decodeBase64(asset.base64);
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new HeroError("Upload rejected: file exceeds the 8 MB limit.");
  }
  const info = inspectImage(bytes);
  if (!info || !ALLOWED_MIME.has(info.mime)) {
    throw new HeroError(
      "Upload rejected: only JPEG, PNG and WebP images are accepted.",
    );
  }
  if (info.mime !== asset.mime) {
    throw new HeroError("Upload rejected: declared file type does not match its contents.");
  }
  const expectH = Math.round((expectW * HERO_HEIGHT) / HERO_WIDTH);
  if (info.width !== expectW || info.height !== expectH) {
    throw new HeroError(
      `Upload rejected: image must be exactly ${expectW} × ${expectH} pixels (received ${info.width} × ${info.height}).`,
    );
  }
  return { bytes, mime: info.mime, w: info.width, h: info.height };
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Uploads a master + derivatives under a server-generated UUID folder. */
export async function storeSlideAssets(
  db: Db,
  slideId: string,
  master: IncomingAsset,
  derivatives: IncomingAsset[],
): Promise<{ basePath: string; masterPath: string; variants: HeroVariant[] }> {
  if (derivatives.length === 0 || derivatives.length > 12) {
    throw new HeroError("Upload rejected: unexpected number of image variants.");
  }
  const checkedMaster = checkAsset(master, HERO_WIDTH);
  const checked = derivatives.map((d) => ({ asset: d, file: checkAsset(d, d.w) }));

  const basePath = assertUuid(slideId);
  const masterPath = `${basePath}/original/master.${EXT[checkedMaster.mime]}`;
  const uploaded: string[] = [];

  const put = async (path: string, file: CheckedAsset) => {
    const { error } = await db.storage
      .from(HERO_BUCKET)
      .upload(path, file.bytes, {
        contentType: file.mime,
        cacheControl: "31536000",
        upsert: false,
      });
    if (error) throw new HeroError("Upload failed while saving the image. Please try again.");
    uploaded.push(path);
  };

  try {
    await put(masterPath, checkedMaster);
    const variants: HeroVariant[] = [];
    for (const { file } of checked) {
      const path = `${basePath}/optimized/w${file.w}.${EXT[file.mime]}`;
      await put(path, file);
      variants.push({
        w: file.w,
        h: file.h,
        path,
        mime: file.mime,
        bytes: file.bytes.byteLength,
      });
    }
    return { basePath, masterPath, variants };
  } catch (err) {
    // Roll back partial uploads so storage never keeps orphans.
    if (uploaded.length) {
      await db.storage.from(HERO_BUCKET).remove(uploaded).catch(() => undefined);
    }
    throw err;
  }
}

/** Removes every object stored under a slide folder. */
export async function removeSlideAssets(db: Db, basePath: string): Promise<void> {
  const safe = assertUuid(basePath);
  const paths: string[] = [];
  for (const folder of ["original", "optimized"]) {
    const { data } = await db.storage.from(HERO_BUCKET).list(`${safe}/${folder}`, {
      limit: 100,
    });
    for (const entry of data ?? []) paths.push(`${safe}/${folder}/${entry.name}`);
  }
  if (paths.length) {
    await db.storage.from(HERO_BUCKET).remove(paths);
  }
}
