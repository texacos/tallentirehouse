
-- Products table (unified store for the catalog + admin-created pieces)
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  sku text NOT NULL DEFAULT '',
  price integer NOT NULL DEFAULT 0,        -- LKR, whole rupees
  description text NOT NULL DEFAULT '',
  categories text[] NOT NULL DEFAULT '{}',
  images text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX products_categories_gin ON public.products USING GIN (categories);
CREATE INDEX products_created_at_idx ON public.products (created_at DESC);

GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Anyone can read the catalog
CREATE POLICY "Products are viewable by everyone"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only admins can write
CREATE POLICY "Admins can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage: admins can upload/update/delete images in the product-images bucket.
-- Public reads are served by an internal server route (streams via service role),
-- so no anon SELECT policy is needed on storage.objects for this bucket.
CREATE POLICY "Admins upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins read product images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::app_role));
