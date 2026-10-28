-- GULI production performance optimization: add the missing index for products.category_id.
-- Keep all existing RLS policy names, roles, commands, and access rules unchanged.
CREATE INDEX IF NOT EXISTS products_category_id_idx ON public.products (category_id);

ALTER POLICY "Users can insert their own customer profile" ON public.customers
  WITH CHECK ((select auth.uid()) = auth_user_id);
ALTER POLICY "Users can update their own customer profile" ON public.customers
  USING ((select auth.uid()) = auth_user_id)
  WITH CHECK ((select auth.uid()) = auth_user_id);
ALTER POLICY "Users can view their own customer profile" ON public.customers
  USING ((select auth.uid()) = auth_user_id);

ALTER POLICY "Users can insert own profile" ON public.profiles
  WITH CHECK ((select auth.uid()) = id);
ALTER POLICY "Users can update own profile" ON public.profiles
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);
ALTER POLICY "Users can view own profile" ON public.profiles
  USING ((select auth.uid()) = id);

ALTER POLICY "Users can insert own identities" ON public.user_identities
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can update own identities" ON public.user_identities
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can view own identities" ON public.user_identities
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own canonical profile" ON public.users
  USING ((select auth.uid()) = id);
