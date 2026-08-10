// Zod schemas for Hero Slider server functions (kept out of the serverFn module,
// whose module scope is stripped during server-function splitting).
import { z } from "zod";
import { MIN_DURATION, MAX_DURATION } from "./hero";

export const assetSchema = z.object({
  w: z.number().int().min(1).max(4000),
  h: z.number().int().min(1).max(4000),
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(16).max(20_000_000),
});

export const createSchema = z.object({
  replaceSlideId: z.string().uuid().optional(),
  altText: z.string().max(200).default(""),
  title: z.string().max(120).default(""),
  filename: z.string().max(255).default(""),
  fileSize: z.number().int().min(1),
  master: assetSchema,
  derivatives: z.array(assetSchema).min(1).max(12),
});

export const updateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(120).optional(),
  altText: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
  duration: z.number().int().min(MIN_DURATION).max(MAX_DURATION).nullable().optional(),
  transition: z.enum(["dissolve", "slide", "zoom"]).nullable().optional(),
});

export const settingsSchema = z.object({
  enabled: z.boolean(),
  transition: z.enum(["dissolve", "slide", "zoom"]),
  duration: z.number().int().min(MIN_DURATION).max(MAX_DURATION),
});

