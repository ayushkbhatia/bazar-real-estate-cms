-- 0105_site_settings_footer_logo.sql
-- The lockup drawn in the public footer, editable next to the logo and the
-- favicon at /admin/settings (Brand & identity).
--
-- A third column rather than reusing `logo_url`, for the same reason 0097 gave
-- the favicon its own: the footer sits on the ink surface, so the file that
-- works there is usually the light/reversed variant of the artwork that works
-- in the top bar. One column would force the operator to pick which of the two
-- surfaces to get right. Null keeps the typeset "Bazar" wordmark that has
-- always been there, so this is additive for an operator who never sets it.
--
-- The grant is the part that is easy to forget. 0096 revoked anon's table-wide
-- select on `site_settings` and granted named columns instead, so a new public
-- column is invisible to the anon key until it is named here — and because an
-- ungranted column fails the *whole* PostgREST select, forgetting it does not
-- lose one field, it silently drops the branding read back to its defaults.
--
-- Idempotent: the column is added only if missing, and re-granting is a no-op.

alter table public.site_settings
  add column if not exists footer_logo_url text;

comment on column public.site_settings.footer_logo_url is
  'Public URL of the logo drawn in the public footer. Usually a media_assets object in the brand/ folder; the footer falls back to the typeset Bazar wordmark when null. Kept separate from logo_url because the footer is a dark surface and normally wants the reversed artwork.';

grant select (footer_logo_url) on public.site_settings to anon;
