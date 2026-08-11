-- 0097_site_settings_favicon.sql
-- The browser-tab icon, editable next to the logo at /admin/settings/brand.
--
-- A separate column rather than reusing `logo_url`, because the two are the
-- same artwork at different sizes at best and different artwork at worst: a
-- favicon is read at 16px in a tab strip, where a full lockup is mud. Sharing
-- one column would force the operator to pick which surface to get right.
--
-- The grant is the part that is easy to forget. 0096 revoked anon's
-- table-wide select on `site_settings` and granted named columns instead, so a
-- new public column is invisible to the anon key until it is named here — and
-- because an ungranted column fails the *whole* PostgREST select, forgetting
-- this does not lose one field, it silently drops the branding read back to
-- its defaults.
--
-- Idempotent: the column is added only if missing, and re-granting is a no-op.

alter table public.site_settings
  add column if not exists favicon_url text;

comment on column public.site_settings.favicon_url is
  'Public URL of the browser-tab icon. Usually a media_assets object in the brand/ folder; falls back to /favicon.ico when null.';

grant select (favicon_url) on public.site_settings to anon;
