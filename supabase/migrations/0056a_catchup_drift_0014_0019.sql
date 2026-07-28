-- 0056a_catchup_drift_0014_0019.sql
-- Part 1 of 4 of the 0014-0032 schema-drift catch-up.
--
-- The remote database had migrations 0001-0013 and 0031+ applied, but the
-- 0014-0032 block was skipped entirely, leaving 15 tables and 4 columns
-- missing while application code already referenced them. The advisor_note
-- failure in the property editor was one symptom; 0020 was applied
-- out-of-band to unblock it.
--
-- Applied to the remote database as four separate migrations rather than
-- one, because the combined file is ~50KB. These four files mirror the
-- ledger entries 0056a-0056d exactly. Order matters: apply a, b, c, d.
--
-- Replays: 0014, 0015, 0016, 0017, 0018, 0019
-- Creates: bulk_operations, referrals, recently_viewed,
-- tour_requests, area_guides, amenities_taxonomy
--
-- Idempotent throughout - enum creation is existence-checked via DO blocks,
-- tables and indexes use IF NOT EXISTS, triggers are dropped before being
-- recreated, and both seed INSERTs carry ON CONFLICT DO NOTHING. Re-running
-- any of these files is a no-op.

set local search_path = public, auth, extensions;

-- ═══════════════════════════════════════════════════════════════
-- replayed from 0014_bulk_ops.sql
-- ═══════════════════════════════════════════════════════════════
-- 0014_bulk_ops.sql
-- Phase 8b — bulk-operations log.
--
-- The audit_log already captures per-id rows (e.g. one
-- 'property.bulk_update' row per property). bulk_operations adds the
-- *summary* shape: one row per bulk action with the requested-count +
-- per-id outcomes, so the audit log filter `?kind=bulk` can list "the
-- archives Mariam ran yesterday" without joining + grouping the per-id
-- rows.
--
-- The two tables are complementary: audit_log is the detailed trail,
-- bulk_operations is the index of bulk actions.


do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'bulk_action_kind'
  ) then
    create type public.bulk_action_kind as enum (
  'bulk_update',
  'bulk_publish',
  'bulk_off_market',
  'bulk_reassign',
  'bulk_archive'
);
  end if;
end$$;

create table if not exists public.bulk_operations (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references auth.users(id) on delete set null,
  action        public.bulk_action_kind not null,
  target_kind   text not null default 'property',
  target_count  integer not null check (target_count >= 0),
  succeeded     jsonb not null default '[]'::jsonb,
  skipped       jsonb not null default '[]'::jsonb,
  payload       jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists bulk_operations_created_idx on public.bulk_operations (created_at desc);
create index if not exists bulk_operations_actor_idx   on public.bulk_operations (actor_id);
create index if not exists bulk_operations_action_idx  on public.bulk_operations (action);

alter table public.bulk_operations enable row level security;

-- Staff can read (so the audit-log viewer can filter on kind=bulk for
-- everyone the staff role can already see); only the service role
-- writes — server actions run with the user JWT and the policy below
-- requires staff status for the insert to land. Service-role bypasses
-- RLS, so cron jobs and migrations can also write directly.
drop policy if exists bulk_operations_staff_read on public.bulk_operations;
create policy bulk_operations_staff_read on public.bulk_operations
  for select to authenticated using (public.is_staff());

drop policy if exists bulk_operations_staff_insert on public.bulk_operations;
create policy bulk_operations_staff_insert on public.bulk_operations
  for insert to authenticated with check (public.is_staff());


-- ═══════════════════════════════════════════════════════════════
-- replayed from 0015_referrals.sql
-- ═══════════════════════════════════════════════════════════════
-- 0015_referrals.sql
-- Sprint 8 — referrals (account → account).
--
-- One referrer can invite many referees via a stable code. We track the
-- status (pending → signed_up → first_deal → paid) and the payout amount
-- in AED. The referrer reads their own row; staff reads all.


do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'referral_status'
  ) then
    create type public.referral_status as enum (
  'pending',
  'signed_up',
  'first_deal',
  'paid',
  'void'
);
  end if;
