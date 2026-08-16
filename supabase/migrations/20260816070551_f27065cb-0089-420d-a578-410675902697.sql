ALTER TABLE public.products ADD COLUMN IF NOT EXISTS colour text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS products_colour_idx ON public.products (colour);