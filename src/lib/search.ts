// Shared (client + server) search helpers. No secrets, no DB access here.
import { z } from "zod";

export const MAX_QUERY_LENGTH = 80;
export const SEARCH_PAGE_SIZE = 24;
export const MAX_SEARCH_RESULTS = 96;

/** Collapse whitespace, trim, hard-cap length. Never returns HTML-ish payloads. */
export function normaliseQuery(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

export const searchQuerySchema = z.object({
  q: z
    .string()
    .max(500)
    .transform(normaliseQuery)
    .refine((v) => v.length > 0, { message: "Empty search" }),
  limit: z.number().int().min(1).max(MAX_SEARCH_RESULTS).optional(),
});

export type SearchInput = z.infer<typeof searchQuerySchema>;

/** Split into up to 5 tokens for token-wise matching. */
export function tokenise(q: string): string[] {
  return normaliseQuery(q)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1)
    .slice(0, 5);
}
