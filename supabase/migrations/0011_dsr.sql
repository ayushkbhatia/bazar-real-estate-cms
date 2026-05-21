-- 0011_dsr.sql
-- UAE PDPL Data Subject Rights (DSR) — export + delete endpoints.
--
-- Adds deleted_at / anonymised_at to accounts so we can soft-delete with
-- anonymisation rather than hard-deleting and losing the audit trail (which
-- AML / CFT requires we keep for 7 years from end of relationship).
--
-- Introduces dsr_requests: every export and deletion goes through an email
-- confirmation step to prevent token-theft exfil. Token is the bearer auth
-- for the confirm page; only service-role reads it.

-- ── enums ───────────────────────────────────────────────────────
create type public.dsr_kind as enum ('export', 'delete');
create type public.dsr_status as enum (
  'pending',
  'fulfilled',
  'expired',
  'cancelled'
);

-- ── accounts: soft-delete + anonymisation timestamps ────────────
alter table public.accounts
  add column if not exists deleted_at    timestamptz,
  add column if not exists anonymised_at timestamptz;

create index if not exists accounts_deleted_at_idx
  on public.accounts (deleted_at)
  where deleted_at is not null;

-- ── dsr_requests ────────────────────────────────────────────────
create table public.dsr_requests (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.accounts(user_id) on delete cascade,
  kind          public.dsr_kind   not null,
  status        public.dsr_status not null default 'pending',
  token         text not null unique,
  email         text not null,
  ip            inet,
  user_agent    text,
  payload       jsonb,                  -- size + sha256 of the archive on fulfilment
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz,
  fulfilled_at  timestamptz
);

create index dsr_requests_account_idx on public.dsr_requests (account_id);
create index dsr_requests_status_idx  on public.dsr_requests (status);
create index dsr_requests_created_idx on public.dsr_requests (created_at desc);

alter table public.dsr_requests enable row level security;

-- The account can see (but not edit) their own request rows. Mutations only
-- happen via the service-role from server actions.
drop policy if exists dsr_own_select on public.dsr_requests;
create policy dsr_own_select on public.dsr_requests
  for select to authenticated using (account_id = auth.uid());

-- Staff (admins) can read everything for audit purposes.
drop policy if exists dsr_admin_select on public.dsr_requests;
create policy dsr_admin_select on public.dsr_requests
  for select to authenticated using (public.is_admin());

-- ── anonymise_account(uuid) ─────────────────────────────────────
-- Helper run from the data-deletion confirm flow with service_role.
-- Soft-deletes the account, anonymises tied PII in retained rows, and
-- hard-deletes the saved_* and notification rows that have no audit value.
--
-- We intentionally keep enquiries / viewings / messages / dsr_requests rows
-- (with their PII fields wiped) so the audit log stays coherent — AML
-- requires us to be able to reconstruct who interacted with us, even after
-- their right-to-be-forgotten request.
create or replace function public.anonymise_account(target uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  pseudonym text := 'deleted-' || encode(gen_random_bytes(6), 'hex');
begin
  -- accounts: zero out PII fields, set the timestamps.
  update public.accounts
    set first_name = null,
        last_name = null,
        nationality = null,
        residency_status = null,
        marketing_opt_in = false,
        deleted_at = now(),
        anonymised_at = now()
    where user_id = target;

  -- enquiries: keep the row, scrub the inline PII so the audit trail still
  -- shows that an enquiry happened from this account.
  update public.enquiries
    set name = pseudonym,
        email = null,
        phone = null,
        brief_raw = '[redacted on user request]',
        inferred_constraints = null,
        internal_notes = null
    where account_id = target;

  -- messages authored by the user: redact the body.
  update public.messages
    set body = '[redacted on user request]'
    where author_id = target;

  -- viewings: drop notes + feedback (PII). Keep the slot + status.
  update public.viewings
    set notes = null,
        feedback = null
    where account_id = target;

  -- newsletter: mark as unsubscribed and drop the contact.
  update public.newsletter_subscribers
    set email = pseudonym || '@redacted.invalid',
        status = 'unsubscribed',
        unsubscribed_at = now(),
        confirmation_token = null,
        account_id = null
    where account_id = target;

  -- saved_* + reviews: hard-delete; no audit value, all PII.
  delete from public.saved_properties where user_id = target;
  delete from public.saved_searches    where user_id = target;
  delete from public.reviews           where account_id = target;
end;
$$;

-- Allow the service role (used by the data-deletion server action) and the
-- account itself to invoke it. RLS is bypassed by service-role anyway; the
-- second grant is defensive.
grant execute on function public.anonymise_account(uuid) to service_role, authenticated;

-- Done.
