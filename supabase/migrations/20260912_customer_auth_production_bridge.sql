-- Production customer identity bridge for Supabase Auth.
-- Mirrors the migration applied to project qttwufydrvdwmhxcpgjb on 2026-09-12.

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  telegram_id BIGINT,
  auth_provider TEXT DEFAULT 'email',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_auth_user_id_idx ON public.customers(auth_user_id);
CREATE INDEX IF NOT EXISTS customers_email_idx ON public.customers(lower(email));
CREATE INDEX IF NOT EXISTS customers_telegram_id_idx ON public.customers(telegram_id);
CREATE INDEX IF NOT EXISTS customers_created_at_idx ON public.customers(created_at DESC);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own customer profile" ON public.customers;
DROP POLICY IF EXISTS "Users can update their own customer profile" ON public.customers;
DROP POLICY IF EXISTS "Users can insert their own customer profile" ON public.customers;

CREATE POLICY "Users can view their own customer profile"
  ON public.customers FOR SELECT TO authenticated
  USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can update their own customer profile"
  ON public.customers FOR UPDATE TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "Users can insert their own customer profile"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = auth_user_id);

GRANT ALL ON TABLE public.customers TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.customers TO authenticated;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_auth_user_id_created_at_idx
  ON public.orders(auth_user_id, created_at DESC)
  WHERE auth_user_id IS NOT NULL;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.orders FROM anon, authenticated;
