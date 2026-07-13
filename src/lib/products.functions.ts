import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Product, ProductVariant } from "./products";

// Public catalog reader. Uses the server publishable key + the anon SELECT
// policy on public.products, so it's safe on every route (including SSR
// prerender) without a signed-in user.
export const fetchAllProducts = createServerFn({ method: "GET" }).handler(
  async (): Promise<Product[]> => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
    const { data, error } = await supabase
      .from("products")
      .select("slug,name,sku,price,description,categories,images,variants,stock,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      slug: row.slug,
      name: row.name,
      sku: row.sku ?? "",
      price: row.price ?? 0,
      description: row.description ?? "",
      categories: (row.categories ?? []) as string[],
      images: (row.images ?? []) as string[],
      variants: (Array.isArray(row.variants) ? row.variants : []) as ProductVariant[],
      stock: row.stock ?? 0,
    }));
  },
);

