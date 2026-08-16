-- 0107 — mortgage calculator assumptions on site_settings
--
-- /tools/mortgage computed against literals in lib/mortgage.ts: the DLD
-- transfer rate, the trustee and valuation fees, the Central Bank LTV tiers
-- and the DBR thresholds. All of them move without asking us — a DLD circular
-- or a CBUAE notice, not a release — and every one of them needed a deploy.
--
-- One jsonb column rather than eighteen scalar ones, matching `lead_routing`
-- and `email_templates` beside it: the bag is read whole, written whole and
-- validated by a zod schema (lib/schemas/site-settings.ts) that carries a
-- default per key, so a bag written before a field existed still parses.
--
-- Empty by default on purpose. `{}` means "the figures the tool shipped with"
-- — the schema fills every key from its own defaults, which mirror
-- DEFAULT_MORTGAGE_ASSUMPTIONS. Applying this migration changes nothing on the
-- public site until someone saves the form.

alter table public.site_settings
  add column if not exists mortgage jsonb not null default '{}'::jsonb;

comment on column public.site_settings.mortgage is
  'Mortgage calculator assumptions — opening values, closing-cost percentages, Central Bank LTV tiers and DBR thresholds. Percentages are whole percents (4 = 4%). Validated by mortgageSettingsSchema; {} means the built-in defaults.';

-- ── anon read ────────────────────────────────────────────────────────────
--
-- site_settings is the one table with COLUMN-level grants (0096/0097), because
-- the single row holds public copy next to internal wiring (`lead_routing`
-- carries staff user ids) and RLS grants rows, not columns.
--
-- The failure mode if this is forgotten is quiet and wide: asking for an
-- ungranted column fails the WHOLE select, so /tools/mortgage would fall back
-- to its built-in figures for ever and report no error while doing it. The
-- calculator's assumptions are public arithmetic — the fees are printed on the
-- page — so they are safe to read anonymously.
grant select (mortgage) on public.site_settings to anon;
