-- Run this in the Supabase SQL editor before a public launch.
-- Profiles are owned by Supabase Auth users. The shared card cache is written
-- by the server route with the service role key and read by signed-in users.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  unique (user_id)
);

create table if not exists card_cache (
  key         text primary key,
  payload     jsonb not null,
  fetched_at  timestamptz not null default now()
);

create table if not exists api_rate_limits (
  key       text primary key,
  count     integer not null default 0,
  reset_at  timestamptz not null
);

alter table profiles enable row level security;
alter table card_cache enable row level security;
alter table api_rate_limits enable row level security;

drop policy if exists "profiles_select_own" on profiles;
drop policy if exists "profiles_insert_own" on profiles;
drop policy if exists "profiles_update_own" on profiles;
drop policy if exists "profiles_delete_own" on profiles;
drop policy if exists "card_cache_select_authenticated" on card_cache;

create policy "profiles_select_own"
  on profiles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "profiles_insert_own"
  on profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "profiles_update_own"
  on profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "profiles_delete_own"
  on profiles for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "card_cache_select_authenticated"
  on card_cache for select
  to authenticated
  using (true);
