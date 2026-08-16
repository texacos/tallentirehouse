import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { searchQuerySchema, tokenise, MAX_SEARCH_RESULTS, type SearchInput } from "./search";
import { runProductSearch, type SearchResult } from "./search.server";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;
const buckets = new Map<string, { count: number; resetAt: number }>();

function clientKey(): string {
  const fwd = getRequestHeader("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0]!.trim() : getRequestHeader("cf-connecting-ip") ?? "anon";
  return ip.slice(0, 64);
}

function rateLimited(): boolean {
  const key = clientKey();
  const now = Date.now();
  if (buckets.size > 5000) buckets.clear();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  b.count += 1;
  return b.count > MAX_PER_WINDOW;
}

export type SearchResponse = {
  results: SearchResult[];
  total: number;
  limited?: boolean;
  failed?: boolean;
};

export const searchProducts = createServerFn({ method: "GET" })
  .inputValidator((data: unknown): SearchInput => searchQuerySchema.parse(data))
  .handler(async ({ data }): Promise<SearchResponse> => {
    if (rateLimited()) return { results: [], total: 0, limited: true };
    const tokens = tokenise(data.q);
    if (tokens.length === 0) return { results: [], total: 0 };
    try {
      const all = await runProductSearch(data.q, tokens);
      const limit = Math.min(data.limit ?? MAX_SEARCH_RESULTS, MAX_SEARCH_RESULTS);
      return { results: all.slice(0, limit), total: all.length };
    } catch (e) {
      console.error("[search] failed", e);
      return { results: [], total: 0, failed: true };
    }
  });
