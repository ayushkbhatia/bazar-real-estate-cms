-- 0134 · Error reporting and job heartbeats, owned rather than rented.
--
-- Almost every `catch` in this codebase is deliberately quiet: the audit-log
-- write that must not block the operation it records, the submission log that
-- must not turn a captured lead into an error screen, the eight cron routes
-- that return 500 to a scheduler nobody watches. Every one of those ends in a
-- `Sentry.captureException`, and production has never had a DSN — so all of
-- them have been silent drops.
--
-- These two tables replace the vendor for the part this product actually
-- uses, which is not the clever part: remember the error, group it, show it.
--
-- ── error_events ────────────────────────────────────────────────────────
-- One row per DISTINCT problem, not per occurrence. `fingerprint` is derived
-- in lib/observability.ts from the source plus a normalised message — ids,
-- numbers and quoted values stripped — so "lead a04X failed" and "lead a04Y
-- failed" are one row with a count of two, not two rows. Without that a
-- five-minute cron failing all night is 288 rows nobody reads.
--
-- ── cron_heartbeats ─────────────────────────────────────────────────────
-- The thing that makes the arrangement trustworthy without email. A digest is
-- itself a cron, so if the scheduler dies the job that would tell you also
-- dies. A heartbeat inverts that: each job stamps its own row on every run,
-- and "nothing has stamped in three hours" is visible the moment an admin
-- opens the page, with nothing needing to have fired.

create table public.error_events (
  id             uuid primary key default gen_random_uuid(),
  fingerprint    text not null unique,
  -- Where it happened: 'cron/salesforce-lead-sync', 'forms/record', 'audit'.
  source         text not null,
  level          text not null default 'error'
                   check (level in ('error', 'warning')),
  message        text not null,
  -- Tags and context as the call site passed them, plus a stack when there
  -- was one. Deliberately unstructured: the shape differs per call site and
  -- this is read by a human, not queried.
  context        jsonb not null default '{}'::jsonb,
  count          integer not null default 1,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  -- Set when someone marks it handled. A later occurrence clears it again —
  -- an issue that comes back is not resolved, and silently keeping it hidden
  -- is how a recurring failure stays invisible.
  resolved_at    timestamptz,
  resolved_by    uuid references auth.users(id) on delete set null
);

-- The admin screen's only query: unresolved, most recently seen first.
create index error_events_open_idx
  on public.error_events (last_seen_at desc)
  where resolved_at is null;

create index error_events_source_idx on public.error_events (source);

create table public.cron_heartbeats (
  job            text primary key,
  last_run_at    timestamptz not null default now(),
  last_ok        boolean not null default true,
  -- One line the operator reads: "pushed 3, blocked 1" or the error.
  last_detail    text,
  -- Cheap trend without a second table: how many consecutive runs failed.
  consecutive_failures integer not null default 0
);

alter table public.error_events enable row level security;
alter table public.cron_heartbeats enable row level security;

-- Staff can see that something is wrong; only an admin can call it handled.
-- Writes come from the service-role client in the cron routes and the
-- reporter, which bypasses RLS — no policy grants insert to anyone else,
-- deliberately, so nothing can forge an error row.
create policy error_events_staff_read on public.error_events
  for select to authenticated using (public.is_staff());

create policy error_events_admin_update on public.error_events
  for update to authenticated using (public.is_admin())
  with check (public.is_admin());

create policy cron_heartbeats_staff_read on public.cron_heartbeats
  for select to authenticated using (public.is_staff());

comment on table public.error_events is
  'Deduplicated application errors. Replaces Sentry for the server-side explicit captures; see lib/observability.ts.';
comment on column public.error_events.fingerprint is
  'Stable hash of source + normalised message. Groups occurrences of the same problem into one row.';
comment on table public.cron_heartbeats is
  'Last run per scheduled job. "Nothing has stamped recently" is how a dead scheduler is detected without relying on a job to report it.';

-- ── record_error_event ──────────────────────────────────────────────────
-- Upsert-with-increment as one statement.
--
-- Doing this as read-then-write in the application would lose occurrences the
-- moment two cron invocations hit the same failure together, and a count that
-- under-reports is worse than no count — it makes a storm look like a blip.
-- `on conflict` also means the first sighting and the thousandth take exactly
-- the same path.
--
-- A recurrence clears `resolved_at`. An issue somebody marked handled and
-- which then came back is not handled, and keeping it hidden is precisely how
-- a recurring failure stays invisible.
create or replace function public.record_error_event(
  p_fingerprint text,
  p_source      text,
  p_level       text,
  p_message     text,
  p_context     jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.error_events
    (fingerprint, source, level, message, context)
  values
    (p_fingerprint, p_source, p_level, p_message, coalesce(p_context, '{}'::jsonb))
  on conflict (fingerprint) do update
    set count        = public.error_events.count + 1,
        last_seen_at = now(),
        -- Keep the newest context: the most recent occurrence is the one an
        -- operator is about to go and look at.
        context      = coalesce(excluded.context, public.error_events.context),
        message      = excluded.message,
        resolved_at  = null,
        resolved_by  = null;
$$;

create or replace function public.record_cron_heartbeat(
  p_job    text,
  p_ok     boolean,
  p_detail text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.cron_heartbeats (job, last_run_at, last_ok, last_detail,
                                      consecutive_failures)
  values (p_job, now(), p_ok, p_detail, case when p_ok then 0 else 1 end)
  on conflict (job) do update
    set last_run_at = now(),
        last_ok     = excluded.last_ok,
        last_detail = excluded.last_detail,
        consecutive_failures = case
          when excluded.last_ok then 0
          else public.cron_heartbeats.consecutive_failures + 1
        end;
$$;

-- Both are called through the service-role client only. Revoking the public
-- grants keeps an authenticated session from forging an error row or a
-- heartbeat, which the RLS policies above deliberately do not allow either.
revoke all on function public.record_error_event(text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_error_event(text, text, text, text, jsonb)
  to service_role;

revoke all on function public.record_cron_heartbeat(text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.record_cron_heartbeat(text, boolean, text)
  to service_role;
