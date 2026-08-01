
CREATE TYPE public.shipping_service_status AS ENUM ('rated', 'no_rate', 'no_service');
CREATE TYPE public.shipping_surcharge_kind AS ENUM ('fuel', 'remote_area', 'peak_season', 'custom');
CREATE TYPE public.shipping_surcharge_calc AS ENUM ('percent', 'fixed');

-- 1. CARRIERS ---------------------------------------------------------------
CREATE TABLE public.shipping_carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  origin_country text NOT NULL DEFAULT 'Sri Lanka',
  currency text NOT NULL DEFAULT 'USD',
  max_weight_kg numeric(10,3) NOT NULL DEFAULT 6.0,
  weight_interval_kg numeric(10,3) NOT NULL DEFAULT 0.5,
  round_weight boolean NOT NULL DEFAULT true,
  free_shipping_threshold numeric(12,2),
  sort_order integer NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shipping_carriers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shipping_carriers TO authenticated;
GRANT ALL ON public.shipping_carriers TO service_role;
ALTER TABLE public.shipping_carriers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Carriers readable by everyone" ON public.shipping_carriers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage carriers" ON public.shipping_carriers FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- 2. RATE GROUPS ------------------------------------------------------------
CREATE TABLE public.shipping_rate_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id uuid NOT NULL REFERENCES public.shipping_carriers(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (carrier_id, code)
);
CREATE INDEX shipping_rate_groups_carrier_idx ON public.shipping_rate_groups (carrier_id);
GRANT SELECT ON public.shipping_rate_groups TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shipping_rate_groups TO authenticated;
GRANT ALL ON public.shipping_rate_groups TO service_role;
ALTER TABLE public.shipping_rate_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rate groups readable by everyone" ON public.shipping_rate_groups FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage rate groups" ON public.shipping_rate_groups FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- 3. RATE TIERS -------------------------------------------------------------
CREATE TABLE public.shipping_rate_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_group_id uuid NOT NULL REFERENCES public.shipping_rate_groups(id) ON DELETE CASCADE,
  max_weight_kg numeric(10,3) NOT NULL,
  price numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rate_group_id, max_weight_kg),
  CONSTRAINT shipping_rate_tiers_weight_positive CHECK (max_weight_kg > 0),
  CONSTRAINT shipping_rate_tiers_price_nonneg CHECK (price >= 0)
);
CREATE INDEX shipping_rate_tiers_lookup_idx ON public.shipping_rate_tiers (rate_group_id, max_weight_kg);
GRANT SELECT ON public.shipping_rate_tiers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shipping_rate_tiers TO authenticated;
GRANT ALL ON public.shipping_rate_tiers TO service_role;
ALTER TABLE public.shipping_rate_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rate tiers readable by everyone" ON public.shipping_rate_tiers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage rate tiers" ON public.shipping_rate_tiers FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- 4. COUNTRY RULES ----------------------------------------------------------
CREATE TABLE public.shipping_country_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id uuid NOT NULL REFERENCES public.shipping_carriers(id) ON DELETE CASCADE,
  country text NOT NULL,
  country_code text,
  status public.shipping_service_status NOT NULL DEFAULT 'rated',
  rate_group_id uuid REFERENCES public.shipping_rate_groups(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (carrier_id, country),
  CONSTRAINT shipping_country_rules_rated_needs_group
    CHECK (status <> 'rated' OR rate_group_id IS NOT NULL)
);
CREATE INDEX shipping_country_rules_lookup_idx ON public.shipping_country_rules (carrier_id, lower(country));
CREATE INDEX shipping_country_rules_group_idx ON public.shipping_country_rules (rate_group_id);
GRANT SELECT ON public.shipping_country_rules TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shipping_country_rules TO authenticated;
GRANT ALL ON public.shipping_country_rules TO service_role;
ALTER TABLE public.shipping_country_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Country rules readable by everyone" ON public.shipping_country_rules FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage country rules" ON public.shipping_country_rules FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- 5. SURCHARGES (future-ready) ----------------------------------------------
CREATE TABLE public.shipping_surcharges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id uuid NOT NULL REFERENCES public.shipping_carriers(id) ON DELETE CASCADE,
  kind public.shipping_surcharge_kind NOT NULL DEFAULT 'custom',
  label text NOT NULL,
  calc public.shipping_surcharge_calc NOT NULL DEFAULT 'percent',
  amount numeric(12,4) NOT NULL DEFAULT 0,
  country text,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shipping_surcharges_carrier_idx ON public.shipping_surcharges (carrier_id, is_active);
GRANT SELECT ON public.shipping_surcharges TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shipping_surcharges TO authenticated;
GRANT ALL ON public.shipping_surcharges TO service_role;
ALTER TABLE public.shipping_surcharges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Surcharges readable by everyone" ON public.shipping_surcharges FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage surcharges" ON public.shipping_surcharges FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- 6. CUSTOMER MESSAGES ------------------------------------------------------
CREATE TABLE public.shipping_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id uuid REFERENCES public.shipping_carriers(id) ON DELETE CASCADE,
  status public.shipping_service_status NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  body_html text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (carrier_id, status, locale)
);
GRANT SELECT ON public.shipping_messages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shipping_messages TO authenticated;
GRANT ALL ON public.shipping_messages TO service_role;
ALTER TABLE public.shipping_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shipping messages readable by everyone" ON public.shipping_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage shipping messages" ON public.shipping_messages FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- 7. IMPORT HISTORY ---------------------------------------------------------
CREATE TABLE public.shipping_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id uuid REFERENCES public.shipping_carriers(id) ON DELETE SET NULL,
  user_id uuid,
  user_label text,
  kind text NOT NULL,
  file_name text,
  rows_total integer NOT NULL DEFAULT 0,
  rows_created integer NOT NULL DEFAULT 0,
  rows_updated integer NOT NULL DEFAULT 0,
  rows_skipped integer NOT NULL DEFAULT 0,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  rolled_back_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shipping_import_batches_created_idx ON public.shipping_import_batches (created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.shipping_import_batches TO authenticated;
GRANT ALL ON public.shipping_import_batches TO service_role;
ALTER TABLE public.shipping_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view import batches" ON public.shipping_import_batches FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write import batches" ON public.shipping_import_batches FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update import batches" ON public.shipping_import_batches FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- updated_at triggers --------------------------------------------------------
CREATE TRIGGER set_shipping_carriers_updated_at BEFORE UPDATE ON public.shipping_carriers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_shipping_rate_groups_updated_at BEFORE UPDATE ON public.shipping_rate_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_shipping_rate_tiers_updated_at BEFORE UPDATE ON public.shipping_rate_tiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_shipping_country_rules_updated_at BEFORE UPDATE ON public.shipping_country_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_shipping_surcharges_updated_at BEFORE UPDATE ON public.shipping_surcharges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_shipping_messages_updated_at BEFORE UPDATE ON public.shipping_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed the first carrier and its customer messages ---------------------------
INSERT INTO public.shipping_carriers (code, name, is_default, sort_order)
VALUES ('aramex', 'Aramex', true, 1);

INSERT INTO public.shipping_messages (carrier_id, status, locale, body_html)
SELECT id, 'no_rate', 'en',
  '<p>We are unable to quote an online shipping rate to this destination. Please contact us and we will arrange a quote for you.</p>'
FROM public.shipping_carriers WHERE code = 'aramex';

INSERT INTO public.shipping_messages (carrier_id, status, locale, body_html)
SELECT id, 'no_service', 'en',
  '<p>Unfortunately we cannot ship to this destination at the moment.</p>'
FROM public.shipping_carriers WHERE code = 'aramex';
