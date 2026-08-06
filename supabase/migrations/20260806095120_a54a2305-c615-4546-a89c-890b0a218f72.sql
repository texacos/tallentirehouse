ALTER TABLE public.products ADD COLUMN IF NOT EXISTS total_stock integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.products_sync_total_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total integer := 0;
BEGIN
  IF NEW.variants IS NOT NULL AND jsonb_typeof(NEW.variants) = 'array' AND jsonb_array_length(NEW.variants) > 0 THEN
    SELECT COALESCE(SUM(GREATEST(COALESCE((v ->> 'stock')::numeric, 0), 0)), 0)::int
      INTO v_total
    FROM jsonb_array_elements(NEW.variants) AS v;
  ELSE
    v_total := COALESCE(NEW.stock, 0);
  END IF;
  NEW.total_stock := v_total;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.products_sync_total_stock() FROM PUBLIC;

DROP TRIGGER IF EXISTS products_total_stock ON public.products;
CREATE TRIGGER products_total_stock
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_sync_total_stock();

UPDATE public.products SET stock = stock;

CREATE INDEX IF NOT EXISTS products_total_stock_idx ON public.products (total_stock);