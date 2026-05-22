-- 0020_property_extras.sql
-- Sprint 8 — additive columns on public.properties.
--
-- bazar_verified         — "Bazar Verified" trust badge on cards + detail.
-- advisor_note           — Mariam's-voice contextual note rendered on /p/[slug].
-- featured_on_homepage   — homepage feature slot (independent of `featured` jsonb flags).
-- sold_at                — when set, /p/[slug] redirects to /sold/[ref] (410 Gone).
--
-- All four are nullable / default-falsy so the migration is safe to apply
-- on an existing properties table without backfill.

set local search_path = public, auth, extensions;

alter table public.properties
  add column if not exists bazar_verified       boolean      not null default false,
  add column if not exists advisor_note         text,
  add column if not exists featured_on_homepage boolean      not null default false,
  add column if not exists sold_at              timestamptz;

create index if not exists properties_featured_homepage_idx
  on public.properties (featured_on_homepage)
  where featured_on_homepage = true and deleted_at is null;

create index if not exists properties_sold_idx
  on public.properties (sold_at)
  where sold_at is not null;

create index if not exists properties_verified_idx
  on public.properties (bazar_verified)
  where bazar_verified = true and status = 'published' and deleted_at is null;
