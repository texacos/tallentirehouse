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
      .select(
        "slug,name,sku,price,weight_kg,description,care_instructions,dimensions,categories,images,variants,stock,created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: Record<string, unknown>) => ({
      slug: row.slug as string,
      name: row.name as string,
      sku: (row.sku as string | null) ?? "",
      price: Number(row.price ?? 0),
      weight_kg: Number(row.weight_kg ?? 0.5),
      description: (row.description as string | null) ?? "",
      categories: ((row.categories as string[] | null) ?? []) as string[],
      images: ((row.images as string[] | null) ?? []) as string[],
      variants: (Array.isArray(row.variants) ? row.variants : []) as ProductVariant[],
      stock: Number(row.stock ?? 0),
    }));
  },
);
