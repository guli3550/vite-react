alter table public.reels
  add column if not exists display_likes_count integer not null default 100
  check (display_likes_count between 0 and 5000);

-- Give the currently saved Reels a randomized, clearly designated demo popularity count.
update public.reels
set display_likes_count = 100 + floor(random() * 401)::integer
where display_likes_count = 100;

