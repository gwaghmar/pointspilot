-- Run this in the Supabase SQL editor.
-- No auth for MVP: RLS off, profiles keyed by a random device id.

create table if not exists profiles (
  device      text primary key,
  data        jsonb not null,            -- { profile, cards, uses }
  updated_at  timestamptz default now()
);

create table if not exists card_cache (
  key         text primary key,          -- normalized card name
  payload     jsonb not null,            -- reward data + sources + asOf
  fetched_at  timestamptz default now()
);

-- MVP only: open access. Lock these down (RLS + auth) before real launch.
alter table profiles   disable row level security;
alter table card_cache disable row level security;
