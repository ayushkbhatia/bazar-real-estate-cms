-- 0024_integrations.sql
-- Sprint 8 — integration toggle table.
--
-- One row per third-party integration (Mapbox, Meilisearch, Property
-- Finder, Bayut, Mailchimp, DLD, DocuSign, etc.). Stores config + last
-- sync metadata. The actual *credentials* live in env vars (see
-- lib/env.ts) — `config` holds non-secret tuning (rate limits, dataset
-- IDs, feature toggles).

set local search_path = public, auth, extensions;

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

create type public.integration_status as enum (
  'disconnected',  -- no env keys
  'connected',     -- env keys present + last sync ok
  'error',         -- env keys present but last sync errored
  'paused'         -- admin-disabled
);

create table public.integrations (
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

create index integrations_status_idx on public.integrations (status);

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
