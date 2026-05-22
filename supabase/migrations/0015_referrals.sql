-- 0015_referrals.sql
-- Sprint 8 — referrals (account → account).
--
-- One referrer can invite many referees via a stable code. We track the
-- status (pending → signed_up → first_deal → paid) and the payout amount
-- in AED. The referrer reads their own row; staff reads all.

set local search_path = public, auth, extensions;

create type public.referral_status as enum (
  'pending',
  'signed_up',
  'first_deal',
  'paid',
  'void'
);

create table public.referrals (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique,
  referrer_account_id  uuid not null references public.accounts(user_id) on delete cascade,
  referee_account_id   uuid references public.accounts(user_id) on delete set null,
  status               public.referral_status not null default 'pending',
  payout_amount_aed    numeric(12, 2) not null default 0,
  notes                text,
  signed_up_at         timestamptz,
  first_deal_at        timestamptz,
  paid_at              timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index referrals_referrer_idx on public.referrals (referrer_account_id);
create index referrals_referee_idx  on public.referrals (referee_account_id);
create index referrals_status_idx   on public.referrals (status);

create trigger referrals_set_updated_at before update on public.referrals
  for each row execute function public.set_updated_at();

alter table public.referrals enable row level security;

-- Referrer reads + updates own rows; referee reads own; staff reads all.
drop policy if exists referrals_referrer_select on public.referrals;
create policy referrals_referrer_select on public.referrals
  for select using (auth.uid() = referrer_account_id);

drop policy if exists referrals_referee_select on public.referrals;
create policy referrals_referee_select on public.referrals
  for select using (auth.uid() = referee_account_id);

drop policy if exists referrals_staff_select on public.referrals;
create policy referrals_staff_select on public.referrals
  for select to authenticated using (public.is_staff());

drop policy if exists referrals_staff_write on public.referrals;
create policy referrals_staff_write on public.referrals
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
