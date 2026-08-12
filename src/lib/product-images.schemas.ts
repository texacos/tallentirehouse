// Zod schemas for the product image server functions (kept out of the
// serverFn module, whose module scope is stripped during splitting).
import { z } from "zod";

export const productAssetSchema = z.object({
  w: z.number().int().min(1).max(4000),
  h: z.number().int().min(1).max(4000),
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(16).max(20_000_000),
});

export const productImageUploadSchema = z.object({
  filename: z.string().max(255).default(""),
  fileSize: z.number().int().min(1),
  master: productAssetSchema,
  derivatives: z.array(productAssetSchema).min(1).max(12),
});

export const productImageDeleteSchema = z.object({
  id: z.string().uuid(),
});
