-- 0056_catchup_drift.sql
-- Schema-drift catch-up: replays the migrations that never reached the
-- remote database.
--
-- Audit finding (2026-07-28): the remote schema had migrations 0001–0013
-- plus 0031+ applied, but the 0014–0032 block was skipped. That left 15
-- tables and 4 columns missing while application code already referenced
-- them — the `advisor_note` save failure in the property editor was one
-- symptom of it (fixed separately by applying 0020).
--
-- Everything below is idempotent: enum creation is existence-checked,
-- tables/indexes use IF NOT EXISTS, triggers and policies are dropped
-- before being recreated, and the two seed INSERTs already carry
-- ON CONFLICT DO NOTHING. Re-running this file is a no-op.
--
-- Replayed: 0014, 0015, 0016, 0017, 0018, 0019, 0021, 0022, 0023, 0024,
--           0025, 0026, 0027, 0029, 0030, 0032
-- Skipped:  0020 (already applied), 0028 (see reconciliation at the end)

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


-- ═══════════════════════════════════════════════════════════════
-- replayed from 0021_licenses.sql
-- ═══════════════════════════════════════════════════════════════
-- 0021_licenses.sql
-- Sprint 8 — RERA / DMT / DLD licensing records.
--
-- ORN: Office Registration Number (firm-level, one per Bazar).
-- BRN: Broker Registration Number (per agent).
-- Trakheesi: Dubai economic-permit number (per listing — but stored here
-- only when it's a *carried* permit; per-listing `listing_permit_no` on
-- properties remains the source of truth for individual listings).


do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'license_kind'
  ) then
    create type public.license_kind as enum (
  'orn',         -- Office Registration Number
  'brn',         -- Broker Registration Number
  'trakheesi',   -- DLD listing permit (carried/general)
  'rera',        -- RERA training certification
  'dmt'          -- Department of Municipalities & Transport
);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'license_holder_kind'
  ) then
    create type public.license_holder_kind as enum (
  'firm',        -- Bazar entity-level
  'staff',       -- specific agent
  'development'  -- per off-plan project
);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'license_status'
  ) then
    create type public.license_status as enum (
  'active',
  'expiring_soon',  -- < 30 days to expires_at
  'expired',
  'revoked'
);
  end if;
end$$;

create table if not exists public.licenses (
  id            uuid primary key default gen_random_uuid(),
  kind          public.license_kind not null,
  holder_kind   public.license_holder_kind not null,
  holder_id     uuid, -- staff.user_id, developments.id, or null for 'firm'
  number        text not null,
  issued_at     date,
  expires_at    date not null,
  file_id       uuid references public.media_assets(id) on delete set null,
  status        public.license_status not null default 'active',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists licenses_kind_idx        on public.licenses (kind);
create index if not exists licenses_holder_idx      on public.licenses (holder_kind, holder_id);
create index if not exists licenses_expires_idx     on public.licenses (expires_at);
create index if not exists licenses_status_idx      on public.licenses (status);
create unique index if not exists licenses_unique_number_idx on public.licenses (kind, number);

drop trigger if exists licenses_set_updated_at on public.licenses;
create trigger licenses_set_updated_at before update on public.licenses
  for each row execute function public.set_updated_at();

alter table public.licenses enable row level security;

-- Staff read; admin write (license records are sensitive).
drop policy if exists licenses_staff_select on public.licenses;
create policy licenses_staff_select on public.licenses
  for select to authenticated using (public.is_staff());

drop policy if exists licenses_admin_write on public.licenses;
create policy licenses_admin_write on public.licenses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- An agent can see their own BRN even if they are not admin.
drop policy if exists licenses_own_select on public.licenses;
create policy licenses_own_select on public.licenses
  for select using (
    holder_kind = 'staff' and holder_id = auth.uid()
  );


-- ═══════════════════════════════════════════════════════════════
-- replayed from 0022_api_keys.sql
-- ═══════════════════════════════════════════════════════════════
-- 0022_api_keys.sql
-- Sprint 8 — outbound + inbound API keys for the integrations panel.
--
-- We store HASHED keys only (sha256(key)) — the plaintext is shown once
-- at creation in /admin/settings/api and then never again. Verifying an
-- inbound request hashes the bearer token and compares to key_hash.


do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'api_key_role'
  ) then
    create type public.api_key_role as enum (
  'read_only',
  'read_write',
  'webhook_dispatch',
  'syndication'    -- portals like Property Finder + Bayut
);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'api_key_status'
  ) then
    create type public.api_key_status as enum (
  'active',
  'revoked'
);
  end if;
