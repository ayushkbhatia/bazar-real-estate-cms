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

set local search_path = public, auth, extensions;

create type public.bulk_action_kind as enum (
  'bulk_update',
  'bulk_publish',
  'bulk_off_market',
  'bulk_reassign',
  'bulk_archive'
);

create table public.bulk_operations (
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

create index bulk_operations_created_idx on public.bulk_operations (created_at desc);
create index bulk_operations_actor_idx   on public.bulk_operations (actor_id);
create index bulk_operations_action_idx  on public.bulk_operations (action);

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
