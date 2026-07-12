ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.products.variants IS
  'Optional size variants. Array of { size: string, sku?: string, price: number }. Empty = simple product.';