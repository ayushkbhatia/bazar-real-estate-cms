-- 0023_webhooks.sql
-- Sprint 8 — outbound webhooks for partner integrations.
--
-- The dispatch loop signs each payload with the shared secret using
-- HMAC-SHA256 and posts to target_url. Failures get a row in the
-- (separate) `webhook_deliveries` ledger — Sprint 13 ships that ledger
-- alongside Mailchimp / DocuSign signature verification.

set local search_path = public, auth, extensions;

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

create type public.webhook_status as enum (
  'active',
  'paused',
  'failing'  -- > 5 consecutive 5xx → paused via cron
);

create table public.webhooks (
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

create index webhooks_status_idx on public.webhooks (status);
create index webhooks_events_gin on public.webhooks using gin (events);

create trigger webhooks_set_updated_at before update on public.webhooks
  for each row execute function public.set_updated_at();

alter table public.webhooks enable row level security;

drop policy if exists webhooks_admin_all on public.webhooks;
create policy webhooks_admin_all on public.webhooks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
