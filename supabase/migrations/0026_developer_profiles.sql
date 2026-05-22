-- 0026_developer_profiles.sql
-- Sprint 8 — narrative profile for /developers/[slug].
--
-- Sits alongside developers (which holds name/slug/logo/founded_year +
-- aggregate stats jsonb) to carry the long-form editorial fields used
-- on the public profile page.

set local search_path = public, auth, extensions;

create table public.developer_profiles (
  developer_id     uuid primary key references public.developers(id) on delete cascade,
  bio              text,
  founded          int,                       -- mirrors developers.founded_year for convenience
  headquarters     text,
  website          text,
  awards           jsonb not null default '[]'::jsonb,
    -- [{ name, year, body }]
  signature_styles text[] not null default '{}',
  current_focus    text,
  hero_image_id    uuid references public.media_assets(id) on delete set null,
  seo              jsonb,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index developer_profiles_published_idx on public.developer_profiles (published_at desc)
  where published_at is not null;

create trigger developer_profiles_set_updated_at before update on public.developer_profiles
  for each row execute function public.set_updated_at();

alter table public.developer_profiles enable row level security;

drop policy if exists developer_profiles_public_read on public.developer_profiles;
create policy developer_profiles_public_read on public.developer_profiles
  for select using (published_at is not null);

drop policy if exists developer_profiles_staff_select on public.developer_profiles;
create policy developer_profiles_staff_select on public.developer_profiles
  for select to authenticated using (public.is_staff());

drop policy if exists developer_profiles_staff_write on public.developer_profiles;
create policy developer_profiles_staff_write on public.developer_profiles
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