end$$;

create table if not exists public.api_keys (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  key_prefix    text not null,           -- shown in UI, e.g. 'bzk_a1b2c3'
  key_hash      text not null unique,    -- sha256 of full key
  role          public.api_key_role not null,
  status        public.api_key_status not null default 'active',
  last_used_at  timestamptz,
  expires_at    timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  revoked_at    timestamptz
);

create index if not exists api_keys_status_idx     on public.api_keys (status);
create index if not exists api_keys_role_idx       on public.api_keys (role);
create index if not exists api_keys_last_used_idx  on public.api_keys (last_used_at desc nulls last);

drop trigger if exists api_keys_set_updated_at on public.api_keys;
create trigger api_keys_set_updated_at before update on public.api_keys
  for each row execute function public.set_updated_at();

alter table public.api_keys enable row level security;

-- Admin-only read + write. Hashed keys never leak to non-admin staff.
drop policy if exists api_keys_admin_all on public.api_keys;
create policy api_keys_admin_all on public.api_keys
  for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- replayed from 0023_webhooks.sql
-- ═══════════════════════════════════════════════════════════════
-- 0023_webhooks.sql
-- Sprint 8 — outbound webhooks for partner integrations.
--
-- The dispatch loop signs each payload with the shared secret using
-- HMAC-SHA256 and posts to target_url. Failures get a row in the
-- (separate) `webhook_deliveries` ledger — Sprint 13 ships that ledger
-- alongside Mailchimp / DocuSign signature verification.


do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'webhook_event'
  ) then
    create type public.webhook_event as enum (
  'property.published',
  'property.updated',
  'property.archived',
  'property.sold',
  'enquiry.created',
  'enquiry.assigned',
  'viewing.scheduled',
  'viewing.cancelled',
  'deal.stage_changed',
  'valuation.submitted',
  'kyc.approved',
  'kyc.rejected'
);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'webhook_status'
  ) then
    create type public.webhook_status as enum (
  'active',
  'paused',
  'failing'  -- > 5 consecutive 5xx → paused via cron
);
  end if;
end$$;

create table if not exists public.webhooks (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  target_url   text not null,
  events       public.webhook_event[] not null,
  secret       text not null,            -- HMAC shared secret
  status       public.webhook_status not null default 'active',
  last_success_at  timestamptz,
  last_failure_at  timestamptz,
  failure_count    int not null default 0,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists webhooks_status_idx on public.webhooks (status);
create index if not exists webhooks_events_gin on public.webhooks using gin (events);

drop trigger if exists webhooks_set_updated_at on public.webhooks;
create trigger webhooks_set_updated_at before update on public.webhooks
  for each row execute function public.set_updated_at();

alter table public.webhooks enable row level security;

drop policy if exists webhooks_admin_all on public.webhooks;
create policy webhooks_admin_all on public.webhooks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- replayed from 0024_integrations.sql
-- ═══════════════════════════════════════════════════════════════
-- 0024_integrations.sql
-- Sprint 8 — integration toggle table.
--
-- One row per third-party integration (Mapbox, Meilisearch, Property
-- Finder, Bayut, Mailchimp, DLD, DocuSign, etc.). Stores config + last
-- sync metadata. The actual *credentials* live in env vars (see
-- lib/env.ts) — `config` holds non-secret tuning (rate limits, dataset
-- IDs, feature toggles).


do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'integration_kind'
  ) then
    create type public.integration_kind as enum (
  'mapbox',
  'meilisearch',
  'voyage_ai',
  'property_finder',
  'bayut',
  'mailchimp',
  'whatsapp_cloud',  -- post-launch
  'dld_open_data',
  'docusign',
  'posthog',
  'sentry',
  'resend'
);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'integration_status'
  ) then
    create type public.integration_status as enum (
  'disconnected',  -- no env keys
  'connected',     -- env keys present + last sync ok
  'error',         -- env keys present but last sync errored
  'paused'         -- admin-disabled
);
  end if;
end$$;

