-- 0165 · Mortgage Admin: a staff role that sees the mortgage module and
-- nothing else.
--
--   · `staff_role` gains `mortgage_admin`. It is chosen like any other role,
--     when an admin invites someone or changes their role at /admin/users.
--   · A Mortgage Admin is always Head of mortgages (`mortgage_role = 'head'`):
--     a trigger sets it when the role is given and clears it when the role is
--     taken away, so the two can't drift apart. Before this, a mortgage role
--     could only be granted in SQL (RUNBOOK §6); this is the one app path, and
--     it is admin-only (`staff_admin_all`, `inviteStaff`).
--   · `is_staff()` no longer counts a Mortgage Admin, so every policy built on
--     it (enquiries, properties, media writes, the newsletter …) refuses them.
--     The mortgage module never asked `is_staff()`: its policies and functions
--     ask `mortgage_role()`, and `staff` and `notifications` are readable on
--     their own terms. The CMS hides the rest of the admin from them too, but
--     the database is the boundary.
--   · SR-14's audit trigger used to fire only on `update of mortgage_role`.
--     A column-list trigger ignores what a BEFORE trigger changes, so a role
--     change that moved `mortgage_role` would have gone unaudited. It now
--     fires on every update and still writes only when the value changed.

alter type public.staff_role add value if not exists 'mortgage_admin';

-- The new label can't be used as an enum literal in the transaction that adds
-- it, so these compare `role::text`.

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.staff
      where user_id = auth.uid()
        and status = 'active'
        and role::text <> 'mortgage_admin'
  );
$$;

create function public.staff_mortgage_admin_role()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.role::text = 'mortgage_admin' then
    if new.mortgage_role is distinct from 'head' then
      new.mortgage_role := 'head';
      if coalesce(current_setting('mortgage.audit_note', true), '') = '' then
        perform set_config('mortgage.audit_note', 'given the Mortgage Admin role', true);
      end if;
    end if;
  elsif tg_op = 'UPDATE'
    and old.role::text = 'mortgage_admin'
    and new.mortgage_role is not distinct from old.mortgage_role then
    new.mortgage_role := null;
    if coalesce(current_setting('mortgage.audit_note', true), '') = '' then
      perform set_config('mortgage.audit_note', 'left the Mortgage Admin role', true);
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.staff_mortgage_admin_role() from public, anon, authenticated;

create trigger staff_mortgage_admin_role
  before insert or update of role, mortgage_role on public.staff
  for each row execute function public.staff_mortgage_admin_role();

drop trigger staff_mortgage_role_audit on public.staff;
create trigger staff_mortgage_role_audit
  after insert or update on public.staff
  for each row execute function public.staff_mortgage_role_audit();
