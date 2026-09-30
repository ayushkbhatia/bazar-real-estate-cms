-- ───────────────────────────────────────────────────────────────
-- 0138 · Mortgage requests — enums, tables, RLS (docs/mortgage/SPEC.md §3)
--
-- The data model for the mortgage module: Fast Pre-Approval and Mortgage
-- Consultancy requests from the website, and the mortgage team's work on them
-- in the CMS. Functions and triggers are in 0139.
--
-- Deviations from SPEC §3, all recorded in docs/mortgage/IMPLEMENTATION.md:
--
--   · Team membership is `staff.mortgage_role` (head | adviser), not two new
--     `staff_role` values (decision D9). A person keeps their normal role and
--     can also be on the mortgage team, so an admin can be Head of mortgages.
--   · Ids are gen_random_uuid() (this repo's convention), not UUID v7.
--   · Email is stored trimmed and lower-cased as text, not citext.
--   · Additions SPEC leaves out: settings (feature flag, assignment mode, the
--     24-hour promise's working calendar), holidays, adviser working hours,
--     the reference counter, `submission_key` (idempotent submits),
--     `property_ref`, `locale`, `sla_remaining_seconds` (the clock runs on
--     working hours, decision D11, so a pause freezes remaining working time),
--     `mortgage_files.kind` (draft uploads have no document row yet),
--     `mortgage_bank_submissions.package_token_hash`, and
--     `mortgage_consultations.ends_at` (for the double-booking constraint).
--
-- Access: RLS on every table, no policy for `anon`. Signed-in staff can
-- SELECT only while they hold a mortgage role (SPEC §7: admins without one see
-- nothing). Nobody writes through PostgREST directly: writes go through the
-- security-definer functions in 0139, or the service role after the app's own
-- checks, and 0139's triggers hold even against the service role.
-- ───────────────────────────────────────────────────────────────

-- ── Enums ───────────────────────────────────────────────────────

create type public.mortgage_team_role as enum ('head', 'adviser');
create type public.mortgage_service as enum ('consultancy', 'pre_approval');
create type public.mortgage_status as enum (
  'new', 'in_review', 'awaiting_applicant', 'with_banks', 'pre_approved', 'declined',
  'contacted', 'consultation_booked', 'completed'
);
create type public.mortgage_residency as enum ('uae_national', 'uae_resident_expat');
create type public.mortgage_employment as enum ('salaried', 'business_owner');
create type public.mortgage_entry_point as enum (
  'home', 'calculator_preapproval', 'calculator_advisor', 'property_detail',
  'services_menu', 'consult_invite', 'direct'
);
create type public.mortgage_doc_kind as enum (
  'emirates_id', 'passport', 'salary_certificate', 'bank_statements_3m',
  'trade_license', 'bank_statements_12m'
);
create type public.mortgage_doc_state as enum ('to_review', 'accepted', 'reupload_requested');
create type public.mortgage_file_state as enum ('pending', 'active', 'removed');
create type public.mortgage_scan_status as enum ('pending', 'clean', 'infected', 'failed');
create type public.mortgage_reupload_reason as enum (
  'unreadable', 'wrong_document', 'expired', 'period_incomplete', 'pages_missing', 'other'
);
create type public.mortgage_link_purpose as enum ('reupload', 'preapproval_invite');
create type public.mortgage_contact_channel as enum ('call', 'whatsapp', 'email');
create type public.mortgage_contact_outcome as enum (
  'reached', 'no_answer', 'left_message', 'sent', 'received'
);
create type public.mortgage_consult_format as enum ('phone', 'video', 'office');
create type public.mortgage_consult_status as enum ('booked', 'held', 'no_show', 'cancelled');
create type public.mortgage_bank_sub_status as enum ('sent', 'pre_approved', 'declined', 'withdrawn');
create type public.mortgage_rate_type as enum ('fixed', 'variable');
create type public.mortgage_decision as enum ('pre_approved', 'declined');
create type public.mortgage_actor as enum ('applicant', 'staff', 'system', 'bank');
create type public.mortgage_flag as enum ('off', 'staff', 'public');
create type public.mortgage_assignment_mode as enum ('round_robin', 'claim');

-- ── Team membership (D9) ────────────────────────────────────────

alter table public.staff
  add column mortgage_role public.mortgage_team_role;

comment on column public.staff.mortgage_role is
  'Mortgage team membership, separate from role: head (Head of mortgages) or adviser. Null = not on the team. Only team members can open the mortgage module (SPEC §7).';

-- The caller's mortgage role, or null. Shaped like is_staff(): SQL, stable,
-- security definer, so policies can call it without granting SELECT on staff.
create or replace function public.mortgage_role()
returns public.mortgage_team_role
language sql stable security definer set search_path = public
as $$
  select mortgage_role from public.staff
   where user_id = auth.uid() and status = 'active';
$$;

revoke all on function public.mortgage_role() from public, anon;
grant execute on function public.mortgage_role() to authenticated, service_role;

-- ── Settings (single row) ───────────────────────────────────────

create table public.mortgage_settings (
  id                   smallint primary key default 1 check (id = 1),
  -- Feature flag `mortgage_requests`: off = nothing public, staff = signed-in
  -- staff only, public = everyone. Flipped in the CMS, so no deploy.
  flag                 public.mortgage_flag not null default 'off',
  assignment_mode      public.mortgage_assignment_mode not null default 'round_robin',
  round_robin_last_staff_id uuid references public.staff(user_id) on delete set null,
  -- The 24-hour promise runs on working hours (decision D11): a budget of
  -- working time, measured against `working_hours` minus `mortgage_holidays`.
  sla_budget_minutes   integer not null default 1440 check (sla_budget_minutes > 0),
  sla_risk_minutes     integer not null default 240 check (sla_risk_minutes >= 0),
  -- Keys "0" (Sunday) to "6" (Saturday), each a list of ["HH:MM","HH:MM"]
  -- windows in Asia/Dubai time. Defaults are the office hours on /contact on
  -- 28 Sep 2026: Mon–Thu and Sun 09:00–19:00, Fri 09:00–15:00, Sat closed.
  working_hours        jsonb not null default '{
    "0": [["09:00", "19:00"]],
    "1": [["09:00", "19:00"]],
    "2": [["09:00", "19:00"]],
    "3": [["09:00", "19:00"]],
    "4": [["09:00", "19:00"]],
    "5": [["09:00", "15:00"]],
    "6": []
  }'::jsonb,
  link_expiry_days     integer not null default 7 check (link_expiry_days between 1 and 90),
  -- Months to keep files after a request closes. Null until compliance decides (D7).
  retention_months     integer check (retention_months is null or retention_months > 0),
  consultation_minutes integer not null default 20 check (consultation_minutes > 0),
  slot_grid_minutes    integer not null default 30 check (slot_grid_minutes > 0),
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users(id) on delete set null
);

insert into public.mortgage_settings (id) values (1);

create trigger mortgage_settings_set_updated_at before update on public.mortgage_settings
  for each row execute function public.set_updated_at();

-- Days the office is closed. The clock doesn't run on them.
create table public.mortgage_holidays (
  day        date primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

-- ── Partner banks ───────────────────────────────────────────────

create table public.mortgage_partner_banks (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (code ~ '^[A-Z0-9]{2,12}$'),
  name           text not null,
  brand_color    text,
  active         boolean not null default true,
  package_emails text[] not null default '{}',
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

-- ── Requests ────────────────────────────────────────────────────

create table public.mortgage_requests (
  id                     uuid primary key default gen_random_uuid(),
  reference              text not null unique check (reference ~ '^BZM-[0-9]{2}-[0-9]{4,}$'),
  service                public.mortgage_service not null,
  status                 public.mortgage_status not null default 'new',
  -- Applicant details: a snapshot of what was submitted (SPEC §3).
  full_name              text not null check (char_length(full_name) between 2 and 100),
  date_of_birth          date not null,
  mobile_e164            text not null check (mobile_e164 ~ '^\+9715[0-9]{8}$'),
  email                  text not null check (email = lower(btrim(email)) and position('@' in email) > 1),
  residency              public.mortgage_residency not null,
  employment_type        public.mortgage_employment not null,
  entry_point            public.mortgage_entry_point not null default 'direct',
  property_id            uuid references public.properties(id) on delete set null,
  property_ref           text,
  parent_request_id      uuid references public.mortgage_requests(id) on delete set null,
  -- The Idempotency-Key the website sends on submit: a retry returns this row.
  submission_key         uuid unique,
  locale                 text not null default 'en' check (locale in ('en', 'ar')),
  owner_staff_id         uuid references public.staff(user_id) on delete set null,
  assigned_at            timestamptz,
  submitted_at           timestamptz not null default now(),
  first_contact_at       timestamptz,
  -- The 24-hour promise (Fast Pre-Approval only). Written only by 0139's
  -- functions; lib/mortgage-requests/sla.ts does the working-time maths.
  sla_started_at         timestamptz,
  sla_due_at             timestamptz,           -- null while paused
  sla_paused_at          timestamptz,
  sla_paused_seconds     integer not null default 0 check (sla_paused_seconds >= 0), -- wall-clock, for reporting
  sla_remaining_seconds  integer,               -- working time left, frozen while paused
  sla_stopped_at         timestamptz,
  sla_risk_notified_at   timestamptz,
  sla_breach_notified_at timestamptz,
  decision               public.mortgage_decision,
  decided_at             timestamptz,
  decided_by             uuid references public.staff(user_id) on delete set null,
  lead_bank_submission_id uuid,                 -- fk added below, after the table exists
  decision_message       text,
  closed_at              timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint mortgage_requests_status_fits_service check (
    (service = 'pre_approval' and status in
      ('new', 'in_review', 'awaiting_applicant', 'with_banks', 'pre_approved', 'declined'))
    or (service = 'consultancy' and status in
      ('new', 'contacted', 'consultation_booked', 'completed'))
  ),
  constraint mortgage_requests_clock_is_pre_approval_only check (
    service = 'pre_approval' or (sla_started_at is null and sla_due_at is null)
  ),
  constraint mortgage_requests_pause_shape check (
    (sla_paused_at is null and sla_remaining_seconds is null)
    or (sla_paused_at is not null and sla_remaining_seconds is not null and sla_due_at is null)
  )
);

create index mortgage_requests_service_status_idx on public.mortgage_requests (service, status);
create index mortgage_requests_owner_idx on public.mortgage_requests (owner_staff_id);
create index mortgage_requests_due_idx on public.mortgage_requests (sla_due_at)
  where sla_stopped_at is null;
create index mortgage_requests_mobile_idx on public.mortgage_requests (mobile_e164);
create index mortgage_requests_email_idx on public.mortgage_requests (email);
create index mortgage_requests_parent_idx on public.mortgage_requests (parent_request_id)
  where parent_request_id is not null;

create trigger mortgage_requests_set_updated_at before update on public.mortgage_requests
  for each row execute function public.set_updated_at();

create table public.mortgage_consents (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references public.mortgage_requests(id) on delete cascade,
  kind            text not null default 'partner_bank_sharing' check (kind in ('partner_bank_sharing')),
  wording_version text not null,
  wording_text    text not null,
  given_at        timestamptz not null default now(),
  ip              inet,
  user_agent      text,
  withdrawn_at    timestamptz
);
create index mortgage_consents_request_idx on public.mortgage_consents (request_id);

-- One row per required document kind, created at submit.
create table public.mortgage_documents (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.mortgage_requests(id) on delete cascade,
  kind        public.mortgage_doc_kind not null,
  state       public.mortgage_doc_state not null default 'to_review',
  checks      jsonb not null default '{}'::jsonb,
  recorded    jsonb not null default '{}'::jsonb,
  accepted_by uuid references public.staff(user_id) on delete set null,
  accepted_at timestamptz,
  updated_at  timestamptz not null default now(),
  unique (request_id, kind)
);

create trigger mortgage_documents_set_updated_at before update on public.mortgage_documents
  for each row execute function public.set_updated_at();

-- ── Uploads ─────────────────────────────────────────────────────

create table public.mortgage_upload_drafts (
  id                 uuid primary key default gen_random_uuid(),
  token_hash         text not null unique,
  ip                 inet,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null default now() + interval '24 hours',
  claimed_request_id uuid references public.mortgage_requests(id) on delete set null
);
create index mortgage_upload_drafts_expiry_idx on public.mortgage_upload_drafts (expires_at)
  where claimed_request_id is null;

create table public.mortgage_bank_submissions (
  id                 uuid primary key default gen_random_uuid(),
  request_id         uuid not null references public.mortgage_requests(id) on delete cascade,
  bank_id            uuid not null references public.mortgage_partner_banks(id) on delete restrict,
  status             public.mortgage_bank_sub_status not null default 'sent',
  sent_at            timestamptz not null default now(),
  sent_by            uuid references public.staff(user_id) on delete set null,
  package_manifest   jsonb not null default '{}'::jsonb,
  package_token_hash text unique,
  package_expires_at timestamptz,
  responded_at       timestamptz,
  recorded_by        uuid references public.staff(user_id) on delete set null,
  max_amount_aed     numeric(14, 2) check (max_amount_aed is null or max_amount_aed > 0),
  rate_pct           numeric(5, 3) check (rate_pct is null or (rate_pct > 0 and rate_pct < 100)),
  rate_type          public.mortgage_rate_type,
  fixed_years        smallint check (fixed_years is null or fixed_years between 1 and 30),
  valid_until        date,
  reminder_sent_at   timestamptz,
  notes              text,
  unique (request_id, bank_id)
);

alter table public.mortgage_requests
  add constraint mortgage_requests_lead_bank_submission_fkey
  foreign key (lead_bank_submission_id) references public.mortgage_bank_submissions(id)
  on delete set null;

-- Applicant uploads and bank letters. Never overwritten: replacing a file is a
-- new row, and the old one becomes `removed`.
create table public.mortgage_files (
  id                 uuid primary key default gen_random_uuid(),
  draft_id           uuid references public.mortgage_upload_drafts(id) on delete set null,
  document_id        uuid references public.mortgage_documents(id) on delete cascade,
  bank_submission_id uuid references public.mortgage_bank_submissions(id) on delete cascade,
  kind               public.mortgage_doc_kind,
  state              public.mortgage_file_state not null default 'pending',
  storage_key        text not null unique,
  original_name      text not null,
  mime               text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes         bigint not null check (size_bytes > 0),
  page_count         integer check (page_count is null or page_count > 0),
  sha256             text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  scan_status        public.mortgage_scan_status not null default 'pending',
  period_from        date,
  period_to          date,
  upload_round       integer not null default 0 check (upload_round >= 0),
  uploaded_at        timestamptz not null default now(),
  constraint mortgage_files_owner check (
    num_nonnulls(draft_id, document_id, bank_submission_id) >= 1
  ),
  constraint mortgage_files_period_order check (
    period_from is null or period_to is null or period_from <= period_to
  )
);
create index mortgage_files_document_idx on public.mortgage_files (document_id);
create index mortgage_files_draft_idx on public.mortgage_files (draft_id);
create index mortgage_files_bank_submission_idx on public.mortgage_files (bank_submission_id);
create index mortgage_files_scan_pending_idx on public.mortgage_files (uploaded_at)
  where scan_status = 'pending';

-- ── Secure links and re-uploads ─────────────────────────────────

create table public.mortgage_access_links (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.mortgage_requests(id) on delete cascade,
  purpose        public.mortgage_link_purpose not null,
  document_id    uuid references public.mortgage_documents(id) on delete cascade,
  token_hash     text not null unique,
  expires_at     timestamptz not null,
  otp_hash       text,
  otp_expires_at timestamptz,
  otp_attempts   smallint not null default 0 check (otp_attempts >= 0),
  otp_sent_at    timestamptz,
  verified_at    timestamptz,
  used_at        timestamptz,
  revoked_at     timestamptz,
  created_by     uuid references public.staff(user_id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint mortgage_access_links_document_fits_purpose check (
    (purpose = 'reupload') = (document_id is not null)
  )
);
create index mortgage_access_links_request_idx on public.mortgage_access_links (request_id);

create table public.mortgage_reupload_requests (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.mortgage_requests(id) on delete cascade,
  document_id    uuid not null references public.mortgage_documents(id) on delete cascade,
  reason         public.mortgage_reupload_reason not null,
  message        text not null check (char_length(btrim(message)) between 1 and 1000),
  channels       text[] not null check (
    cardinality(channels) >= 1 and channels <@ array['whatsapp', 'email']::text[]
  ),
  requested_by   uuid references public.staff(user_id) on delete set null,
  requested_at   timestamptz not null default now(),
  access_link_id uuid references public.mortgage_access_links(id) on delete set null,
  fulfilled_at   timestamptz,
  cancelled_at   timestamptz
);
create index mortgage_reupload_requests_open_idx on public.mortgage_reupload_requests (request_id)
  where fulfilled_at is null and cancelled_at is null;

-- ── Consultancy ─────────────────────────────────────────────────

create table public.mortgage_contact_attempts (
  id               uuid primary key default gen_random_uuid(),
  request_id       uuid not null references public.mortgage_requests(id) on delete cascade,
  staff_id         uuid references public.staff(user_id) on delete set null, -- null for inbound
  channel          public.mortgage_contact_channel not null,
  outcome          public.mortgage_contact_outcome not null,
  body             text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  occurred_at      timestamptz not null default now()
);
create index mortgage_contact_attempts_request_idx
  on public.mortgage_contact_attempts (request_id, occurred_at desc);

-- Two advisers booking the same slot: the second insert fails on the
-- exclusion constraint (C6). btree_gist lets a gist index compare the uuid.
create extension if not exists btree_gist with schema extensions;

create table public.mortgage_consultations (
  id               uuid primary key default gen_random_uuid(),
  request_id       uuid not null references public.mortgage_requests(id) on delete cascade,
  adviser_staff_id uuid not null references public.staff(user_id),
  format           public.mortgage_consult_format not null,
  starts_at        timestamptz not null,
  duration_minutes integer not null default 20 check (duration_minutes > 0),
  ends_at          timestamptz not null,
  invite_channels  text[] not null default '{}' check (invite_channels <@ array['whatsapp', 'email']::text[]),
  status           public.mortgage_consult_status not null default 'booked',
  created_by       uuid references public.staff(user_id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint mortgage_consultations_ends_after_start check (ends_at > starts_at),
  constraint mortgage_consultations_no_double_booking exclude using gist (
    adviser_staff_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'booked')
);
create index mortgage_consultations_request_idx on public.mortgage_consultations (request_id);

-- Each adviser's weekly hours, for C6's free slots (working hours minus
-- bookings; there is no calendar sync in v1).
create table public.mortgage_adviser_hours (
  staff_id uuid not null references public.staff(user_id) on delete cascade,
  weekday  smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  starts   time not null,
  ends     time not null,
  primary key (staff_id, weekday, starts),
  constraint mortgage_adviser_hours_order check (ends > starts)
);

-- ── Activity and access log ─────────────────────────────────────

-- Append-only: 0139 revokes UPDATE/DELETE/TRUNCATE and adds triggers that
-- reject them for every role, the service role included.
create table public.mortgage_events (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.mortgage_requests(id) on delete cascade,
  actor_kind public.mortgage_actor not null,
  actor_id   uuid,
  type       text not null check (type ~ '^[a-z_]+\.[a-z_]+$'),
  data       jsonb not null default '{}'::jsonb,
  ip         inet,
  created_at timestamptz not null default now()
);
create index mortgage_events_request_idx on public.mortgage_events (request_id, created_at desc);

-- ── Reference numbers ───────────────────────────────────────────

-- BZM-{YY}-{NNNN}: one series for both services, per year, never reused.
create table public.mortgage_reference_counters (
  yy          smallint primary key check (yy between 0 and 99),
  last_number integer not null default 0 check (last_number >= 0)
);

-- ── Row-level security ──────────────────────────────────────────

alter table public.mortgage_settings           enable row level security;
alter table public.mortgage_holidays           enable row level security;
alter table public.mortgage_partner_banks      enable row level security;
alter table public.mortgage_requests           enable row level security;
alter table public.mortgage_consents           enable row level security;
alter table public.mortgage_documents          enable row level security;
alter table public.mortgage_upload_drafts      enable row level security;
alter table public.mortgage_bank_submissions   enable row level security;
alter table public.mortgage_files              enable row level security;
alter table public.mortgage_access_links       enable row level security;
alter table public.mortgage_reupload_requests  enable row level security;
alter table public.mortgage_contact_attempts   enable row level security;
alter table public.mortgage_consultations      enable row level security;
alter table public.mortgage_adviser_hours      enable row level security;
alter table public.mortgage_events             enable row level security;
alter table public.mortgage_reference_counters enable row level security;

-- Nothing for anon, and no direct writes for signed-in users. Supabase's
-- default privileges grant both; take them back so a missing policy is not the
-- only thing standing in the way.
revoke all on
  public.mortgage_settings, public.mortgage_holidays, public.mortgage_partner_banks,
  public.mortgage_requests, public.mortgage_consents, public.mortgage_documents,
  public.mortgage_upload_drafts, public.mortgage_bank_submissions, public.mortgage_files,
  public.mortgage_access_links, public.mortgage_reupload_requests,
  public.mortgage_contact_attempts, public.mortgage_consultations,
  public.mortgage_adviser_hours, public.mortgage_events, public.mortgage_reference_counters
from anon, authenticated;

grant select on
  public.mortgage_settings, public.mortgage_holidays, public.mortgage_partner_banks,
  public.mortgage_requests, public.mortgage_consents, public.mortgage_documents,
  public.mortgage_bank_submissions, public.mortgage_files, public.mortgage_reupload_requests,
  public.mortgage_contact_attempts, public.mortgage_consultations,
  public.mortgage_adviser_hours, public.mortgage_events
to authenticated;

-- The service role (the website's endpoints, crons) is granted explicitly
-- rather than through Supabase's default privileges: newer Supabase images no
-- longer give API roles table access by default, and this module shouldn't
-- depend on which kind of project it lands in. mortgage_events gets no UPDATE
-- or DELETE at all (0139).
grant select, insert, update, delete on
  public.mortgage_settings, public.mortgage_holidays, public.mortgage_partner_banks,
  public.mortgage_requests, public.mortgage_consents, public.mortgage_documents,
  public.mortgage_upload_drafts, public.mortgage_bank_submissions, public.mortgage_files,
  public.mortgage_access_links, public.mortgage_reupload_requests,
  public.mortgage_contact_attempts, public.mortgage_consultations,
  public.mortgage_adviser_hours, public.mortgage_reference_counters
to service_role;
grant select, insert on public.mortgage_events to service_role;

-- The team reads everything in the module (it's a team inbox, SPEC §7).
-- Drafts, links and the counter hold hashes and plumbing: service role only.
create policy mortgage_requests_team_select on public.mortgage_requests
  for select to authenticated using ((select public.mortgage_role()) is not null);
create policy mortgage_consents_team_select on public.mortgage_consents
  for select to authenticated using ((select public.mortgage_role()) is not null);
create policy mortgage_documents_team_select on public.mortgage_documents
  for select to authenticated using ((select public.mortgage_role()) is not null);
create policy mortgage_bank_submissions_team_select on public.mortgage_bank_submissions
  for select to authenticated using ((select public.mortgage_role()) is not null);
create policy mortgage_files_team_select on public.mortgage_files
  for select to authenticated using ((select public.mortgage_role()) is not null);
create policy mortgage_reupload_requests_team_select on public.mortgage_reupload_requests
  for select to authenticated using ((select public.mortgage_role()) is not null);
create policy mortgage_contact_attempts_team_select on public.mortgage_contact_attempts
  for select to authenticated using ((select public.mortgage_role()) is not null);
create policy mortgage_consultations_team_select on public.mortgage_consultations
  for select to authenticated using ((select public.mortgage_role()) is not null);
create policy mortgage_adviser_hours_team_select on public.mortgage_adviser_hours
  for select to authenticated using ((select public.mortgage_role()) is not null);
create policy mortgage_events_team_select on public.mortgage_events
  for select to authenticated using ((select public.mortgage_role()) is not null);

-- Settings, holidays and banks are also readable by admins, who manage the
-- partner banks with the Head of mortgages (SPEC §7) and the flag.
create policy mortgage_settings_select on public.mortgage_settings
  for select to authenticated
  using ((select public.mortgage_role()) is not null or (select public.is_admin()));
create policy mortgage_holidays_select on public.mortgage_holidays
  for select to authenticated
  using ((select public.mortgage_role()) is not null or (select public.is_admin()));
create policy mortgage_partner_banks_select on public.mortgage_partner_banks
  for select to authenticated
  using ((select public.mortgage_role()) is not null or (select public.is_admin()));
