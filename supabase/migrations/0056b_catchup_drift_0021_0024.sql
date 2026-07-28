-- 0056b_catchup_drift_0021_0024.sql
-- Part 2 of 4 of the 0014-0032 schema-drift catch-up.
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
-- Replays: 0021, 0022, 0023, 0024
-- Creates: licenses, api_keys, webhooks, integrations
--
-- Idempotent throughout - enum creation is existence-checked via DO blocks,
-- tables and indexes use IF NOT EXISTS, triggers are dropped before being
-- recreated, and both seed INSERTs carry ON CONFLICT DO NOTHING. Re-running
-- any of these files is a no-op.

set local search_path = public, auth, extensions;

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
