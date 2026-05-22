-- 0029_dld_comparables.sql
-- Sprint 13 — DLD/DMT open-data transactions cache.
--
-- Populated by lib/dld-comparables.importDldComparables() (cron in
-- /api/cron/dld-import). Read by /tools/valuation for the range card.

set local search_path = public, auth, extensions;

create table public.dld_comparables (
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

create index dld_comparables_lookup_idx
  on public.dld_comparables (area_slug, property_type, bedrooms, transaction_date desc);
create index dld_comparables_date_idx
  on public.dld_comparables (transaction_date desc);

alter table public.dld_comparables enable row level security;

-- Public read (the valuation tool uses these); staff-write.
drop policy if exists dld_comparables_public_read on public.dld_comparables;
create policy dld_comparables_public_read on public.dld_comparables
  for select using (true);

drop policy if exists dld_comparables_staff_write on public.dld_comparables;
create policy dld_comparables_staff_write on public.dld_comparables
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
