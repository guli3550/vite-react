-- GULI reviews: realtime publication only.
-- No reviewer identity columns are duplicated; public.users remains canonical.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'product_reviews'
  ) then
    alter publication supabase_realtime add table public.product_reviews;
  end if;
end $$;