end$$;

create table if not exists public.referrals (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique,
  referrer_account_id  uuid not null references public.accounts(user_id) on delete cascade,
  referee_account_id   uuid references public.accounts(user_id) on delete set null,
  status               public.referral_status not null default 'pending',
  payout_amount_aed    numeric(12, 2) not null default 0,
  notes                text,
  signed_up_at         timestamptz,
  first_deal_at        timestamptz,
  paid_at              timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_account_id);
create index if not exists referrals_referee_idx  on public.referrals (referee_account_id);
create index if not exists referrals_status_idx   on public.referrals (status);

drop trigger if exists referrals_set_updated_at on public.referrals;
create trigger referrals_set_updated_at before update on public.referrals
  for each row execute function public.set_updated_at();

alter table public.referrals enable row level security;

-- Referrer reads + updates own rows; referee reads own; staff reads all.
drop policy if exists referrals_referrer_select on public.referrals;
create policy referrals_referrer_select on public.referrals
  for select using (auth.uid() = referrer_account_id);

drop policy if exists referrals_referee_select on public.referrals;
create policy referrals_referee_select on public.referrals
  for select using (auth.uid() = referee_account_id);

drop policy if exists referrals_staff_select on public.referrals;
create policy referrals_staff_select on public.referrals
  for select to authenticated using (public.is_staff());

drop policy if exists referrals_staff_write on public.referrals;
create policy referrals_staff_write on public.referrals
  for all to authenticated using (public.is_staff()) with check (public.is_staff());


-- ═══════════════════════════════════════════════════════════════
-- replayed from 0016_recently_viewed.sql
-- ═══════════════════════════════════════════════════════════════
-- 0016_recently_viewed.sql
-- Sprint 8 — recently-viewed history per account.
--
-- Page-view tracking on the /p/[slug] surface. Account sees their own
-- last N entries on /account/saved → Recently viewed tab.
-- Anonymous views aren't tracked here (we'd need a session-cookie pivot).


create table if not exists public.recently_viewed (
  user_id      uuid not null references public.accounts(user_id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  viewed_at    timestamptz not null default now(),
  primary key (user_id, property_id)
);

create index if not exists recently_viewed_user_idx       on public.recently_viewed (user_id, viewed_at desc);
create index if not exists recently_viewed_property_idx   on public.recently_viewed (property_id);

alter table public.recently_viewed enable row level security;

drop policy if exists recently_viewed_own_select on public.recently_viewed;
create policy recently_viewed_own_select on public.recently_viewed
  for select using (auth.uid() = user_id);

drop policy if exists recently_viewed_own_upsert on public.recently_viewed;
create policy recently_viewed_own_upsert on public.recently_viewed
  for insert with check (auth.uid() = user_id);

drop policy if exists recently_viewed_own_update on public.recently_viewed;
create policy recently_viewed_own_update on public.recently_viewed
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists recently_viewed_own_delete on public.recently_viewed;
create policy recently_viewed_own_delete on public.recently_viewed
  for delete using (auth.uid() = user_id);

drop policy if exists recently_viewed_staff_select on public.recently_viewed;
create policy recently_viewed_staff_select on public.recently_viewed
  for select to authenticated using (public.is_staff());


-- ═══════════════════════════════════════════════════════════════
-- replayed from 0017_tour_requests.sql
-- ═══════════════════════════════════════════════════════════════
-- 0017_tour_requests.sql
-- Sprint 8 — tour requests (a.k.a. site-visit requests).
--
-- /p/[slug] → "Schedule viewing" submits to this table. Different shape
-- from the existing `viewings` table (booked + confirmed slots):
-- tour_requests captures the *interest* + the requested window before
-- staff assigns a slot.


do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'tour_request_status'
  ) then
    create type public.tour_request_status as enum (
  'pending',
  'contacted',
  'scheduled',
  'completed',
  'cancelled'
);
  end if;
