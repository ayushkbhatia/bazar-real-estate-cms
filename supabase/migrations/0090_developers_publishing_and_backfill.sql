-- 0090_developers_publishing_and_backfill.sql
-- Developers: give the catalogue a publish state, and a row per shipped partner.
--
-- Two problems, one cause. `/developers` renders the code-owned directory in
-- `lib/developers/directory-data.ts` merged with the `developers` table, but
-- only 12 of the 30 shipped partners have a row. The other 18 — Arada, Emaar,
-- DAMAC and the rest — are visible on the public grid and absent from
-- /admin/pages/sub/developer, because there is nothing in the database to
-- list. Nothing about them is editable.
--
-- And the catalogue has no publish state at all, so "unpublish this developer"
-- has nowhere to write.
--
-- Idempotent: the column is added only if missing, and every insert is guarded
-- on both slug and normalised name.

-- ── 1. Publish state ──────────────────────────────────────────────────
alter table public.developers
  add column if not exists published_at timestamptz;

comment on column public.developers.published_at is
  'Null means draft: the developer is hidden from /developers, its profile 404s, and it leaves the sitemap. It stays pickable in the CMS so existing listings keep their attribution.';

-- Everything that exists today is already public, so it stays public. Using
-- created_at rather than now() keeps the ordering meaningful if anything ever
-- sorts on it.
update public.developers
set published_at = created_at
where published_at is null;

-- ── 2. A row for every shipped partner ────────────────────────────────
-- Guarded twice. `slug` catches the obvious case; the normalised-name check
-- catches the one that actually bites — the two sources disagree about slugs
-- for companies they both carry (`modon` ships, `modon-properties` is the row),
-- so a slug-only guard would insert a second MODON and split its projects
-- across two rows with no merge tool to undo it.
--
-- The expression mirrors `slugify()` in lib/slug.ts closely enough to be a
-- guard: lowercase, non-alphanumerics to hyphens, trimmed. A false match skips
-- an insert, which is the safe direction to fail.
insert into public.developers (name, slug, description, published_at)
select v.name, v.slug, v.description, now()
from (
  values
    ('Arada', 'arada', 'Destination communities across the UAE.'),
    ('Baraka', 'baraka', 'Modern, lifestyle-led residential developments.'),
    ('Binghatti', 'binghatti', 'Bold, branded residential towers in Dubai.'),
    ('Bloom Holding', 'bloom', 'Curated residential communities.'),
    ('Burtville Developments', 'burtville', 'Premium Abu Dhabi residential projects.'),
    ('DAMAC', 'damac', 'Premium branded residences across the UAE.'),
    ('Deyaar', 'deyaar', 'Dubai residential & hospitality developments.'),
    ('Dubai Properties', 'dubai-properties', 'Established Dubai master communities.'),
    ('Emaar', 'emaar', 'Iconic master-planned communities.'),
    ('ICT Real Estate', 'ict', 'Waterfront residential living.'),
    ('Meraas', 'meraas', 'Lifestyle destinations across Dubai.'),
    ('Miral', 'miral', 'Abu Dhabi''s leisure & destination developer — Yas Island.'),
    ('Nakheel', 'nakheel', 'Iconic waterfront communities.'),
    ('Nine Yards', 'nine-yards', 'Luxury projects in iconic locations.'),
    ('NIC Developers', 'nic-developers', 'Residential & mixed-use developments.'),
    ('Nshama', 'nshama', 'Developer behind the Town Square community.'),
    ('Q Properties', 'q-properties', 'Reem-focused tower specialist.'),
    ('Reportage Properties', 'reportage', 'Off-plan residential communities.'),
    ('SAAS Properties', 'saas-properties', 'Residential & commercial developments.'),
    ('Samana Developers', 'samana', 'Investor-focused off-plan projects.')
) as v(name, slug, description)
where not exists (
  select 1 from public.developers d where d.slug = v.slug
)
and not exists (
  select 1 from public.developers d
  where trim(both '-' from lower(regexp_replace(d.name, '[^a-zA-Z0-9]+', '-', 'g')))
      = trim(both '-' from lower(regexp_replace(v.name, '[^a-zA-Z0-9]+', '-', 'g')))
);

-- ── 3. Index the publish filter ───────────────────────────────────────
-- Every public read of this table now carries `published_at is not null`.
create index if not exists developers_published_at_idx
  on public.developers (published_at)
  where published_at is not null;
