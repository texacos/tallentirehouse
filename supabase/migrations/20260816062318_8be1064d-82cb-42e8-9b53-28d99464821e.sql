ALTER TABLE public.products ADD COLUMN IF NOT EXISTS how_we_make_it text DEFAULT '';

UPDATE public.products SET how_we_make_it = '' WHERE how_we_make_it IS NULL;

ALTER TABLE public.products ALTER COLUMN how_we_make_it SET NOT NULL;