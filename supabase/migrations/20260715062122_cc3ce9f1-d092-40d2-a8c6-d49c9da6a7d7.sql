
CREATE TABLE public.restock_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_slug text NOT NULL,
  product_name text NOT NULL,
  email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, DELETE ON public.restock_requests TO authenticated;
GRANT INSERT ON public.restock_requests TO anon, authenticated;
GRANT ALL ON public.restock_requests TO service_role;

ALTER TABLE public.restock_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit restock requests"
  ON public.restock_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(email) > 3
    AND length(email) < 320
    AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(product_slug) > 0
    AND length(product_slug) < 200
    AND length(product_name) > 0
    AND length(product_name) < 300
  );

CREATE POLICY "Admins view restock requests"
  ON public.restock_requests FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete restock requests"
  ON public.restock_requests FOR DELETE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX restock_requests_created_at_idx ON public.restock_requests (created_at DESC);
