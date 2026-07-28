-- 0056d_catchup_drift_0030_0032_0028.sql
-- Part 4 of 4 of the 0014-0032 schema-drift catch-up.
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
-- Replays: 0030, 0032, and the 0028 reconciliation
-- Creates: app_settings, otp_codes, the enquiries auto-reply
-- trigger, and the property_embeddings / match_properties reconciliation
--
-- Idempotent throughout - enum creation is existence-checked via DO blocks,
-- tables and indexes use IF NOT EXISTS, triggers are dropped before being
-- recreated, and both seed INSERTs carry ON CONFLICT DO NOTHING. Re-running
-- any of these files is a no-op.

set local search_path = public, auth, extensions;

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
