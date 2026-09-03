-- 0123_site_settings_card_labels.sql
-- The labels a property or development card wears over its image, editable
-- from the CMS.
--
-- WHAT THIS REPLACES
-- lib/listing-badge.ts mapped two booleans on `properties.flags` to two
-- hard-coded catalogue strings and returned AT MOST ONE. Three limits, all of
-- them the client's rather than the code's: the words could not change without
-- a deploy, a new label needed a developer, and a property that was both
-- exclusive and vacant on transfer showed only the first.
--
-- One jsonb column rather than a table, matching `unit_labels` (0122),
-- `arabic_fonts` (0120) and `mortgage` (0107) beside it: the bag is read whole,
-- written whole, and validated by a zod schema (lib/schemas/card-labels.ts)
-- that carries a default per key, so a bag written before a field existed still
-- parses. A table would buy referential integrity against `properties.flags`,
-- which is jsonb and cannot have a foreign key into it anyway.
--
-- SHAPE (cardLabelSettingsSchema is the authority)
--   {
--     "labels": [
--       { "id": "exclusive", "text": "Exclusive", "text_ar": "حصري",
--         "kind": "ink", "enabled": true },
--       { "id": "vacant_on_transfer", "text": "Vacant on transfer",
--         "text_ar": "شاغر عند نقل الملكية", "kind": "accent",
--         "enabled": true },
--       { "id": "new_launch", "text": "New launch", "text_ar": "إطلاق جديد",
--         "kind": "success", "enabled": true }
--     ]
--   }
--
-- `kind` names one of the five chip styles components/brand/listing-card.tsx
-- already draws, so a colour is a choice among what the design system has
-- rather than a hex the client can put anything in.
--
-- WHERE ASSIGNMENT LIVES — deliberately not here. A listing carries
-- `flags.labels: string[]` (properties) or `meta.labels: string[]`
-- (developments), both of them free-form jsonb columns that already exist. So
-- tagging a property needs no migration and no generated-type change, which
-- matters for the kind of thing a client edits weekly.
--
-- NOTHING CHANGES ON APPLY. `{}` resolves to the two built-in labels, whose
-- words and colours are byte-identical to what listingBadge returned, and the
-- two legacy booleans are still read as assignments — so a property nobody has
-- re-tagged wears exactly the badge it wore yesterday.
--
-- Idempotent: the column is added only if missing, the grant is a no-op when
-- already held.

alter table public.site_settings
  add column if not exists card_labels jsonb not null default '{}'::jsonb;

comment on column public.site_settings.card_labels is
  'CMS-editable vocabulary of the labels a property or development card wears over its image: id, English and Arabic text, chip colour, enabled. Assignment per listing lives in properties.flags.labels / developments.meta.labels. Validated by cardLabelSettingsSchema; {} means the two built-ins (Exclusive, Vacant on transfer).';

-- ── anon read ────────────────────────────────────────────────────────────
--
-- site_settings is the one table with COLUMN-level grants (0096/0097): the
-- single row holds public copy next to internal wiring (`lead_routing` carries
-- staff user ids), and RLS grants rows, not columns.
--
-- Forgetting this grant fails quietly and totally — asking for an ungranted
-- column errors the WHOLE select — and here the failure is soft on top of that:
-- the read falls back to the built-in vocabulary, so every custom label the
-- client made would simply stop appearing, with no error anywhere. What is
-- exposed is the set of words already printed on the cards of the same page.
grant select (card_labels) on public.site_settings to anon;
