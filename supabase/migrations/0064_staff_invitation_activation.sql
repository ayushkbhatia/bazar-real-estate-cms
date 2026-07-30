-- 0064_staff_invitation_activation.sql
-- Separate "staff row created" from "invitee has set a password".
--
-- `accepted_at` is set by the on_auth_user_accept_invitation trigger (0010) the
-- moment an auth.users row appears for the invited address — that's what
-- materialises the staff row. It does NOT mean the person can sign in.
--
-- The old invite flow called auth.admin.inviteUserByEmail, which creates the
-- auth user immediately. So the trigger fired, `accepted_at` was stamped, and
-- the invitation looked complete while the invitee still had no password. Both
-- outstanding invitations are in exactly that state: auth user present, staff
-- row present, invitation "accepted", nobody able to log in.
--
-- `activated_at` records the step that actually matters for access: the invitee
-- opened the emailed link and set a password. The accept link is valid while
-- activated_at is null and expires_at is in the future, which makes it
-- single-use without overloading accepted_at.
--
-- Backfill: any invitation whose user already has a password is treated as
-- activated. `encrypted_password` is empty for users created by an invite that
-- was never completed, so the two stuck rows correctly stay activatable.

alter table public.staff_invitations
  add column if not exists activated_at timestamptz;

comment on column public.staff_invitations.activated_at is
  'When the invitee set a password via the accept link. Null means the link is still usable.';

update public.staff_invitations i
set activated_at = i.accepted_at
where i.activated_at is null
  and i.accepted_at is not null
  and exists (
    select 1 from auth.users u
    where lower(u.email) = lower(i.email)
      and u.encrypted_password is not null
      and u.encrypted_password <> ''
  );

-- The accept page looks invitations up by token; that index already exists
-- (staff_invitations_token_idx, 0010). Add the "still usable" partial index the
-- list view filters on.
create index if not exists staff_invitations_pending_activation_idx
  on public.staff_invitations (expires_at)
  where activated_at is null;
