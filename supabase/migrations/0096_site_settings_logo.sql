-- 0096_site_settings_logo.sql
-- A CMS-editable brand logo for the public top bar.
--
-- Two parts, and the second is the load-bearing one.
--
-- 1. Two columns on the `site_settings` singleton. `logo_url` holds a media
--    library public URL (or an external one — the column is a URL, not a media
--    id, so an operator can paste a CDN link and nothing has to migrate).
--    `logo_style` says what the file actually is: a mark that sits beside the
--    "Bazar" wordmark, or a finished lockup that replaces it. Without that the
--    navbar has to guess, and it guesses wrong for half of all uploads.
--
-- 2. An anon read path. `site_settings` has carried exactly two policies since
--    0010, both `to authenticated`. Every anon-key read — which is what
--    `getPublicSiteSettings` issues, deliberately, so the marketplace stays
--    ISR-eligible without a `cookies()` bailout — has therefore matched zero
--    rows and fallen back to the hardcoded DEFAULTS in
--    lib/queries/site-settings.ts. Nothing failed loudly; the public site has
--    simply never rendered a value an admin typed into this table. A logo
--    stored here would have been invisible for the same reason.
--
--    The row is not wholly public, though: `lead_routing` carries staff user
--    ids, `email_templates` carries internal copy, and `integrations` is an
--    open jsonb bag. So the new policy is paired with column-level grants —
--    anon may select the branding and display columns and nothing else. RLS
--    picks the row, the grants pick the columns. Asking for an ungranted
--    column is a permission error, which the query layer already reads as "no
--    settings" and answers from DEFAULTS, so the pre-existing behaviour of the
--    wide public read is unchanged.
--
-- Idempotent: columns are added only if missing, the constraint and policy are
-- dropped before being recreated.

-- ── 1. Logo columns ───────────────────────────────────────────────────
alter table public.site_settings
  add column if not exists logo_url   text,
  add column if not exists logo_style text not null default 'mark_and_name';

alter table public.site_settings
  drop constraint if exists site_settings_logo_style_check;
alter table public.site_settings
  add constraint site_settings_logo_style_check
  check (logo_style in ('mark_and_name', 'logo_only'));

comment on column public.site_settings.logo_url is
  'Public URL of the navbar logo. Usually a media_assets object in the brand/ folder; an external URL is allowed.';
comment on column public.site_settings.logo_style is
  'mark_and_name = logo sits beside the Bazar wordmark; logo_only = the file is a full lockup and replaces the wordmark text.';

-- ── 2. Public (anon) read, restricted to the public-safe columns ──────
drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read on public.site_settings
  for select to anon using (true);

revoke select on public.site_settings from anon;
grant select (
  id,
  brand_name,
  brand_tagline,
  orn,
  contact_email,
  contact_phone,
  hero_variant,
  accent_token,
  logo_url,
  logo_style
) on public.site_settings to anon;
