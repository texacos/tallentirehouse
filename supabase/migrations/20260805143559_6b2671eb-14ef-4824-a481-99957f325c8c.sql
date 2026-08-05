CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  message text NOT NULL,
  ip text,
  user_agent text,
  email_status text NOT NULL DEFAULT 'pending',
  email_error text,
  delivered_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view contact messages" ON public.contact_messages
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete contact messages" ON public.contact_messages
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
GRANT SELECT, DELETE ON public.contact_messages TO authenticated;

CREATE INDEX contact_messages_created_at_idx ON public.contact_messages (created_at DESC);
CREATE INDEX contact_messages_ip_idx ON public.contact_messages (ip, created_at DESC);
CREATE INDEX contact_messages_email_idx ON public.contact_messages (email, created_at DESC);