ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS care_instructions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS dimensions text NOT NULL DEFAULT '';