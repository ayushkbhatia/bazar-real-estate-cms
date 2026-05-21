-- 0008_tools.sql
-- Phase 4 (tools): three lightweight tables — one per tool surface.
--
-- · valuation_requests — owner-facing seller intake; advisor reviews and
--   sends a final number. The auto-estimate range is frozen at submission
--   so the advisor and the owner are looking at the same starting point.
-- · mortgage_inquiries — buyer-facing pre-approval handoff. The /tools/
--   mortgage calculator is all client-side maths today; this row only
--   appears when the buyer asks Bazar to start a pre-approval.
-- · comparisons — saved /tools/compare URLs, scoped to the signed-in
--   account. Anon comparisons live in the URL, no row required.
--
-- RLS shape mirrors enquiries:
--   · staff can do everything (catch-all),
--   · the row's account_id (where applicable) can SELECT,
--   · INSERT is open (anon owners may submit a valuation request).

-- ───────────────────────────────────────────────────────────────
-- valuation_requests
-- ───────────────────────────────────────────────────────────────

create type public.valuation_status as enum (
  'pending',     -- submitted, advisor hasn't picked it up yet
  'in_review',   -- advisor is working on the refined number
  'sent',        -- final report emailed to the owner
  'archived'     -- closed without action
);

create type public.valuation_condition as enum (
  'original',
  'lightly_refreshed',
  'renovated',
  'fully_renovated'
);

create type public.valuation_tenancy as enum (
  'vacant',
  'rented_le_6mo',
  'rented_gt_6mo'
);

create type public.valuation_mortgage_state as enum (
  'no',
  'yes_partial'
);

create table public.valuation_requests (
  id                       uuid primary key default gen_random_uuid(),
  account_id               uuid references public.accounts(user_id) on delete set null,

  -- Owner contact
  owner_name               text not null,
  owner_email              text not null,
  owner_phone              text,
  marketing_opt_in         boolean not null default false,

  -- Property location
  area_id                  uuid references public.areas(id) on delete set null,
  address_line             text,
  building_name            text,
  unit_number              text,

  -- Specs
  property_type            public.property_type not null,
  beds                     int not null,
  baths                    int not null,
  built_up_ft2             int,
  floor                    int,

  -- Condition/upgrades/view/furnishing/tenancy/mortgage
  condition                public.valuation_condition,
  upgrades                 text[] not null default '{}',
  furnishing               public.property_furnishing,
  view_description         text,
  tenancy                  public.valuation_tenancy,
  mortgage_state           public.valuation_mortgage_state,

  -- Auto-estimate (computed at submission, frozen for reproducibility)
  estimate_low_aed         numeric(15, 2),
  estimate_mid_aed         numeric(15, 2),
  estimate_high_aed        numeric(15, 2),
  estimate_basis           jsonb,

  -- Advisor review
  status                   public.valuation_status not null default 'pending',
  assigned_advisor_id      uuid references public.staff(user_id) on delete set null,
  advisor_estimate_aed     numeric(15, 2),
  advisor_notes            text,
  reviewed_at              timestamptz,
  sent_at                  timestamptz,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint valuation_requests_beds_ck check (beds between 0 and 50),
  constraint valuation_requests_baths_ck check (baths between 0 and 50),
  constraint valuation_requests_estimate_order_ck check (
    estimate_low_aed is null
    or estimate_high_aed is null
    or estimate_low_aed <= estimate_high_aed
  )
);

create index valuation_requests_status_idx on public.valuation_requests (status);
create index valuation_requests_created_at_idx
  on public.valuation_requests (created_at desc);
create index valuation_requests_advisor_idx
  on public.valuation_requests (assigned_advisor_id);
create index valuation_requests_email_idx
  on public.valuation_requests (lower(owner_email));

create trigger valuation_requests_set_updated_at
  before update on public.valuation_requests
  for each row execute function public.set_updated_at();

alter table public.valuation_requests enable row level security;

drop policy if exists valuation_requests_staff_all on public.valuation_requests;
drop policy if exists valuation_requests_own_select on public.valuation_requests;
drop policy if exists valuation_requests_anon_insert on public.valuation_requests;

create policy valuation_requests_staff_all on public.valuation_requests
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy valuation_requests_own_select on public.valuation_requests
  for select to authenticated using (account_id = auth.uid());

