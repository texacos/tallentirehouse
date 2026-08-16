// Server-only search implementation. Uses the publishable key + the public
// anon SELECT policy on public.products, so only customer-visible rows are ever
// reachable, and only public columns are selected.
import { createClient } from "@supabase/supabase-js";
import { CATEGORIES, CATEGORY_GROUPS, isOutOfStock, type Product, type ProductVariant } from "./products";

export type SearchResult = Product;

const PUBLIC_COLUMNS =
  "slug,name,sku,price,weight_kg,colour,description,care_instructions,dimensions,how_we_make_it,categories,images,variants,stock,created_at";

const CANDIDATE_LIMIT = 300;

/** Strip everything that isn't a letter/number/space/hyphen — makes the pattern
 * safe for PostgREST filter syntax and removes ilike wildcards + ReDoS input. */
function safeTerm(t: string): string {
  return t.replace(/[^\p{L}\p{N}\s-]/gu, "").trim().slice(0, 40);
}

function client() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

function mapRow(row: Record<string, unknown>): Product {
  return {
    slug: row.slug as string,
    name: row.name as string,
    sku: (row.sku as string | null) ?? "",
    price: Number(row.price ?? 0),
    weight_kg: Number(row.weight_kg ?? 0.5),
    colour: (row.colour as string | null) ?? "",
    description: (row.description as string | null) ?? "",
    care_instructions: (row.care_instructions as string | null) ?? "",
    dimensions: (row.dimensions as string | null) ?? "",
    how_we_make_it: (row.how_we_make_it as string | null) ?? "",
    categories: ((row.categories as string[] | null) ?? []) as string[],
    images: ((row.images as string[] | null) ?? []) as string[],
    variants: (Array.isArray(row.variants) ? row.variants : []) as ProductVariant[],
    stock: Number(row.stock ?? 0),
  };
}

/** Category slugs whose label contains one of the tokens. */
function matchingCategorySlugs(tokens: string[]): string[] {
  const slugs = new Set<string>();
  for (const t of tokens) {
    for (const c of CATEGORIES) {
      if (c.label.toLowerCase().includes(t) || c.slug.includes(t)) slugs.add(c.slug);
    }
    for (const g of CATEGORY_GROUPS) {
      if (g.label.toLowerCase().includes(t)) g.children.forEach((s) => slugs.add(s));
    }
  }
  return [...slugs].slice(0, 40);
}

function score(p: Product, query: string, tokens: string[]): number {
  const name = p.name.toLowerCase();
  const q = query.toLowerCase();
  let s = 0;
  if (name === q) s += 1000;
  else if (name.startsWith(q)) s += 600;
  else if (name.includes(q)) s += 400;

  for (const t of tokens) {
    if (name.includes(t)) s += 80;
    if ((p.sku ?? "").toLowerCase().includes(t)) s += 70;
    if ((p.colour ?? "").toLowerCase().includes(t)) s += 50;
    if (p.categories.some((c) => c.includes(t))) s += 40;
    if (p.variants.some((v) => (v.size ?? "").toLowerCase().includes(t))) s += 20;
    if ((p.dimensions ?? "").toLowerCase().includes(t)) s += 10;
    if ((p.description ?? "").toLowerCase().includes(t)) s += 8;
    if ((p.care_instructions ?? "").toLowerCase().includes(t)) s += 4;
    if ((p.how_we_make_it ?? "").toLowerCase().includes(t)) s += 4;
  }
  if (isOutOfStock(p)) s -= 25;
  return s;
}

export async function runProductSearch(query: string, tokens: string[]): Promise<SearchResult[]> {
  const supabase = client();
  const safeTokens = tokens.map(safeTerm).filter(Boolean);
  if (safeTokens.length === 0) return [];

  const fields = ["name", "sku", "colour", "description", "dimensions", "care_instructions"];
  const filters: string[] = [];
  for (const t of safeTokens) {
    for (const f of fields) filters.push(`${f}.ilike.*${t}*`);
  }
  const catSlugs = matchingCategorySlugs(safeTokens);
  if (catSlugs.length > 0) filters.push(`categories.ov.{${catSlugs.join(",")}}`);

  const [{ data, error }, settings] = await Promise.all([
    supabase.from("products").select(PUBLIC_COLUMNS).or(filters.join(",")).limit(CANDIDATE_LIMIT),
    supabase.from("site_settings").select("key,value").eq("key", "hide_out_of_stock").maybeSingle(),
  ]);
  if (error) throw new Error(error.message);

  const hideOutOfStock = Boolean(settings.data?.value ?? false);
  let products = (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  if (hideOutOfStock) products = products.filter((p) => !isOutOfStock(p));

  return products
    .map((p) => ({ p, s: score(p, query, safeTokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
    .map((x) => x.p);
}
