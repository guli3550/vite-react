-- Replace the incorrect demo image used by Elegant Lace Bra.
-- Run once in Supabase SQL Editor after the schema is available.
update public.products
set image = 'https://images.unsplash.com/photo-1635359596131-14dff13eda23?auto=format&fit=crop&w=900&q=85',
    images = '[]',
    updated_at = now()
where name = 'Elegant Lace Bra' or title = 'Elegant Lace Bra';