end$$;

create table if not exists public.tour_requests (
  id                uuid primary key default gen_random_uuid(),
  property_id       uuid not null references public.properties(id) on delete cascade,
  account_id        uuid references public.accounts(user_id) on delete set null,
  -- Anonymous tour requests capture contact inline:
  full_name         text,
  email             text,
  phone             text,
  preferred_window  text, -- e.g. 'this_weekend', 'weekday_evening'
  message           text,
  status            public.tour_request_status not null default 'pending',
  assigned_agent_id uuid references public.staff(user_id) on delete set null,
  scheduled_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists tour_requests_property_idx  on public.tour_requests (property_id);
create index if not exists tour_requests_account_idx   on public.tour_requests (account_id);
create index if not exists tour_requests_status_idx    on public.tour_requests (status);
create index if not exists tour_requests_created_idx   on public.tour_requests (created_at desc);

drop trigger if exists tour_requests_set_updated_at on public.tour_requests;
create trigger tour_requests_set_updated_at before update on public.tour_requests
  for each row execute function public.set_updated_at();

alter table public.tour_requests enable row level security;

-- Account reads + creates own. Anonymous insert allowed (anon JWT) but
-- without an account_id; staff sees all.
drop policy if exists tour_requests_own_select on public.tour_requests;
create policy tour_requests_own_select on public.tour_requests
  for select using (auth.uid() = account_id);

drop policy if exists tour_requests_anon_insert on public.tour_requests;
create policy tour_requests_anon_insert on public.tour_requests
  for insert with check (account_id is null or auth.uid() = account_id);

drop policy if exists tour_requests_staff_select on public.tour_requests;
create policy tour_requests_staff_select on public.tour_requests
  for select to authenticated using (public.is_staff());

drop policy if exists tour_requests_staff_write on public.tour_requests;
create policy tour_requests_staff_write on public.tour_requests
  for all to authenticated using (public.is_staff()) with check (public.is_staff());


-- ═══════════════════════════════════════════════════════════════
-- replayed from 0018_area_guides.sql
-- ═══════════════════════════════════════════════════════════════
-- 0018_area_guides.sql
-- Sprint 8 — area-guide editorial overlay on the areas table.
--
-- One row per area that we want to publish a "neighbourhood guide" for.
-- The `areas` table itself carries name/slug/geo (admin metadata); the
-- area_guide carries the narrative shape we render on /areas/[slug].


create table if not exists public.area_guides (
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

create index if not exists area_guides_published_idx on public.area_guides (published_at desc)
  where published_at is not null;

drop trigger if exists area_guides_set_updated_at on public.area_guides;
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


-- ═══════════════════════════════════════════════════════════════
-- replayed from 0019_amenities_taxonomy.sql
-- ═══════════════════════════════════════════════════════════════
-- 0019_amenities_taxonomy.sql
-- Sprint 8 — canonical amenity codes.
--
-- properties.amenities is currently a free-text text[]. The taxonomy
-- introduces a controlled vocabulary so the property-edit form can show
-- a 21-toggle grid (Sprint 7c) and search can filter by canonical codes.
-- Free-text values remain valid; Sprint 9 backfills by fuzzy-mapping.


-- Categories mirror lib/schemas/amenity-taxonomy.ts (BF-1).
do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'amenity_category'
  ) then
    create type public.amenity_category as enum (
  'indoor',
  'outdoor',
  'building',
  'community',
  'view',
  'security',
  'wellness'
);
  end if;
end$$;

create table if not exists public.amenities_taxonomy (
  code        text primary key,
  label       text not null,
  category    public.amenity_category not null,
  icon        text,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists amenities_taxonomy_category_idx on public.amenities_taxonomy (category);
create index if not exists amenities_taxonomy_active_idx   on public.amenities_taxonomy (active);

drop trigger if exists amenities_taxonomy_set_updated_at on public.amenities_taxonomy;
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
