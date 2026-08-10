// Browser-side hero image preparation: strict validation + responsive
// derivative generation. Everything here is re-validated server-side; this
// exists for fast feedback and to keep image processing off the edge runtime.
import { HERO_HEIGHT, HERO_WIDTH, HERO_WIDTHS, MAX_UPLOAD_BYTES } from "./hero";

export const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

export type PreparedAsset = {
  w: number;
  h: number;
  mime: string;
  base64: string;
  bytes: number;
};

export type PreparedHeroImage = {
  width: number;
  height: number;
  mime: string;
  fileSize: number;
  filename: string;
  master: PreparedAsset;
  derivatives: PreparedAsset[];
};

export class HeroImageError extends Error {}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Magic-byte sniffing (client-side mirror of the server check). */
export function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return "image/png";
  const ascii = (i: number, s: string) =>
    s.split("").every((c, k) => bytes[i + k] === c.charCodeAt(0));
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  return null;
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), mime, quality),
  );
}

async function encode(
  bitmap: ImageBitmap,
  width: number,
  mime: string,
  quality: number,
): Promise<PreparedAsset | null> {
  const height = Math.round((width * HERO_HEIGHT) / HERO_WIDTH);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await canvasToBlob(canvas, mime, quality);
  if (!blob || blob.type !== mime) return null; // format unsupported by this browser
  const buf = await blob.arrayBuffer();
  return { w: width, h: height, mime, base64: toBase64(buf), bytes: buf.byteLength };
}

/**
 * Validates a candidate hero file and produces WebP + JPEG derivatives at
 * 640/960/1280/1920. Throws `HeroImageError` with an admin-friendly message.
 */
export async function prepareHeroImage(file: File): Promise<PreparedHeroImage> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new HeroImageError(
      `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 8 MB.`,
    );
  }
  const buf = await file.arrayBuffer();
  const sniffed = sniffMime(new Uint8Array(buf.slice(0, 16)));
  if (!sniffed) {
    throw new HeroImageError(
      "Unsupported file. Hero images must be JPEG, PNG or WebP (SVG and other formats are not allowed).",
    );
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([buf], { type: sniffed }));
  } catch {
    throw new HeroImageError("This image could not be decoded — it may be corrupted.");
  }

  if (bitmap.width !== HERO_WIDTH || bitmap.height !== HERO_HEIGHT) {
    const detected = `${bitmap.width} × ${bitmap.height} px`;
    bitmap.close();
    throw new HeroImageError(
      `Invalid image dimensions. Hero images must be exactly ${HERO_WIDTH} × ${HERO_HEIGHT} pixels.\nUploaded image: ${detected}\nRequired: ${HERO_WIDTH} × ${HERO_HEIGHT} px`,
    );
  }

  const derivatives: PreparedAsset[] = [];
  for (const w of HERO_WIDTHS) {
    const webp = await encode(bitmap, w, "image/webp", 0.82);
    if (webp) derivatives.push(webp);
    const jpeg = await encode(bitmap, w, "image/jpeg", 0.82);
    if (jpeg) derivatives.push(jpeg);
  }
  // Re-encoded master: identical pixels, no EXIF/metadata carried over.
  const master = await encode(bitmap, HERO_WIDTH, "image/jpeg", 0.92);
  bitmap.close();

  if (!master || derivatives.length === 0) {
    throw new HeroImageError("Image processing failed in this browser. Please try again.");
  }

  return {
    width: HERO_WIDTH,
    height: HERO_HEIGHT,
    mime: sniffed,
    fileSize: file.size,
    filename: file.name,
    master,
    derivatives,
  };
}
