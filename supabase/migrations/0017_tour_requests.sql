-- 0017_tour_requests.sql
-- Sprint 8 — tour requests (a.k.a. site-visit requests).
--
-- /p/[slug] → "Schedule viewing" submits to this table. Different shape
-- from the existing `viewings` table (booked + confirmed slots):
-- tour_requests captures the *interest* + the requested window before
-- staff assigns a slot.

set local search_path = public, auth, extensions;

create type public.tour_request_status as enum (
  'pending',
  'contacted',
  'scheduled',
  'completed',
  'cancelled'
);

create table public.tour_requests (
  id                uuid primary key default gen_random_uuid(),
  property_id       uuid not null references public.properties(id) on delete cascade,
  account_id        uuid references public.accounts(user_id) on delete set null,
  -- Anonymous tour requests capture contact inline:
  full_name         text,
  email             text,
  phone             text,
  preferred_window  text, -- e.g. 'this_weekend', 'weekday_evening'
  message           text,
  status            public.tour_request_status not null default 'pending',
  assigned_agent_id uuid references public.staff(user_id) on delete set null,
  scheduled_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index tour_requests_property_idx  on public.tour_requests (property_id);
create index tour_requests_account_idx   on public.tour_requests (account_id);
create index tour_requests_status_idx    on public.tour_requests (status);
create index tour_requests_created_idx   on public.tour_requests (created_at desc);

create trigger tour_requests_set_updated_at before update on public.tour_requests
  for each row execute function public.set_updated_at();

alter table public.tour_requests enable row level security;

-- Account reads + creates own. Anonymous insert allowed (anon JWT) but
-- without an account_id; staff sees all.
drop policy if exists tour_requests_own_select on public.tour_requests;
create policy tour_requests_own_select on public.tour_requests
  for select using (auth.uid() = account_id);

drop policy if exists tour_requests_anon_insert on public.tour_requests;
create policy tour_requests_anon_insert on public.tour_requests
  for insert with check (account_id is null or auth.uid() = account_id);

drop policy if exists tour_requests_staff_select on public.tour_requests;
create policy tour_requests_staff_select on public.tour_requests
  for select to authenticated using (public.is_staff());

drop policy if exists tour_requests_staff_write on public.tour_requests;
create policy tour_requests_staff_write on public.tour_requests
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
