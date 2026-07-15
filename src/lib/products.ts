// Product types + category metadata.
// The product data itself lives in the database (public.products);
// use the hooks in `products-store.ts` to read it.

export type ProductVariant = {
  size: string; // e.g. "S", "M", "L", or any custom label
  sku?: string;
  price: number; // LKR
  stock?: number; // units on hand for this size
};

export type Product = {
  slug: string;
  name: string;
  sku: string;
  price: number; // LKR — base price (used when variants is empty)
  description: string;
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
    slug: "group-fabrics",
    label: "Fabrics",
    children: ["cotton-canvas", "cotton-twill", "cotton-voile", "cotton-flax"],
  },
  {
    slug: "group-cushions",
    label: "Cushions & Bolsters",
    children: ["cotton-cushions", "silk-cushions", "bolsters", "cushions-bolsters"],
  },
  {
    slug: "group-bags",
    label: "Bags & Purses",
    children: ["cosmetics-purses", "travel-purses", "shopping-bags", "weekend-travel-bags"],
  },
  {
    slug: "group-loungewear",
    label: "Loungewear & Sleepwear",
    children: [
      "dressing-gowns",
      "pyjama-tops",
      "pyjama-trousers",
      "camisole-tops",
      "camisole-shorts",
      "children-pyjamas",
      "sarongs",
      "loungewear",
    ],
  },
  {
    slug: "group-tops-dresses",
    label: "Tops & Dresses",
    children: [
      "sleeveless-tops-dresses",
      "long-sleeved-dresses",
      "smock-tops",
      "men-s-shirts",
      "jackets",
    ],
  },
  {
    slug: "group-stoles",
    label: "Stoles & Shawls",
    children: ["tabby-silk-stoles", "gajji-silk-stoles", "halcyon-shawls-bedthrows"],
  },
  {
    slug: "group-tableware",
    label: "Tableware",
    children: ["napkins", "placemats", "aprons"],
  },
  {
    slug: "group-ceramics",
    label: "Ceramics",
    children: ["cups", "bowls", "plates"],
  },
];

// Static labels + last-known counts. Counts here are informational only —
// live counts come from the actual product data.
export const CATEGORIES: CategoryInfo[] = [
  { slug: "cosmetics-purses", label: "Cosmetics Purses", count: 91 },
  { slug: "cotton-cushions", label: "Cotton Cushions", count: 83 },
  { slug: "silk-cushions", label: "Silk Cushions", count: 80 },
  { slug: "cotton-canvas", label: "Cotton Canvas", count: 62 },
  { slug: "travel-purses", label: "Travel Purses", count: 34 },
  { slug: "cushions-bolsters", label: "Cushions & Bolsters", count: 24 },
  { slug: "napkins", label: "Napkins", count: 24 },
  { slug: "sleeveless-tops-dresses", label: "Sleeveless Tops & Dresses", count: 21 },
  { slug: "bolsters", label: "Bolsters", count: 18 },
  { slug: "placemats", label: "Placemats", count: 18 },
  { slug: "shopping-bags", label: "Shopping Bags", count: 18 },
  { slug: "cotton-twill", label: "Cotton Twill", count: 17 },
  { slug: "cotton-voile", label: "Cotton Voile", count: 17 },
  { slug: "camisole-tops", label: "Camisole Tops", count: 14 },
  { slug: "children-pyjamas", label: "Children Pyjamas", count: 14 },
  { slug: "camisole-shorts", label: "Camisole Shorts", count: 13 },
  { slug: "pyjama-trousers", label: "Pyjama Trousers", count: 13 },
  { slug: "pyjama-tops", label: "Pyjama Tops", count: 12 },
  { slug: "tabby-silk-stoles", label: "Tabby Silk Stoles", count: 12 },
  { slug: "cups", label: "Cups", count: 11 },
  { slug: "dressing-gowns", label: "Dressing Gowns", count: 11 },
  { slug: "bowls", label: "Bowls", count: 9 },
  { slug: "cotton-flax", label: "Cotton Flax", count: 9 },
  { slug: "gajji-silk-stoles", label: "Gajji Silk Stoles", count: 9 },
  { slug: "men-s-shirts", label: "Men's Shirts", count: 8 },
  { slug: "halcyon-shawls-bedthrows", label: "Halcyon Shawls & Bedthrows", count: 7 },
  { slug: "long-sleeved-dresses", label: "Long Sleeved Dresses", count: 6 },
  { slug: "sarongs", label: "Sarongs", count: 5 },
  { slug: "weekend-travel-bags", label: "Weekend Travel Bags", count: 5 },
  { slug: "aprons", label: "Aprons", count: 4 },
  { slug: "plates", label: "Plates", count: 3 },
  { slug: "loungewear", label: "Loungewear", count: 2 },
  { slug: "smock-tops", label: "Smock Tops", count: 2 },
  { slug: "jackets", label: "Jackets", count: 1 },
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

export const formatPrice = (n: number): string =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(n);

export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
