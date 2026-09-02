-- Migration: 20260902_order_customer_identity.sql
-- Add customer identity and date of birth fields to orders and telegram_users

ALTER TABLE IF EXISTS orders
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS birth_date text,
  ADD COLUMN IF NOT EXISTS dob text;

ALTER TABLE IF EXISTS telegram_users
  ADD COLUMN IF NOT EXISTS birth_date text,
  ADD COLUMN IF NOT EXISTS dob text;

-- Index for customer search
CREATE INDEX IF NOT EXISTS idx_orders_birth_date ON orders(birth_date);
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON orders(customer_name);
