-- 0122_site_settings_unit_labels.sql
-- The currency and area-unit dictionary, editable from the CMS.
--
-- WHAT THIS REPLACES
-- Three constants in lib/preferences/types.ts (CURRENCY_SYMBOL, CURRENCY_LABEL,
-- AREA_UNIT_LABEL), a hard-coded ternary in areaUnitLabel(), and a scattering of
-- "ft²" typed straight into components. All of them English, on a site that now
-- serves /ar. The machine-translation pipeline deliberately MASKS "AED" and
-- "ft²" so an editor's prose keeps them intact (lib/i18n/mt/mask.ts) — correct
-- for a sentence somebody wrote, useless for a glyph the code emits, because
-- there is no sentence and no editor to ask.
--
-- One jsonb column rather than columns per word, matching `arabic_fonts` (0120)
-- and `mortgage` (0107) beside it: read whole, written whole, validated by a zod
-- schema (lib/schemas/unit-labels.ts) that treats every key as optional, so a bag
-- written before a currency existed still parses.
--
-- SHAPE (unitLabelSettingsSchema is the authority)
--   {
--     "ar": {
--       "currency":     { "AED": "درهم",         "USD": "دولار" },
--       "currencyLong": { "AED": "درهم إماراتي", "USD": "دولار أمريكي" },
--       "area":         { "ft2": "قدم²",         "m2": "م²" },
--       "areaLong":     { "ft2": "قدم مربع",     "m2": "متر مربع" }
--     }
--   }
--
-- Keyed by LOCALE at the top level so English can be overridden later without a
-- second migration; today only the Arabic half has a form behind it, at
-- /admin/settings/units.
--
-- OVERRIDES, NOT A COPY. Every key is optional and a blank string reads as "no
-- override" — so `{}`, the default, renders exactly what the site renders today,
-- and clearing an input in the admin form returns that word to the shipped
-- default rather than rendering a price with nothing beside it. Applying this
-- migration changes nothing until someone saves the form.
--
-- NOT stored here: which side of the number the currency sits on. English leads
-- ("AED 4.2M") and Arabic trails ("4.2M درهم"); that is grammar rather than
-- branding, it is derived from the locale in lib/preferences/unit-labels.ts, and
-- a text input is the wrong control for a rule with two possible values.
--
-- Idempotent: the column is added only if missing, the grant is a no-op when
-- already held.

alter table public.site_settings
  add column if not exists unit_labels jsonb not null default '{}'::jsonb;

comment on column public.site_settings.unit_labels is
  'CMS-editable currency + area-unit dictionary, keyed by locale: the words rendered beside every price and every area on the public site (AED / $ / ft² / m² and their Arabic equivalents). Read by app/[locale]/(public)/layout.tsx and handed to UnitLabelsProvider. Validated by unitLabelSettingsSchema; {} means the words the site shipped with.';

-- ── anon read ────────────────────────────────────────────────────────────
--
-- site_settings is the one table with COLUMN-level grants (0096/0097): the
-- single row holds public copy next to internal wiring (`lead_routing` carries
-- staff user ids), and RLS grants rows, not columns.
--
-- Forgetting this grant fails quietly and totally — asking for an ungranted
-- column errors the WHOLE select, so every Arabic page would render the English
-- words for ever and report nothing while doing it. What is exposed is the word
-- "dirham" in two languages, which is on the face of every card the moment the
-- page loads.
grant select (unit_labels) on public.site_settings to anon;