create policy valuation_requests_anon_insert on public.valuation_requests
  for insert with check (true);

-- ───────────────────────────────────────────────────────────────
-- mortgage_inquiries
-- ───────────────────────────────────────────────────────────────

create type public.mortgage_inquiry_status as enum (
  'new',
  'contacted',
  'in_progress',
  'pre_approved',
  'closed'
);

create type public.mortgage_loan_type as enum (
  'fixed',
  'variable',
  'hybrid'
);

create type public.mortgage_buyer_status as enum (
  'uae_resident',
  'non_resident',
  'gcc_national'
);

create table public.mortgage_inquiries (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid references public.accounts(user_id) on delete set null,

  applicant_name      text not null,
  applicant_email     text not null,
  applicant_phone     text,

  property_price_aed  numeric(15, 2) not null,
  down_payment_aed    numeric(15, 2) not null,
  interest_rate_pct   numeric(5, 3) not null,
  term_years          int not null,
  mortgage_type       public.mortgage_loan_type not null,
  buyer_status        public.mortgage_buyer_status not null,
  annual_income_aed   numeric(15, 2),
  notes               text,

  status              public.mortgage_inquiry_status not null default 'new',
  assigned_advisor_id uuid references public.staff(user_id) on delete set null,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint mortgage_inquiries_price_ck check (property_price_aed > 0),
  constraint mortgage_inquiries_down_ck check (
    down_payment_aed >= 0 and down_payment_aed <= property_price_aed
  ),
  constraint mortgage_inquiries_term_ck check (term_years between 1 and 40),
  constraint mortgage_inquiries_rate_ck check (
    interest_rate_pct >= 0 and interest_rate_pct <= 25
  )
);

create index mortgage_inquiries_status_idx on public.mortgage_inquiries (status);
create index mortgage_inquiries_created_at_idx
  on public.mortgage_inquiries (created_at desc);

create trigger mortgage_inquiries_set_updated_at
  before update on public.mortgage_inquiries
  for each row execute function public.set_updated_at();

alter table public.mortgage_inquiries enable row level security;

drop policy if exists mortgage_inquiries_staff_all on public.mortgage_inquiries;
drop policy if exists mortgage_inquiries_own_select on public.mortgage_inquiries;
drop policy if exists mortgage_inquiries_anon_insert on public.mortgage_inquiries;

create policy mortgage_inquiries_staff_all on public.mortgage_inquiries
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy mortgage_inquiries_own_select on public.mortgage_inquiries
  for select to authenticated using (account_id = auth.uid());

create policy mortgage_inquiries_anon_insert on public.mortgage_inquiries
  for insert with check (true);

-- ───────────────────────────────────────────────────────────────
-- comparisons — signed-in users save a /tools/compare URL as a row.
-- Anon users still get the URL, no row needed.
-- ───────────────────────────────────────────────────────────────

create table public.comparisons (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.accounts(user_id) on delete cascade,
  name          text,
  property_ids  uuid[] not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint comparisons_property_ids_len_ck check (
    array_length(property_ids, 1) between 1 and 4
  )
);

create index comparisons_account_idx
  on public.comparisons (account_id, created_at desc);

create trigger comparisons_set_updated_at
  before update on public.comparisons
  for each row execute function public.set_updated_at();

alter table public.comparisons enable row level security;

drop policy if exists comparisons_staff_select on public.comparisons;
drop policy if exists comparisons_own_select on public.comparisons;
drop policy if exists comparisons_own_insert on public.comparisons;
drop policy if exists comparisons_own_update on public.comparisons;
drop policy if exists comparisons_own_delete on public.comparisons;

create policy comparisons_staff_select on public.comparisons
  for select to authenticated using (public.is_staff());

create policy comparisons_own_select on public.comparisons
  for select to authenticated using (auth.uid() = account_id);

create policy comparisons_own_insert on public.comparisons
  for insert to authenticated with check (auth.uid() = account_id);

create policy comparisons_own_update on public.comparisons
  for update to authenticated
  using (auth.uid() = account_id) with check (auth.uid() = account_id);

create policy comparisons_own_delete on public.comparisons
  for delete to authenticated using (auth.uid() = account_id);
