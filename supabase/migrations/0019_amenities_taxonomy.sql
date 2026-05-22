-- 0019_amenities_taxonomy.sql
-- Sprint 8 — canonical amenity codes.
--
-- properties.amenities is currently a free-text text[]. The taxonomy
-- introduces a controlled vocabulary so the property-edit form can show
-- a 21-toggle grid (Sprint 7c) and search can filter by canonical codes.
-- Free-text values remain valid; Sprint 9 backfills by fuzzy-mapping.

set local search_path = public, auth, extensions;

-- Categories mirror lib/schemas/amenity-taxonomy.ts (BF-1).
create type public.amenity_category as enum (
  'indoor',
  'outdoor',
  'building',
  'community',
  'view',
  'security',
  'wellness'
);

create table public.amenities_taxonomy (
  code        text primary key,
  label       text not null,
  category    public.amenity_category not null,
  icon        text,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index amenities_taxonomy_category_idx on public.amenities_taxonomy (category);
create index amenities_taxonomy_active_idx   on public.amenities_taxonomy (active);

create trigger amenities_taxonomy_set_updated_at before update on public.amenities_taxonomy
  for each row execute function public.set_updated_at();

alter table public.amenities_taxonomy enable row level security;

-- Public read (used by search facet display); staff write.
drop policy if exists amenities_taxonomy_public_read on public.amenities_taxonomy;
create policy amenities_taxonomy_public_read on public.amenities_taxonomy
  for select using (active = true);

drop policy if exists amenities_taxonomy_staff_select on public.amenities_taxonomy;
create policy amenities_taxonomy_staff_select on public.amenities_taxonomy
  for select to authenticated using (public.is_staff());

drop policy if exists amenities_taxonomy_staff_write on public.amenities_taxonomy;
create policy amenities_taxonomy_staff_write on public.amenities_taxonomy
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Seed: the 21 canonical amenities from lib/schemas/amenity-taxonomy.ts
-- (kept in sync; the schema file is the source for the UI grid).
insert into public.amenities_taxonomy (code, label, category, icon, sort_order) values
  ('pool',            'Pool',            'outdoor',   'pool',      10),
  ('private_pool',    'Private pool',    'outdoor',   'pool',      20),
  ('gym',             'Gym',             'wellness',  'dumbbell',  30),
  ('spa',             'Spa',             'wellness',  'sparkles',  40),
  ('sauna',           'Sauna',           'wellness',  'flame',     50),
  ('concierge',       'Concierge',       'building',  'bell',      60),
  ('security_24h',    '24h security',    'security',  'shield',    70),
  ('covered_parking', 'Covered parking', 'building',  'car',       80),
  ('beach_access',    'Beach access',    'outdoor',   'waves',     90),
  ('sea_view',        'Sea view',        'view',      'eye',      100),
  ('skyline_view',    'Skyline view',    'view',      'buildings',110),
  ('park_view',       'Park view',       'view',      'trees',    120),
  ('garden',          'Garden',          'outdoor',   'leaf',     130),
  ('balcony',         'Balcony',         'outdoor',   'wind',     140),
  ('kids_club',       'Kids'' club',     'community', 'users',    150),
  ('maids_room',      'Maid''s room',    'indoor',    'bed',      160),
  ('drivers_room',    'Driver''s room',  'indoor',    'bed',      170),
  ('smart_home',      'Smart home',      'indoor',    'cpu',      180),
  ('pet_friendly',    'Pet friendly',    'community', 'paw',      190),
  ('walk_in_closet',  'Walk-in closet',  'indoor',    'shirt',    200),
  ('storage',         'Storage',         'building',  'package',  210)
on conflict (code) do nothing;