create table if not exists public.integrations (
  kind             public.integration_kind primary key,
  status           public.integration_status not null default 'disconnected',
  config           jsonb not null default '{}'::jsonb,
  last_synced_at   timestamptz,
  last_error       text,
  last_error_at    timestamptz,
  enabled          boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists integrations_status_idx on public.integrations (status);

drop trigger if exists integrations_set_updated_at on public.integrations;
create trigger integrations_set_updated_at before update on public.integrations
  for each row execute function public.set_updated_at();

alter table public.integrations enable row level security;

drop policy if exists integrations_admin_all on public.integrations;
create policy integrations_admin_all on public.integrations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Staff can read status (the integrations panel shows 'connected' chips
-- across multiple admin surfaces) but can't change config.
drop policy if exists integrations_staff_read on public.integrations;
create policy integrations_staff_read on public.integrations
  for select to authenticated using (public.is_staff());

-- Seed the row-per-kind so the admin UI always renders a card per
-- integration, even if no admin has configured one yet.
insert into public.integrations (kind, status, enabled) values
  ('mapbox',           'disconnected', true),
  ('meilisearch',      'disconnected', true),
  ('voyage_ai',        'disconnected', true),
  ('property_finder',  'disconnected', true),
  ('bayut',            'disconnected', true),
  ('mailchimp',        'disconnected', true),
  ('whatsapp_cloud',   'disconnected', false),
  ('dld_open_data',    'disconnected', true),
  ('docusign',         'disconnected', true),
  ('posthog',          'disconnected', true),
  ('sentry',           'disconnected', true),
  ('resend',           'disconnected', true)
on conflict (kind) do nothing;


-- ═══════════════════════════════════════════════════════════════
-- replayed from 0025_roles_custom.sql
-- ═══════════════════════════════════════════════════════════════
-- 0025_roles_custom.sql
-- Sprint 8 — optional custom roles beyond the staff_role enum.
--
-- The 5 enum values (admin, editor, agent, marketing, support) cover the
-- common cases. For one-offs (e.g. "consultant" with limited write
-- access) we let admins define custom roles backed by a permissions
-- jsonb. is_staff()/is_admin() continue to read from staff.role; this
-- table is purely additive.


create table if not exists public.roles_custom (
  name         text primary key,         -- snake_case identifier
  display_name text not null,
  description  text,
  permissions  jsonb not null default '{}'::jsonb,
    -- Example: { "properties:read": true, "properties:write": false,
    --           "deals:read": true, "enquiries:assign": true }
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists roles_custom_set_updated_at on public.roles_custom;
create trigger roles_custom_set_updated_at before update on public.roles_custom
  for each row execute function public.set_updated_at();

alter table public.roles_custom enable row level security;

drop policy if exists roles_custom_admin_all on public.roles_custom;
create policy roles_custom_admin_all on public.roles_custom
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists roles_custom_staff_select on public.roles_custom;
create policy roles_custom_staff_select on public.roles_custom
  for select to authenticated using (public.is_staff());


-- ═══════════════════════════════════════════════════════════════
-- replayed from 0026_developer_profiles.sql
-- ═══════════════════════════════════════════════════════════════
-- 0026_developer_profiles.sql
-- Sprint 8 — narrative profile for /developers/[slug].
--
-- Sits alongside developers (which holds name/slug/logo/founded_year +
-- aggregate stats jsonb) to carry the long-form editorial fields used
-- on the public profile page.


create table if not exists public.developer_profiles (
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

create index if not exists developer_profiles_published_idx on public.developer_profiles (published_at desc)
  where published_at is not null;

drop trigger if exists developer_profiles_set_updated_at on public.developer_profiles;
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


-- ═══════════════════════════════════════════════════════════════
-- replayed from 0027_enquiry_extras.sql
-- ═══════════════════════════════════════════════════════════════
-- 0027_enquiry_extras.sql
-- Sprint 10 — workflow flags on enquiries.
--
-- ack_sent_at        — when the auto-reply (Sprint 11 Edge Function OR
--                      Sprint 10 fallback cron) fired. Idempotency key.
-- escalated_at       — when enquiry-escalation cron flagged the row
--                      to the manager fallback (60 min unanswered).
-- nurture_day7_at    — valuation_inquiries field analog for valuations
--                      lives on `valuation_inquiries` table; for
--                      enquiries the nurture happens at enquiry close.


alter table public.enquiries
  add column if not exists ack_sent_at  timestamptz,
  add column if not exists escalated_at timestamptz;

create index if not exists enquiries_unacked_idx
  on public.enquiries (created_at)
  where ack_sent_at is null;

create index if not exists enquiries_unescalated_idx
  on public.enquiries (created_at)
  where escalated_at is null and assigned_agent_id is null;

-- Valuation nurture tracking. valuations table doesn't yet exist with
-- this exact name in db/types.ts — guard with conditional via DO block.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'valuation_inquiries'
  ) then
    execute 'alter table public.valuation_inquiries
              add column if not exists nurture_day7_at  timestamptz,
              add column if not exists nurture_day30_at timestamptz';
  end if;
end$$;


-- ═══════════════════════════════════════════════════════════════
-- replayed from 0029_dld_comparables.sql
-- ═══════════════════════════════════════════════════════════════
-- 0029_dld_comparables.sql
-- Sprint 13 — DLD/DMT open-data transactions cache.
--
-- Populated by lib/dld-comparables.importDldComparables() (cron in
-- /api/cron/dld-import). Read by /tools/valuation for the range card.


create table if not exists public.dld_comparables (
  id                uuid primary key default gen_random_uuid(),
  transaction_date  date not null,
  property_type     text not null,
  area_slug         text,
  built_up_ft2      int,
  price_aed         numeric(15, 2) not null,
  bedrooms          int,
  source            text not null default 'dld_open_data',
  imported_at       timestamptz not null default now()
);

create index if not exists dld_comparables_lookup_idx
  on public.dld_comparables (area_slug, property_type, bedrooms, transaction_date desc);
create index if not exists dld_comparables_date_idx
  on public.dld_comparables (transaction_date desc);

alter table public.dld_comparables enable row level security;

-- Public read (the valuation tool uses these); staff-write.
drop policy if exists dld_comparables_public_read on public.dld_comparables;
create policy dld_comparables_public_read on public.dld_comparables
  for select using (true);

drop policy if exists dld_comparables_staff_write on public.dld_comparables;
create policy dld_comparables_staff_write on public.dld_comparables
  for all to authenticated using (public.is_staff()) with check (public.is_staff());


-- ═══════════════════════════════════════════════════════════════
-- replayed from 0030_enquiry_auto_reply_trigger.sql
-- ═══════════════════════════════════════════════════════════════
-- 0030_enquiry_auto_reply_trigger.sql
-- BF-6 — Postgres webhook on `enquiries` INSERT that fires the
-- enquiry-auto-reply Edge Function for sub-minute SLA.
--
-- pg_net is Supabase's extension for outbound HTTP from Postgres. The
-- trigger fires AFTER INSERT (so the row id + timestamps are stable)
-- and posts the standard Supabase webhook payload shape that the
-- Edge Function in supabase/functions/enquiry-auto-reply expects.
--
-- The Edge Function URL is read from `app_settings.functions_base_url`
-- (a one-row config table) so the migration is environment-agnostic —
-- staging + production set their respective values via the dashboard.
--
-- The Sprint 10 /api/cron/enquiry-auto-reply Vercel cron remains as a
-- 1-minute fallback sweep; ack_sent_at idempotency in both code paths
-- makes dual-firing a no-op.


create extension if not exists pg_net;

-- Idempotent one-row config table — set the values via:
--   insert into app_settings (key, value) values
--     ('functions_base_url',
--      'https://<project-ref>.functions.supabase.co')
--   on conflict (key) do update set value = excluded.value;
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_staff_read on public.app_settings;
create policy app_settings_staff_read on public.app_settings
  for select to authenticated using (public.is_staff());

drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Helper that returns the configured functions base url (or NULL).
create or replace function public.functions_base_url()
returns text
language sql stable security definer set search_path = public
as $$
  select value from public.app_settings where key = 'functions_base_url' limit 1;
$$;

-- Trigger function: POSTs the new enquiry row to the Edge Function.
create or replace function public.fire_enquiry_auto_reply()
returns trigger
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_url text;
  v_payload jsonb;
begin
  v_url := public.functions_base_url();
  if v_url is null then
    -- Edge Function not yet wired in this environment — silently noop
    -- so the Sprint 10 cron fallback owns the SLA.
    return new;
  end if;

  v_payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'enquiries',
    'schema', 'public',
    'record', to_jsonb(new),
    'old_record', null
  );

  -- Fire-and-forget. pg_net handles the HTTP off the trigger thread,
  -- so the insert never blocks on the Edge Function response.
  perform net.http_post(
    url := v_url || '/functions/v1/enquiry-auto-reply',
    body := v_payload,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

drop trigger if exists enquiries_auto_reply on public.enquiries;
drop trigger if exists enquiries_auto_reply on public.enquiries;
create trigger enquiries_auto_reply
  after insert on public.enquiries
  for each row execute function public.fire_enquiry_auto_reply();


-- ═══════════════════════════════════════════════════════════════
-- replayed from 0032_otp_codes.sql
-- ═══════════════════════════════════════════════════════════════
-- T1-E: OTP codes for the Valuation lead-gate funnel.
--
-- A short-lived (10-min) verification code we email and/or WhatsApp to a
-- visitor before they receive the advisor-prepared report PDF and we
-- enqueue an enquiries row.  No PII other than the identifier (email or
-- E.164 phone).  Stale rows are purged by a tiny daily cron.
--
-- Apply via Supabase MCP `apply_migration` (project_ref in .mcp.json), then
-- run `npm run db:types` to regenerate `db/types.ts`.


create table if not exists public.otp_codes (
  id            uuid primary key default gen_random_uuid(),
  identifier    text not null,            -- email lower-cased OR E.164 phone
  channel       text not null check (channel in ('email', 'whatsapp')),
  code_hash     text not null,            -- HMAC-SHA256 hex; never store raw
  purpose       text not null,            -- e.g. 'valuation_lead'
  attempts      int  not null default 0,
  max_attempts  int  not null default 5,
  consumed_at   timestamptz,
  expires_at    timestamptz not null,
  ip            text,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index if not exists otp_codes_lookup_idx
  on public.otp_codes (identifier, purpose, expires_at desc)
  where consumed_at is null;
create index if not exists otp_codes_expiry_idx
  on public.otp_codes (expires_at);

alter table public.otp_codes enable row level security;

-- Service role only — no public anon access.  All issue/verify flows go
-- through server actions that use the service-role client.
drop policy if exists otp_codes_service_only on public.otp_codes;
create policy otp_codes_service_only on public.otp_codes
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.otp_codes is
  'Short-lived OTPs for lead-gate flows (Sprint 14 / T1-E).';


-- ═══════════════════════════════════════════════════════════════
-- 0028 reconciliation — property_embeddings + match_properties
-- ═══════════════════════════════════════════════════════════════
-- 0009 created public.property_embeddings as
--     (property_id, embedding, source_text, embedded_at)
-- and that is what the remote database has. 0028 re-declared the same
-- table as
--     (property_id, embedding, model, updated_at)
-- and was never applied, so its CREATE TABLE would fail today.
--
-- Application code targets the 0028 shape:
--   * app/api/cron/embeddings-backfill/route.ts selects `updated_at` and
--     upserts {property_id, embedding, model, updated_at}
--   * lib/concierge/tools.ts calls the match_properties RPC
-- Neither the columns nor the function exist, so the embeddings backfill
-- cron and concierge semantic search are both broken against the live DB.
--
-- Widen the existing table instead of recreating it. The 0009 columns
-- (source_text, embedded_at) are nullable and left in place — dropping
-- them is a separate decision, not a drift fix.

alter table public.property_embeddings
  add column if not exists model      text        not null default 'voyage-3',
  add column if not exists updated_at timestamptz not null default now();

-- 0028's ivfflat index, under 0009's index name if that one already exists.
create index if not exists property_embeddings_ivfflat
  on public.property_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- RPC used by lib/concierge/tools.ts handleSemanticSearch.
create or replace function public.match_properties(
  query_embedding vector(1024),
  match_limit int default 8
)
returns table (property_id uuid, distance float)
language sql stable
as $$
  select pe.property_id, (pe.embedding <=> query_embedding) as distance
  from public.property_embeddings pe
  join public.properties p on p.id = pe.property_id
  where p.status = 'published' and p.deleted_at is null
  order by pe.embedding <=> query_embedding
  limit match_limit;
$$;

grant execute on function public.match_properties(vector, int)
  to anon, authenticated, service_role;

