CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  fulfilment_status text NOT NULL DEFAULT 'new',
  payment_provider text NOT NULL DEFAULT 'ziina',
  payment_intent_id text,
  payment_redirect_url text,
  is_test boolean NOT NULL DEFAULT true,
  currency text NOT NULL DEFAULT 'USD',
  subtotal numeric NOT NULL DEFAULT 0,
  shipping_amount numeric NOT NULL DEFAULT 0,
  shipping_carrier_code text NOT NULL DEFAULT '',
  shipping_carrier_name text NOT NULL DEFAULT '',
  total numeric NOT NULL DEFAULT 0,
  total_weight_kg numeric NOT NULL DEFAULT 0,
  billing_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  items_count integer NOT NULL DEFAULT 0,
  stock_applied boolean NOT NULL DEFAULT false,
  email_status text NOT NULL DEFAULT 'pending',
  email_error text,
  email_sent_at timestamp with time zone,
  email_attempts integer NOT NULL DEFAULT 0,
  internal_note text NOT NULL DEFAULT '',
  tracking_number text NOT NULL DEFAULT '',
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid,
  product_slug text NOT NULL DEFAULT '',
  product_name text NOT NULL DEFAULT '',
  sku text NOT NULL DEFAULT '',
  size text NOT NULL DEFAULT '',
  qty integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  weight_kg numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX orders_status_idx ON public.orders (status);
CREATE INDEX orders_intent_idx ON public.orders (payment_intent_id);
CREATE INDEX order_items_order_idx ON public.order_items (order_id);

GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view orders"
  ON public.orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE POLICY "Admins can update orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE POLICY "Admins can view order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();