-- 0104 — the rest of the Arabic twin columns.
--
-- One migration for every column still owed a twin, because the DDL is the
-- mechanical half and splitting it across six PRs buys nothing: each column is
-- nullable, additive, and inert until something writes to it. What genuinely
-- needs splitting is the app-side work — an editor input and a read-path fold
-- per table — and that is unaffected by shipping the storage in one go.
--
-- Types follow their English sibling rather than defaulting to text:
-- developments.amenities and staff.specialties are text[], staff.languages is
-- jsonb. A text twin beside a text[] column would typecheck in SQL and then
-- fail the first time anyone saved.
--
-- No grants. site_settings remains the only table in this schema with
-- column-level grants (0096/0097/0102); everything below uses table-wide
-- grants plus RLS.
--
-- dld_comparables.property_type is deliberately NOT here. That table is
-- repopulated by the weekly DLD import, so a twin column would be blank on
-- every new row for ever — the value is a closed vocabulary arriving from an
-- external feed, and it needs a value-to-label map in code, not per-row
-- Arabic. Recorded as `labelMapped` in lib/i18n/domains.ts.

-- ── Catalogue ────────────────────────────────────────────────────────────
alter table public.properties
  add column if not exists address_line_ar text,
  add column if not exists view_ar text,
  add column if not exists orientation_ar text;

alter table public.developments
  add column if not exists name_ar text,
  add column if not exists tagline_ar text,
  add column if not exists description_ar text,
  add column if not exists vision_ar text,
  add column if not exists bedrooms_text_ar text,
  add column if not exists amenities_ar text[];

alter table public.development_unit_types
  add column if not exists label_ar text,
  add column if not exists blurb_ar text;

alter table public.floor_plans
  add column if not exists label_ar text,
  add column if not exists description_ar text;

alter table public.development_units
  add column if not exists unit_type_ar text,
  add column if not exists orientation_ar text,
  add column if not exists lagoon_access_ar text;

alter table public.area_guides
  add column if not exists intro_md_ar text;

alter table public.amenities_taxonomy
  add column if not exists label_ar text;

-- ── Editorial ────────────────────────────────────────────────────────────
alter table public.articles
  add column if not exists title_ar text,
  add column if not exists excerpt_ar text,
  add column if not exists body_html_ar text;

comment on column public.articles.body_html_ar is
  'Arabic article body. Produced by the Tiptap slot walker in lib/i18n/mt/html.ts, which never shows the model a tag.';

alter table public.article_categories
  add column if not exists label_ar text,
  add column if not exists description_ar text;

alter table public.pages
  add column if not exists title_ar text;

alter table public.landing_pages
  add column if not exists title_ar text;

-- ── People, forms and chrome ─────────────────────────────────────────────
alter table public.staff
  add column if not exists display_name_ar text,
  add column if not exists title_ar text,
  add column if not exists bio_ar text,
  add column if not exists specialties_ar text[],
  add column if not exists languages_ar jsonb;

alter table public.form_fields
  add column if not exists label_ar text,
  add column if not exists placeholder_ar text,
  add column if not exists help_ar text,
  add column if not exists unit_ar text;

alter table public.floating_ctas
  add column if not exists label_ar text,
  add column if not exists message_template_ar text,
  add column if not exists subject_template_ar text;
