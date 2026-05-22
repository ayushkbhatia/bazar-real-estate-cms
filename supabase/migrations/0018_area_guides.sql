-- 0018_area_guides.sql
-- Sprint 8 — area-guide editorial overlay on the areas table.
--
-- One row per area that we want to publish a "neighbourhood guide" for.
-- The `areas` table itself carries name/slug/geo (admin metadata); the
-- area_guide carries the narrative shape we render on /areas/[slug].

set local search_path = public, auth, extensions;

create table public.area_guides (
  area_id        uuid primary key references public.areas(id) on delete cascade,
  intro_md       text,
  stats          jsonb not null default '{}'::jsonb,
    -- { medianApt: 2400000, medianVilla: 9500000, daysOnMarket: 32, ... }
  schools        jsonb not null default '[]'::jsonb,
    -- [{ name, kind: 'school'|'nursery'|'university', distance_km }]
  amenities      jsonb not null default '[]'::jsonb,
    -- [{ name, kind: 'mall'|'park'|'beach'|'metro'|'hospital', distance_km }]
  related_areas  uuid[] not null default '{}',
  hero_image_id  uuid references public.media_assets(id) on delete set null,
  seo            jsonb,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index area_guides_published_idx on public.area_guides (published_at desc)
  where published_at is not null;

create trigger area_guides_set_updated_at before update on public.area_guides
  for each row execute function public.set_updated_at();

alter table public.area_guides enable row level security;

-- Public reads only published guides; staff reads/writes all.
drop policy if exists area_guides_public_read on public.area_guides;
create policy area_guides_public_read on public.area_guides
  for select using (published_at is not null);

drop policy if exists area_guides_staff_select on public.area_guides;
create policy area_guides_staff_select on public.area_guides
  for select to authenticated using (public.is_staff());

drop policy if exists area_guides_staff_write on public.area_guides;
create policy area_guides_staff_write on public.area_guides
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
