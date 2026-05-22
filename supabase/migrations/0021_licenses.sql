-- 0021_licenses.sql
-- Sprint 8 — RERA / DMT / DLD licensing records.
--
-- ORN: Office Registration Number (firm-level, one per Bazar).
-- BRN: Broker Registration Number (per agent).
-- Trakheesi: Dubai economic-permit number (per listing — but stored here
-- only when it's a *carried* permit; per-listing `listing_permit_no` on
-- properties remains the source of truth for individual listings).

set local search_path = public, auth, extensions;

create type public.license_kind as enum (
  'orn',         -- Office Registration Number
  'brn',         -- Broker Registration Number
  'trakheesi',   -- DLD listing permit (carried/general)
  'rera',        -- RERA training certification
  'dmt'          -- Department of Municipalities & Transport
);

create type public.license_holder_kind as enum (
  'firm',        -- Bazar entity-level
  'staff',       -- specific agent
  'development'  -- per off-plan project
);

create type public.license_status as enum (
  'active',
  'expiring_soon',  -- < 30 days to expires_at
  'expired',
  'revoked'
);

create table public.licenses (
  id            uuid primary key default gen_random_uuid(),
  kind          public.license_kind not null,
  holder_kind   public.license_holder_kind not null,
  holder_id     uuid, -- staff.user_id, developments.id, or null for 'firm'
  number        text not null,
  issued_at     date,
  expires_at    date not null,
  file_id       uuid references public.media_assets(id) on delete set null,
  status        public.license_status not null default 'active',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index licenses_kind_idx        on public.licenses (kind);
create index licenses_holder_idx      on public.licenses (holder_kind, holder_id);
create index licenses_expires_idx     on public.licenses (expires_at);
create index licenses_status_idx      on public.licenses (status);
create unique index licenses_unique_number_idx on public.licenses (kind, number);

create trigger licenses_set_updated_at before update on public.licenses
  for each row execute function public.set_updated_at();

alter table public.licenses enable row level security;

-- Staff read; admin write (license records are sensitive).
drop policy if exists licenses_staff_select on public.licenses;
create policy licenses_staff_select on public.licenses
  for select to authenticated using (public.is_staff());

drop policy if exists licenses_admin_write on public.licenses;
create policy licenses_admin_write on public.licenses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- An agent can see their own BRN even if they are not admin.
drop policy if exists licenses_own_select on public.licenses;
create policy licenses_own_select on public.licenses
  for select using (
    holder_kind = 'staff' and holder_id = auth.uid()
  );
