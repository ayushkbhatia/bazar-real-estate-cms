-- 0065_staff_invitation_purpose.sql
-- Distinguish "join the team" from "set a new password".
--
-- Both need the same thing — a one-time token emailed to a staff address that
-- lets the holder set a password — so both ride on staff_invitations rather
-- than growing a second token table. But they are not the same event:
--
--   · An INVITE is outstanding work: someone was asked to join and hasn't
--     activated. It belongs in the pending-invitations list on Users & roles.
--   · A RESET is an existing team member who needs back in. Showing that as a
--     pending invitation would imply the person isn't on the team yet.
--
-- The column also drives the copy on /staff-invite. Deriving that from the URL
-- would let anyone flip the wording by editing a query param; deriving it from
-- the row means the page says what actually happened.
--
-- Everything that exists today is an invite, which is the default.

alter table public.staff_invitations
  add column if not exists purpose text not null default 'invite';

do $$ begin
  alter table public.staff_invitations
    add constraint staff_invitations_purpose_check
    check (purpose in ('invite', 'reset'));
exception when duplicate_object then null; end $$;

comment on column public.staff_invitations.purpose is
  'invite = new team member joining; reset = existing staff setting a new password.';

-- The pending-invitations list filters on purpose + activated_at.
drop index if exists staff_invitations_pending_activation_idx;
create index if not exists staff_invitations_pending_idx
  on public.staff_invitations (purpose, expires_at)
  where activated_at is null;

-- The unique index from 0010 allows only one row per address while
-- accepted_at is null, which would collide the moment an un-activated invitee
-- was also sent a reset. Scope it to invites: a reset for an address that
-- already has an outstanding invite is a legitimate combination, and both
-- tokens are independently valid until used.
drop index if exists staff_invitations_email_pending_idx;
create unique index if not exists staff_invitations_email_pending_idx
  on public.staff_invitations (lower(email))
  where accepted_at is null and purpose = 'invite';
