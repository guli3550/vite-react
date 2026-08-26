create table if not exists public.category_settings (
  slug text primary key,
  name text not null,
  image_url text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.category_settings (slug,name,image_url,sort_order,active)
values
('pinyuar','Pinyuar','https://images.unsplash.com/photo-1618244972963-dbee1a7edc95?auto=format&fit=crop&w=900&q=82',1,true),
('pijama','Pijama','https://images.unsplash.com/photo-1608234807905-4466023792f5?auto=format&fit=crop&w=900&q=82',2,true),
('byustgalter','Byusgalter','https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=82',3,true),
('mayka','Mayka','https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=82',4,true),
('tursik','Tursik','https://images.unsplash.com/photo-1566206091558-7f218b696731?auto=format&fit=crop&w=900&q=82',5,true)
on conflict (slug) do update set name=excluded.name, sort_order=excluded.sort_order, active=excluded.active;

alter table public.category_settings enable row level security;
drop policy if exists "category_settings_public_read" on public.category_settings;
create policy "category_settings_public_read" on public.category_settings for select using (true);
