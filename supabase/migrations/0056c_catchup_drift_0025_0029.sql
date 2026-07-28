-- 0056c_catchup_drift_0025_0029.sql
-- Part 3 of 4 of the 0014-0032 schema-drift catch-up.
--
-- The remote database had migrations 0001-0013 and 0031+ applied, but the
-- 0014-0032 block was skipped entirely, leaving 15 tables and 4 columns
-- missing while application code already referenced them. The advisor_note
-- failure in the property editor was one symptom; 0020 was applied
-- out-of-band to unblock it.
--
-- Applied to the remote database as four separate migrations rather than
-- one, because the combined file is ~50KB. These four files mirror the
-- ledger entries 0056a-0056d exactly. Order matters: apply a, b, c, d.
--
-- Replays: 0025, 0026, 0027, 0029
-- Creates: roles_custom, developer_profiles, dld_comparables,
-- plus enquiries.ack_sent_at / escalated_at
--
-- Idempotent throughout - enum creation is existence-checked via DO blocks,
-- tables and indexes use IF NOT EXISTS, triggers are dropped before being
-- recreated, and both seed INSERTs carry ON CONFLICT DO NOTHING. Re-running
-- any of these files is a no-op.

set local search_path = public, auth, extensions;

-- ═══════════════════════════════════════════════════════════════
-- replayed from 0025_roles_custom.sql
-- ═══════════════════════════════════════════════════════════════
-- 0025_roles_custom.sql
-- Sprint 8 — optional custom roles beyond the staff_role enum.
--
-- The 5 enum values (admin, editor, agent, marketing, support) cover the
-- common cases. For one-offs (e.g. "consultant" with limited write
-- access) we let admins define custom roles backed by a permissions
-- jsonb. is_staff()/is_admin() continue to read from staff.role; this
-- table is purely additive.


create table if not exists public.roles_custom (
  name         text primary key,         -- snake_case identifier
  display_name text not null,
  description  text,
  permissions  jsonb not null default '{}'::jsonb,
    -- Example: { "properties:read": true, "properties:write": false,
    --           "deals:read": true, "enquiries:assign": true }
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists roles_custom_set_updated_at on public.roles_custom;
create trigger roles_custom_set_updated_at before update on public.roles_custom
  for each row execute function public.set_updated_at();

alter table public.roles_custom enable row level security;

drop policy if exists roles_custom_admin_all on public.roles_custom;
create policy roles_custom_admin_all on public.roles_custom
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists roles_custom_staff_select on public.roles_custom;
create policy roles_custom_staff_select on public.roles_custom
  for select to authenticated using (public.is_staff());


-- ═══════════════════════════════════════════════════════════════
-- replayed from 0026_developer_profiles.sql
-- ═══════════════════════════════════════════════════════════════
-- 0026_developer_profiles.sql
-- Sprint 8 — narrative profile for /developers/[slug].
--
-- Sits alongside developers (which holds name/slug/logo/founded_year +
-- aggregate stats jsonb) to carry the long-form editorial fields used
-- on the public profile page.


create table if not exists public.developer_profiles (
  developer_id     uuid primary key references public.developers(id) on delete cascade,
  bio              text,
  founded          int,                       -- mirrors developers.founded_year for convenience
  headquarters     text,
  website          text,
  awards           jsonb not null default '[]'::jsonb,
    -- [{ name, year, body }]
  signature_styles text[] not null default '{}',
  current_focus    text,
  hero_image_id    uuid references public.media_assets(id) on delete set null,
  seo              jsonb,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists developer_profiles_published_idx on public.developer_profiles (published_at desc)
  where published_at is not null;

drop trigger if exists developer_profiles_set_updated_at on public.developer_profiles;
create trigger developer_profiles_set_updated_at before update on public.developer_profiles
  for each row execute function public.set_updated_at();

alter table public.developer_profiles enable row level security;

drop policy if exists developer_profiles_public_read on public.developer_profiles;
create policy developer_profiles_public_read on public.developer_profiles
  for select using (published_at is not null);

drop policy if exists developer_profiles_staff_select on public.developer_profiles;
create policy developer_profiles_staff_select on public.developer_profiles
  for select to authenticated using (public.is_staff());

drop policy if exists developer_profiles_staff_write on public.developer_profiles;
create policy developer_profiles_staff_write on public.developer_profiles
  for all to authenticated using (public.is_staff()) with check (public.is_staff());


-- ═══════════════════════════════════════════════════════════════
-- replayed from 0027_enquiry_extras.sql
-- ═══════════════════════════════════════════════════════════════
-- 0027_enquiry_extras.sql
-- Sprint 10 — workflow flags on enquiries.
--
-- ack_sent_at        — when the auto-reply (Sprint 11 Edge Function OR
--                      Sprint 10 fallback cron) fired. Idempotency key.
-- escalated_at       — when enquiry-escalation cron flagged the row
--                      to the manager fallback (60 min unanswered).
-- nurture_day7_at    — valuation_inquiries field analog for valuations
--                      lives on `valuation_inquiries` table; for
--                      enquiries the nurture happens at enquiry close.


alter table public.enquiries
  add column if not exists ack_sent_at  timestamptz,
  add column if not exists escalated_at timestamptz;

create index if not exists enquiries_unacked_idx
  on public.enquiries (created_at)
  where ack_sent_at is null;

create index if not exists enquiries_unescalated_idx
  on public.enquiries (created_at)
  where escalated_at is null and assigned_agent_id is null;

-- Valuation nurture tracking. valuations table doesn't yet exist with
-- this exact name in db/types.ts — guard with conditional via DO block.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'valuation_inquiries'
  ) then
    execute 'alter table public.valuation_inquiries
              add column if not exists nurture_day7_at  timestamptz,
              add column if not exists nurture_day30_at timestamptz';
  end if;
end$$;


-- ═══════════════════════════════════════════════════════════════
-- replayed from 0029_dld_comparables.sql
-- ═══════════════════════════════════════════════════════════════
-- 0029_dld_comparables.sql
-- Sprint 13 — DLD/DMT open-data transactions cache.
--
-- Populated by lib/dld-comparables.importDldComparables() (cron in
-- /api/cron/dld-import). Read by /tools/valuation for the range card.


create table if not exists public.dld_comparables (
  id                uuid primary key default gen_random_uuid(),
  transaction_date  date not null,
  property_type     text not null,
  area_slug         text,
  built_up_ft2      int,
  price_aed         numeric(15, 2) not null,
  bedrooms          int,
  source            text not null default 'dld_open_data',
  imported_at       timestamptz not null default now()
);

create index if not exists dld_comparables_lookup_idx
  on public.dld_comparables (area_slug, property_type, bedrooms, transaction_date desc);
create index if not exists dld_comparables_date_idx
  on public.dld_comparables (transaction_date desc);

alter table public.dld_comparables enable row level security;

-- Public read (the valuation tool uses these); staff-write.
drop policy if exists dld_comparables_public_read on public.dld_comparables;
create policy dld_comparables_public_read on public.dld_comparables
  for select using (true);

drop policy if exists dld_comparables_staff_write on public.dld_comparables;
create policy dld_comparables_staff_write on public.dld_comparables
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
