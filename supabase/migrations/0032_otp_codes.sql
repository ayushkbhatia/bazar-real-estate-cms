-- T1-E: OTP codes for the Valuation lead-gate funnel.
--
-- A short-lived (10-min) verification code we email and/or WhatsApp to a
-- visitor before they receive the advisor-prepared report PDF and we
-- enqueue an enquiries row.  No PII other than the identifier (email or
-- E.164 phone).  Stale rows are purged by a tiny daily cron.
--
-- Apply via Supabase MCP `apply_migration` (project_ref in .mcp.json), then
-- run `npm run db:types` to regenerate `db/types.ts`.

set local search_path = public, auth, extensions;

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
