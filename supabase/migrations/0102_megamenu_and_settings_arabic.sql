-- 0102 — Arabic for the navigation chrome and the brand strings.
--
-- These are the two highest-visibility surfaces on the site: the megamenu is
-- mounted on every public page, and the wordmark sits in the header of all of
-- them. They are also the two with a trap each.
--
-- ── Trap 1: the megamenu save is a delete-and-reinsert ────────────────────
--
-- `saveMegamenuTab` deletes every column and tile belonging to a tab and
-- re-inserts them from the payload (_actions.ts:81-82). Anything keyed to a
-- child row by id — a translations side-table, say — is orphaned on the first
-- save, and the orphan is invisible because the English still renders.
--
-- So the Arabic lives in columns on the child rows themselves. It is deleted
-- and re-inserted along with its sibling English, which is exactly the
-- behaviour we want, and the row builders in the action have to carry it or
-- TypeScript complains at the insert.
--
-- ── Trap 2: site_settings has COLUMN-LEVEL grants ─────────────────────────
--
-- 0096/0097 revoked anon's table-wide select and granted named columns. An
-- ungranted column does not fail quietly for that column — it fails the WHOLE
-- PostgREST select, so every public page loses its branding and silently falls
-- back to the code defaults in lib/queries/site-settings.ts. The grant below is
-- not optional bookkeeping; it is the difference between this working and the
-- entire site looking untouched-but-wrong.

-- ── Megamenu ─────────────────────────────────────────────────────────────
alter table public.megamenu_tabs
  add column if not exists label_ar text,
  add column if not exists panel_title_ar text,
  add column if not exists right_column_title_ar text;

alter table public.megamenu_columns
  add column if not exists heading_ar text;

alter table public.megamenu_items
  add column if not exists label_ar text,
  add column if not exists badge_label_ar text;

alter table public.megamenu_featured_tiles
  add column if not exists headline_ar text,
  add column if not exists badge_label_ar text,
  add column if not exists cta_label_ar text;

comment on column public.megamenu_tabs.label_ar is
  'Arabic nav label. Blank falls back to the English in place.';

-- These four tables use table-wide grants plus RLS, so the new columns are
-- readable by whoever could already read the row. No grant needed here —
-- unlike site_settings below.

-- ── Brand strings ────────────────────────────────────────────────────────
alter table public.site_settings
  add column if not exists brand_name_ar text,
  add column if not exists brand_tagline_ar text;

comment on column public.site_settings.brand_name_ar is
  'Arabic wordmark text. Blank falls back to the English in place.';

-- The grant that makes the two columns above readable at all. Without it every
-- anon select on this table returns an error and the public site renders code
-- defaults for branding, contact details and the accent token.
grant select (brand_name_ar, brand_tagline_ar) on public.site_settings to anon;
