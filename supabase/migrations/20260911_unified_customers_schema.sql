-- GULI Unified Customers Schema Migration
-- Bridges Supabase Auth (auth.users) with application customer identity.
-- Generated: 2026-09-11

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

-- Indexes for rapid lookup
CREATE INDEX IF NOT EXISTS customers_auth_user_id_idx ON public.customers(auth_user_id);
CREATE INDEX IF NOT EXISTS customers_email_idx ON public.customers(lower(email));
CREATE INDEX IF NOT EXISTS customers_telegram_id_idx ON public.customers(telegram_id);
CREATE INDEX IF NOT EXISTS customers_created_at_idx ON public.customers(created_at DESC);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Users can view their own customer profile" ON public.customers;
DROP POLICY IF EXISTS "Users can update their own customer profile" ON public.customers;
DROP POLICY IF EXISTS "Users can insert their own customer profile" ON public.customers;

-- Policy: Authenticated users can select only their own profile
CREATE POLICY "Users can view their own customer profile"
  ON public.customers FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

-- Policy: Authenticated users can update only their own profile
CREATE POLICY "Users can update their own customer profile"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- Policy: Authenticated users can insert their own profile
CREATE POLICY "Users can insert their own customer profile"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth_user_id);

-- Grants
GRANT ALL ON TABLE public.customers TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.customers TO authenticated;
