-- Canonical Telegram profile fields on the single public.users identity row.
-- No duplicate identity table is introduced.
alter table public.users
  add column if not exists telegram_username text,
  add column if not exists telegram_photo_url text;

create unique index if not exists users_telegram_id_key
  on public.users (telegram_id)
  where telegram_id is not null;

create unique index if not exists users_phone_number_key
  on public.users (phone_number);
