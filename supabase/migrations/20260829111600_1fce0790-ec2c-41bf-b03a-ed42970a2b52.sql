-- 1. Cities -----------------------------------------------------------------
CREATE TABLE public.aramex_domestic_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  city_key text NOT NULL UNIQUE,
  locality text NOT NULL,
  district text NOT NULL,
  rate_group text NOT NULL CHECK (rate_group IN ('RATE_GROUP_1','RATE_GROUP_2','RATE_GROUP_3','RATE_GROUP_4','NO_RATE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.aramex_domestic_cities TO anon, authenticated;
GRANT ALL ON public.aramex_domestic_cities TO service_role;
ALTER TABLE public.aramex_domestic_cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cities are publicly readable" ON public.aramex_domestic_cities FOR SELECT USING (true);
CREATE POLICY "Admins manage cities" ON public.aramex_domestic_cities FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE INDEX aramex_cities_locality_idx ON public.aramex_domestic_cities (lower(locality));
CREATE INDEX aramex_cities_district_idx ON public.aramex_domestic_cities (lower(district));
CREATE TRIGGER aramex_domestic_cities_set_updated_at BEFORE UPDATE ON public.aramex_domestic_cities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Rate versions -----------------------------------------------------------
CREATE TABLE public.aramex_domestic_rate_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','active','superseded')),
  weight_limits numeric(8,3)[] NOT NULL,
  source_filename text NOT NULL DEFAULT '',
  exchange_rate_id uuid REFERENCES public.currency_rates(id),
  exchange_rate numeric(18,6),
  exchange_rate_date date,
  exchange_rate_fetched_at timestamptz,
  rounding_mode text CHECK (rounding_mode IN ('increment','decimals')),
  rounding_setting numeric(10,2),
  calculated_at timestamptz,
  initiated_by text NOT NULL DEFAULT 'manual' CHECK (initiated_by IN ('manual','scheduled','import')),
  actor_id uuid,
  actor_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.aramex_domestic_rate_versions TO anon, authenticated;
GRANT ALL ON public.aramex_domestic_rate_versions TO service_role;
ALTER TABLE public.aramex_domestic_rate_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active rate version is publicly readable" ON public.aramex_domestic_rate_versions
  FOR SELECT USING (status = 'active');
CREATE POLICY "Admins read all rate versions" ON public.aramex_domestic_rate_versions
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));
CREATE UNIQUE INDEX aramex_rate_versions_one_active ON public.aramex_domestic_rate_versions (status)
  WHERE status = 'active';
CREATE TRIGGER aramex_domestic_rate_versions_set_updated_at BEFORE UPDATE ON public.aramex_domestic_rate_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Rates -------------------------------------------------------------------
CREATE TABLE public.aramex_domestic_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.aramex_domestic_rate_versions(id) ON DELETE CASCADE,
  rate_group text NOT NULL CHECK (rate_group IN ('RATE_GROUP_1','RATE_GROUP_2','RATE_GROUP_3','RATE_GROUP_4')),
  weight_limit_kg numeric(8,3) NOT NULL CHECK (weight_limit_kg > 0),
  lkr_rate numeric(14,4) NOT NULL CHECK (lkr_rate > 0),
  unrounded_usd numeric(18,8),
  usd_rate numeric(12,4) CHECK (usd_rate IS NULL OR usd_rate > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, rate_group, weight_limit_kg)
);
GRANT SELECT ON public.aramex_domestic_rates TO anon, authenticated;
GRANT ALL ON public.aramex_domestic_rates TO service_role;
ALTER TABLE public.aramex_domestic_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Live rates are publicly readable" ON public.aramex_domestic_rates FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.aramex_domestic_rate_versions v WHERE v.id = version_id AND v.status = 'active')
);
CREATE POLICY "Admins read all rates" ON public.aramex_domestic_rates FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
CREATE INDEX aramex_rates_version_idx ON public.aramex_domestic_rates (version_id, rate_group, weight_limit_kg);

-- 4. Settings ----------------------------------------------------------------
CREATE TABLE public.aramex_domestic_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  rounding_mode text NOT NULL DEFAULT 'increment' CHECK (rounding_mode IN ('increment','decimals')),
  rounding_increment integer NOT NULL DEFAULT 1 CHECK (rounding_increment IN (1,5,10)),
  rounding_decimals integer NOT NULL DEFAULT 2 CHECK (rounding_decimals IN (1,2)),
  rounding_changed_at timestamptz,
  cities_imported_at timestamptz,
  cities_source_filename text NOT NULL DEFAULT '',
  last_run_kind text NOT NULL DEFAULT '',
  last_run_at timestamptz,
  last_status text NOT NULL DEFAULT 'idle',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.aramex_domestic_settings TO authenticated;
GRANT ALL ON public.aramex_domestic_settings TO service_role;
ALTER TABLE public.aramex_domestic_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read settings" ON public.aramex_domestic_settings FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
CREATE TRIGGER aramex_domestic_settings_set_updated_at BEFORE UPDATE ON public.aramex_domestic_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.aramex_domestic_settings (id) VALUES (true);

-- 5. Atomic activation of a rate version -------------------------------------
CREATE OR REPLACE FUNCTION public.aramex_activate_rate_version(_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('aramex_domestic_rates'));
  IF NOT EXISTS (SELECT 1 FROM public.aramex_domestic_rates WHERE version_id = _version_id AND usd_rate IS NOT NULL) THEN
    RAISE EXCEPTION 'Rate version % has no calculated USD rates', _version_id;
  END IF;
  UPDATE public.aramex_domestic_rate_versions SET status = 'superseded' WHERE status = 'active' AND id <> _version_id;
  UPDATE public.aramex_domestic_rate_versions SET status = 'active' WHERE id = _version_id;
END;
$$;
REVOKE ALL ON FUNCTION public.aramex_activate_rate_version(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aramex_activate_rate_version(uuid) TO service_role;

-- 6. Immutable shipping snapshot on orders -----------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;