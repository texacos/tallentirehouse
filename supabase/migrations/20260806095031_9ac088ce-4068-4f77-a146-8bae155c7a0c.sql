-- 1) Extend products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS sale_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS cost_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS barcode text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS supplier text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS collection text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reorder_level integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS track_inventory boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS backorders boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_alts text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE public.products ADD CONSTRAINT products_status_check
  CHECK (status IN ('draft','published','hidden','archived','scheduled'));

UPDATE public.products SET published_at = created_at WHERE published_at IS NULL;

CREATE INDEX IF NOT EXISTS products_status_idx ON public.products (status);
CREATE INDEX IF NOT EXISTS products_updated_at_idx ON public.products (updated_at DESC);
CREATE INDEX IF NOT EXISTS products_name_idx ON public.products (lower(name));
CREATE INDEX IF NOT EXISTS products_brand_idx ON public.products (lower(brand));
CREATE INDEX IF NOT EXISTS products_categories_idx ON public.products USING gin (categories);
CREATE INDEX IF NOT EXISTS products_tags_idx ON public.products USING gin (tags);

-- Public storefront: only live products
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
CREATE POLICY "Live products are viewable by everyone"
  ON public.products FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    OR (status = 'scheduled' AND published_at IS NOT NULL AND published_at <= now())
  );
CREATE POLICY "Admins can view all products"
  ON public.products FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 2) Revision history
CREATE TABLE IF NOT EXISTS public.product_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  product_slug text NOT NULL,
  snapshot jsonb NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  actor_id uuid,
  actor_label text NOT NULL DEFAULT '',
  action text NOT NULL DEFAULT 'update',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_revisions_product_idx
  ON public.product_revisions (product_id, created_at DESC);
GRANT SELECT, INSERT ON public.product_revisions TO authenticated;
GRANT ALL ON public.product_revisions TO service_role;
ALTER TABLE public.product_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view revisions" ON public.product_revisions
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins write revisions" ON public.product_revisions
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- 3) Audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_label text NOT NULL DEFAULT '',
  action text NOT NULL,
  entity text NOT NULL DEFAULT 'product',
  entity_id text,
  summary text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_entity_idx ON public.admin_audit_log (entity, entity_id);
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit log" ON public.admin_audit_log
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins write audit log" ON public.admin_audit_log
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- 4) Per-admin UI preferences (columns, saved filters, favourites, recents)
CREATE TABLE IF NOT EXISTS public.admin_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  visible_columns text[] NOT NULL DEFAULT '{}',
  saved_filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  favourites text[] NOT NULL DEFAULT '{}',
  recent_products text[] NOT NULL DEFAULT '{}',
  page_size integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.admin_preferences TO authenticated;
GRANT ALL ON public.admin_preferences TO service_role;
ALTER TABLE public.admin_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own admin prefs" ON public.admin_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER admin_preferences_set_updated_at
  BEFORE UPDATE ON public.admin_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();