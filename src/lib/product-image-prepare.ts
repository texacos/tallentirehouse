// Browser-side product image preparation: strict validation plus responsive
// derivative generation. Everything is re-validated server-side; this keeps
// image processing off the edge runtime and gives admins instant feedback.
import {
  MAX_PRODUCT_IMAGE_BYTES,
  PRODUCT_IMAGE_SIZE,
  PRODUCT_IMAGE_WIDTHS,
} from "./product-images";

export type PreparedAsset = {
  w: number;
  h: number;
  mime: string;
  base64: string;
  bytes: number;
};

export type PreparedProductImage = {
  filename: string;
  fileSize: number;
  master: PreparedAsset;
  derivatives: PreparedAsset[];
};

export class ProductImageError extends Error {}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return "image/png";
  const ascii = (i: number, s: string) =>
    s.split("").every((c, k) => bytes[i + k] === c.charCodeAt(0));
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  return null;
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), mime, quality));
}

async function encode(
  bitmap: ImageBitmap,
  width: number,
  mime: string,
  quality: number,
): Promise<PreparedAsset | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = width; // square
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, width);
  const blob = await canvasToBlob(canvas, mime, quality);
  if (!blob || blob.type !== mime) return null; // unsupported encoder in this browser
  const buf = await blob.arrayBuffer();
  return { w: width, h: width, mime, base64: toBase64(buf), bytes: buf.byteLength };
}

/**
 * Validates a candidate product image (square, at least 1200 × 1200) and
 * produces WebP + JPEG derivatives at 400 / 700 / 1200 px.
 */
export async function prepareProductImage(file: File): Promise<PreparedProductImage> {
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    throw new ProductImageError(
      `${file.name}: file is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 8 MB.`,
    );
  }
  const buf = await file.arrayBuffer();
  const sniffed = sniffMime(new Uint8Array(buf.slice(0, 16)));
  if (!sniffed) {
    throw new ProductImageError(
      `${file.name}: unsupported file. Product images must be JPEG, PNG or WebP.`,
    );
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([buf], { type: sniffed }));
  } catch {
    throw new ProductImageError(`${file.name}: this image could not be decoded.`);
  }

  const { width, height } = bitmap;
  if (width !== height || width < PRODUCT_IMAGE_SIZE) {
    bitmap.close();
    throw new ProductImageError(
      `${file.name}: images must be square and at least ${PRODUCT_IMAGE_SIZE} × ${PRODUCT_IMAGE_SIZE} px (received ${width} × ${height} px).`,
    );
  }

  const derivatives: PreparedAsset[] = [];
  for (const w of PRODUCT_IMAGE_WIDTHS) {
    const webp = await encode(bitmap, w, "image/webp", 0.82);
    if (webp) derivatives.push(webp);
    const jpeg = await encode(bitmap, w, "image/jpeg", 0.82);
    if (jpeg) derivatives.push(jpeg);
  }
  // Re-encoded master: identical pixels, no EXIF/metadata carried over.
  const master = await encode(bitmap, PRODUCT_IMAGE_SIZE, "image/jpeg", 0.92);
  bitmap.close();

  if (!master || derivatives.length === 0) {
    throw new ProductImageError(
      `${file.name}: image processing failed in this browser. Please try again.`,
    );
  }

  return { filename: file.name, fileSize: file.size, master, derivatives };
}
