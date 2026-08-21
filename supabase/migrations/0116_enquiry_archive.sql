-- 0116_enquiry_archive.sql
-- Archive for enquiries — a reversible "out of the working set" mark that is
-- orthogonal to the pipeline status.
--
-- Why a nullable timestamp and not a seventh `enquiry_status` value:
-- archiving must not erase where the lead had got to. A lead archived at
-- `offer` has to come back at `offer`, and the Kanban columns ARE the status
-- partition, so a seventh status would demand a seventh column that means
-- something categorically different from the other six.
--
-- `archived_by` duplicates what `audit_log` already records, deliberately:
-- the archive view names who filed it without a second query, while the audit
-- row stays the compliance evidence. Both are written; neither is derived
-- from the other.

set local search_path = public, auth, extensions;

alter table public.enquiries
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid
    references auth.users(id) on delete set null;

-- The inbox is "everything not archived, newest first" on every render, and
-- the archive view is its complement. Two partial indexes, so neither view
-- pays for the other's rows as the archive grows.
create index if not exists enquiries_active_created_idx
  on public.enquiries (created_at desc)
  where archived_at is null;

create index if not exists enquiries_archived_idx
  on public.enquiries (archived_at desc)
  where archived_at is not null;

-- ── Admin-only, enforced in the database ──
--
-- `enquiries_staff_all` (0006) grants every active staff member full DML on
-- this table, and RLS cannot restrict a single column — so the "only an admin
-- archives" rule cannot be written as a policy. A BEFORE UPDATE trigger can,
-- and it is the only form of the rule that survives someone calling PostgREST
-- directly instead of going through the server action.
--
-- `auth.uid() is null` is the service-role path: crons, seeders and future
-- retention jobs have no staff row, and blocking them would break writes that
-- were never the point of this guard.
create or replace function public.enforce_enquiry_archive_admin()
returns trigger
language plpgsql security definer set search_path = public, auth
as $$
begin
  if new.archived_at is distinct from old.archived_at
     and auth.uid() is not null
     and coalesce(public.current_staff_role()::text, '') <> 'admin' then
    raise exception 'Only an admin can archive or restore an enquiry.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists enquiries_archive_admin_only on public.enquiries;
create trigger enquiries_archive_admin_only
  before update on public.enquiries
  for each row execute function public.enforce_enquiry_archive_admin();

-- Trigger functions are fired by the system and never need PostgREST
-- exposure — EXECUTE is checked at CREATE TRIGGER time, not at fire time.
-- Same reasoning as 0038_function_hardening.sql.
revoke execute on function public.enforce_enquiry_archive_admin()
  from public, anon, authenticated;
