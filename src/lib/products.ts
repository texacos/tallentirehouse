// Product types + category metadata.
// The product data itself lives in the database (public.products);
// use the hooks in `products-store.ts` to read it.

export type ProductVariant = {
  size: string; // e.g. "S", "M", "L", or any custom label
  sku?: string;
  price: number; // USD
  stock?: number; // units on hand for this size
};

export type Product = {
  slug: string;
  name: string;
  sku: string;
  price: number; // USD — base price (used when variants is empty)
  weight_kg: number; // shipping weight in kg
  description: string;
  colour: string;
  care_instructions: string;
  dimensions: string;
  how_we_make_it: string;
  categories: string[];
  images: string[];
  variants: ProductVariant[]; // empty = simple product
  stock: number; // units on hand for simple products (ignored when variants is set)
};

/** Standard size options presented in the admin UI. */
export const SIZE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "S", label: "Small" },
  { value: "M", label: "Medium" },
  { value: "L", label: "Large" },
];

export const isVariable = (p: Pick<Product, "variants">): boolean =>
  Array.isArray(p.variants) && p.variants.length > 0;

/** Lowest price across variants (falls back to base price). */
export const displayPrice = (p: Product): number => {
  if (!isVariable(p)) return p.price;
  return p.variants.reduce((min, v) => (v.price < min ? v.price : min), p.variants[0].price);
};

/** Total stock — sum of variants for variable products, else base stock. */
export const totalStock = (p: Product): number => {
  if (isVariable(p)) return p.variants.reduce((n, v) => n + (v.stock ?? 0), 0);
  return p.stock ?? 0;
};

/** True when the whole product is out of stock (no variant/simple stock left). */
export const isOutOfStock = (p: Product): boolean => totalStock(p) <= 0;


export type CategoryInfo = { slug: string; label: string; count: number };

export type CategoryGroup = {
  slug: string;
  label: string;
  children: string[]; // leaf category slugs
};

// Parent groupings of the leaf categories. Parent slugs are namespaced
// with the `group-` prefix to avoid colliding with any leaf slug.
export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    slug: "group-clothing",
    label: "Clothing",
    children: ["women", "men", "shawls-scarves", "bespoke"],
  },
  {
    slug: "group-home",
    label: "Home",
    children: [
      "fabric-by-the-metre",
      "cushions",
      "quilts-throws-bedspreads",
      "lighting",
      "ceramics-tableware",
    ],
  },
  {
    slug: "group-bags-travel",
    label: "Bags & Travel",
    children: ["bags", "purses-small-accessories"],
  },
  {
    slug: "group-one-of-a-kind",
    label: "One of a Kind",
    children: ["vintage-pieces", "contemporary-pieces"],
  },
];

// Static labels. Counts here are informational only —
// live counts come from the actual product data.
export const CATEGORIES: CategoryInfo[] = [
  { slug: "women", label: "Women", count: 0 },
  { slug: "men", label: "Men", count: 0 },
  { slug: "shawls-scarves", label: "Shawls & Scarves", count: 0 },
  { slug: "bespoke", label: "Bespoke", count: 0 },
  { slug: "fabric-by-the-metre", label: "Fabric by the Metre", count: 0 },
  { slug: "cushions", label: "Cushions", count: 0 },
  { slug: "quilts-throws-bedspreads", label: "Quilts, Throws & Bedspreads", count: 0 },
  { slug: "lighting", label: "Lighting", count: 0 },
  { slug: "ceramics-tableware", label: "Ceramics & Tableware", count: 0 },
  { slug: "bags", label: "Bags", count: 0 },
  { slug: "purses-small-accessories", label: "Purses & Small Accessories", count: 0 },
  { slug: "vintage-pieces", label: "Vintage Pieces", count: 0 },
  { slug: "contemporary-pieces", label: "Contemporary Pieces", count: 0 },
];


export const getCategory = (slug: string): CategoryInfo | undefined =>
  CATEGORIES.find((c) => c.slug === slug);

const GROUP_INDEX: Record<string, CategoryGroup> = Object.fromEntries(
  CATEGORY_GROUPS.map((g) => [g.slug, g]),
);
export const getCategoryGroup = (slug: string): CategoryGroup | undefined =>
  GROUP_INDEX[slug];

// Resolve a filter slug (leaf category OR parent group) to the leaf slugs
// that should match. Returns null when the slug is unknown.
export const resolveCategoryFilter = (slug: string | undefined): string[] | null => {
  if (!slug) return null;
  const group = GROUP_INDEX[slug];
  if (group) return group.children;
  if (getCategory(slug)) return [slug];
  return null;
};

// Label resolver that handles both leaves and groups.
export const getCategoryLabel = (slug: string): string =>
  getCategoryGroup(slug)?.label ?? getCategory(slug)?.label ?? slug;

/** Prices are stored and displayed in USD, rounded to the nearest 0.5. */
export const formatPrice = (n: number): string =>
  `USD ${n.toLocaleString("en-US", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
