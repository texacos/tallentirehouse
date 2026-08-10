CREATE TABLE public.hero_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_path text NOT NULL,
  master_path text NOT NULL,
  variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  alt_text text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  display_duration integer,
  transition text,
  width integer NOT NULL,
  height integer NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL,
  original_filename text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hero_slides_duration_range CHECK (display_duration IS NULL OR (display_duration >= 2 AND display_duration <= 15)),
  CONSTRAINT hero_slides_transition_valid CHECK (transition IS NULL OR transition IN ('dissolve','slide','zoom')),
  CONSTRAINT hero_slides_dimensions CHECK (width = 1920 AND height = 1080)
);

CREATE INDEX hero_slides_order_idx ON public.hero_slides (sort_order, created_at);
CREATE INDEX hero_slides_active_idx ON public.hero_slides (is_active, sort_order);

GRANT SELECT ON public.hero_slides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_slides TO authenticated;
GRANT ALL ON public.hero_slides TO service_role;

ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active hero slides are publicly readable"
  ON public.hero_slides FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins can read all hero slides"
  ON public.hero_slides FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert hero slides"
  ON public.hero_slides FOR INSERT
  TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update hero slides"
  ON public.hero_slides FOR UPDATE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete hero slides"
  ON public.hero_slides FOR DELETE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

CREATE TRIGGER hero_slides_set_updated_at
  BEFORE UPDATE ON public.hero_slides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Admins can upload hero images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'hero-slides' AND private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update hero images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'hero-slides' AND private.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'hero-slides' AND private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete hero images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'hero-slides' AND private.has_role(auth.uid(), 'admin'));
