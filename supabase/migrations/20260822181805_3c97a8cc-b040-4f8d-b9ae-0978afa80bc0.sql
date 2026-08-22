CREATE TABLE public.currency_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base text NOT NULL DEFAULT 'USD',
  quote text NOT NULL DEFAULT 'LKR',
  rate_date date NOT NULL,
  rate numeric(18,6) NOT NULL,
  inverse_rate numeric(18,8),
  source text NOT NULL DEFAULT 'cbsl.gov.lk',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (base, quote, rate_date)
);

GRANT SELECT ON public.currency_rates TO authenticated;
GRANT ALL ON public.currency_rates TO service_role;

ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view currency rates"
ON public.currency_rates FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

CREATE TRIGGER currency_rates_set_updated_at
BEFORE UPDATE ON public.currency_rates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX currency_rates_pair_date_idx ON public.currency_rates (base, quote, rate_date DESC);