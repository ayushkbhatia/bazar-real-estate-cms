-- 0103 — Arabic for area and developer names and blurbs.
--
-- Four columns, and they are worth more than that count suggests: an area name
-- is interpolated into roughly a dozen headings on its own page, joined onto
-- every property and development card, and used in breadcrumb JSON-LD and the
-- OG card. A developer name carries its profile hero and the partner band on
-- every project page. Leaving these English would leave Latin proper nouns
-- scattered through otherwise-Arabic sentences.
--
-- Both tables use table-wide grants plus RLS, so the new columns are readable
-- by whoever could already read the row. No grant statement — site_settings is
-- the only table here with column-level grants (0096/0097/0102).
--
-- areas.name_ar has a second job beyond rendering. It is the canonical Arabic
-- toponym the translation pipeline unmasks into: lib/i18n/mt/mask.ts protects
-- place names as sentinels so a model never re-transliterates "Saadiyat
-- Island" differently on every listing, and this column is what those
-- sentinels resolve to.

alter table public.areas
  add column if not exists name_ar text,
  add column if not exists description_ar text;

alter table public.developers
  add column if not exists name_ar text,
  add column if not exists description_ar text;

comment on column public.areas.name_ar is
  'Canonical Arabic toponym. Also the unmask target for masked place names in the MT pipeline. Blank falls back to the English in place.';

comment on column public.developers.name_ar is
  'Arabic company name. Blank falls back to the English in place.';
