-- Reels server persistence. Safe to run more than once.
create table if not exists public.reels (
  id text primary key,
  video_url text not null,
  poster_url text not null default '',
  caption text not null default '',
  music_title text,
  author jsonb not null default '{"name":"Guli Market","username":"gulii.uz","avatar":"/guli-logo.png","verified":true}'::jsonb,
  product_id text,
  product_name text,
  product_price numeric,
  product_image text,
  status text not null default 'draft' check (status in ('active','draft','inactive')),
  likes_count integer not null default 0 check (likes_count >= 0),
  shares_count integer not null default 0 check (shares_count >= 0),
  views_count bigint not null default 0 check (views_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reels_status_created_idx on public.reels(status, created_at desc);

create table if not exists public.reel_comments (
  id text primary key,
  reel_id text not null references public.reels(id) on delete cascade,
  author_name text not null,
  author_avatar text not null default '/guli-logo.png',
  body text not null check (char_length(body) between 1 and 300),
  likes_count integer not null default 0 check (likes_count >= 0),
  created_at timestamptz not null default now()
);
create index if not exists reel_comments_reel_created_idx on public.reel_comments(reel_id, created_at desc);

create table if not exists public.reel_likes (
  reel_id text not null references public.reels(id) on delete cascade,
  viewer_key text not null,
  created_at timestamptz not null default now(),
  primary key (reel_id, viewer_key)
);

-- Server uses the service role key. Block direct anonymous access to all three tables.
alter table public.reels enable row level security;
alter table public.reel_comments enable row level security;
alter table public.reel_likes enable row level security;
revoke all on public.reels, public.reel_comments, public.reel_likes from anon, authenticated;
