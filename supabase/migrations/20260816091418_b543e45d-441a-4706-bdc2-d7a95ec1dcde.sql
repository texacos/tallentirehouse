CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON public.products USING gin (name public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_description_trgm_idx ON public.products USING gin (description public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_sku_trgm_idx ON public.products USING gin (sku public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_colour_trgm_idx ON public.products USING gin (colour public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_categories_gin_idx ON public.products USING gin (categories);