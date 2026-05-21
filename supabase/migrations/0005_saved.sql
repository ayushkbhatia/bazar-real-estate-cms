-- 0005_saved.sql
-- saved_properties + saved_searches: per-account marketplace personalisation.
-- RLS: users see and manage only their own rows. Staff can read everything
-- (for "saved with advisor" flows later).

create table if not exists public.saved_properties (
  user_id     uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, property_id)
);
create index if not exists saved_properties_user_idx
  on public.saved_properties (user_id, created_at desc);

create type public.alert_frequency as enum ('off', 'instant', 'daily', 'weekly');

create table if not exists public.saved_searches (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  query           jsonb not null,
  mode            public.property_mode,
  alert_frequency public.alert_frequency not null default 'off',
  last_alert_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists saved_searches_user_idx
  on public.saved_searches (user_id, created_at desc);

drop trigger if exists saved_searches_set_updated_at on public.saved_searches;
create trigger saved_searches_set_updated_at
  before update on public.saved_searches
  for each row execute function public.set_updated_at();

alter table public.saved_properties enable row level security;
alter table public.saved_searches  enable row level security;

drop policy if exists saved_properties_own_select on public.saved_properties;
drop policy if exists saved_properties_own_insert on public.saved_properties;
drop policy if exists saved_properties_own_delete on public.saved_properties;
drop policy if exists saved_properties_staff_select on public.saved_properties;

create policy saved_properties_own_select on public.saved_properties
  for select using (auth.uid() = user_id);
create policy saved_properties_own_insert on public.saved_properties
  for insert with check (auth.uid() = user_id);
create policy saved_properties_own_delete on public.saved_properties
  for delete using (auth.uid() = user_id);
create policy saved_properties_staff_select on public.saved_properties
  for select to authenticated using (public.is_staff());

drop policy if exists saved_searches_own_select on public.saved_searches;
drop policy if exists saved_searches_own_insert on public.saved_searches;
drop policy if exists saved_searches_own_update on public.saved_searches;
drop policy if exists saved_searches_own_delete on public.saved_searches;
drop policy if exists saved_searches_staff_select on public.saved_searches;

create policy saved_searches_own_select on public.saved_searches
  for select using (auth.uid() = user_id);
create policy saved_searches_own_insert on public.saved_searches
  for insert with check (auth.uid() = user_id);
create policy saved_searches_own_update on public.saved_searches
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy saved_searches_own_delete on public.saved_searches
  for delete using (auth.uid() = user_id);
create policy saved_searches_staff_select on public.saved_searches
  for select to authenticated using (public.is_staff());
