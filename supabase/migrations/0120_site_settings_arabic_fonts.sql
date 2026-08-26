-- 0120_site_settings_arabic_fonts.sql
-- The Arabic type stack, editable from the CMS.
--
-- WHAT THIS REPLACES
-- Every Arabic glyph the site draws resolves through one variable — `--bz-font-ar`
-- in globals.css — which points at IBM Plex Sans Arabic, loaded by
-- app/[locale]/_fonts-ar.ts. That was a developer's choice made in a file the
-- client cannot open. ADR-0007 records it as an open question: the designer
-- picked 29LT Bukra (already vendored, for one page, under contact-qr/_fonts)
-- and swapping it was "a one-file change once procurement confirms coverage".
-- A one-file change is still a deploy. This makes it a save.
--
-- One jsonb column rather than a table, matching `mortgage` (0107) and
-- `lead_routing` beside it: the bag is read whole, written whole, and validated
-- by a zod schema (lib/schemas/arabic-fonts.ts) that carries a default per key,
-- so a bag written before a field existed still parses.
--
-- SHAPE (see arabicFontSettingsSchema for the authority)
--   {
--     "enabled": true,
--     "families": [
--       { "id": "…uuid…", "name": "Bukra", "slug": "bukra", "files": [
--           { "url": "https://…/fonts/…-bukra-regular.woff2",
--             "filename": "bukra-regular.woff2",
--             "format": "woff2", "weight": "400", "style": "normal" } ] }
--     ],
--     "roles": { "display": "…uuid…", "body": "…uuid…",
--                "eyebrow": null, "mono": null }
--   }
--
-- `roles` names a family id per typographic role — headings, body/UI, eyebrow
-- labels, and the numeral/reference face. A null role inherits: eyebrow follows
-- body, mono stays on the Latin JetBrains face (prices and reference codes are
-- Latin-typeset), and an unset display or body falls back to the shipped stack.
-- So `{}` — the default — renders exactly what the site renders today, and
-- applying this migration changes nothing until someone saves the form.
--
-- URLs, not media ids, for the same reason `logo_url` is a URL (0096): a client
-- who hosts their licensed face on their own CDN pastes a link and nothing has
-- to migrate.
--
-- Idempotent: the column is added only if missing, the grant is a no-op when
-- already held.

alter table public.site_settings
  add column if not exists arabic_fonts jsonb not null default '{}'::jsonb;

comment on column public.site_settings.arabic_fonts is
  'CMS-editable Arabic type stack: uploaded font families and the typographic role each one fills (display / body / eyebrow / mono). Read by app/[locale]/layout.tsx, which emits @font-face + the --bz-font-ar-* overrides on RTL locales only. Validated by arabicFontSettingsSchema; {} means the shipped IBM Plex Sans Arabic stack.';

-- ── anon read ────────────────────────────────────────────────────────────
--
-- site_settings is the one table with COLUMN-level grants (0096/0097), because
-- the single row holds public copy next to internal wiring (`lead_routing`
-- carries staff user ids) and RLS grants rows, not columns.
--
-- The failure mode if this is forgotten is quiet and total: asking for an
-- ungranted column fails the WHOLE select, so /ar would render in the shipped
-- face for ever and report no error while doing it. What is exposed here is a
-- list of public font URLs and the role each fills — the same information any
-- visitor reads out of the stylesheet the moment the page loads.
grant select (arabic_fonts) on public.site_settings to anon;
