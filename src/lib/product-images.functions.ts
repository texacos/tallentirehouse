// Admin-only server functions for product image uploads.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { productImageDeleteSchema, productImageUploadSchema } from "./product-images.schemas";
import { primaryImageUrl } from "./product-images";
import { assertAdmin } from "./admin-products.server";
import { removeProductImage, storeProductImage } from "./product-images.server";

export const adminProductImageUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => productImageUploadSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string; url: string }> => {
    const db = context.supabase as never;
    await assertAdmin(db, context.userId);
    const id = crypto.randomUUID();
    await storeProductImage(db, id, data.master, data.derivatives);
    return { id, url: primaryImageUrl(id) };
  });

export const adminProductImageDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => productImageDeleteSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = context.supabase as never;
    await assertAdmin(db, context.userId);
    await removeProductImage(db, data.id);
    return { ok: true };
  });
