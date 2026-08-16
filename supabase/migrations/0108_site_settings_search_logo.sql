-- 0108_site_settings_search_logo.sql
-- The square mark a search engine draws next to the result — Google's SERP
-- site icon, and the `logo` of the Organization JSON-LD that feeds the
-- knowledge panel. Editable next to the logo, the favicon and the footer logo
-- at /admin/settings/brand (Brand & identity).
--
-- Its own column rather than a reuse of `favicon_url`, for the reason 0097 and
-- 0105 each gave: the surfaces want different files. A favicon is authored for
-- 16px in a tab strip; Google asks for a square that is a multiple of 48px and
-- renders it at ~24px in a result row and much larger in a knowledge panel, so
-- the file that survives a tab strip is usually cruder than the one that should
-- represent the brand in search. Null falls back to the favicon, then the logo,
-- so an operator who never sets this is strictly better off than today: the
-- Organization `logo` used to be hardcoded to /icon.png, a file that does not
-- exist in this repo, which is why the result row rendered a blank generic
-- mark.
--
-- The grant is the part that is easy to forget. 0096 revoked anon's table-wide
-- select on `site_settings` and granted named columns instead, so a new public
-- column is invisible to the anon key until it is named here — and because an
-- ungranted column fails the *whole* PostgREST select, forgetting it does not
-- lose one field, it silently drops the branding read back to its defaults.
--
-- Idempotent: the column is added only if missing, and re-granting is a no-op.

alter table public.site_settings
  add column if not exists search_logo_url text;

comment on column public.site_settings.search_logo_url is
  'Public URL of the square mark search engines show beside the site: emitted as a sized <link rel="icon"> plus the apple-touch-icon, and as the `logo` of the Organization JSON-LD. Usually a media_assets object in the brand/ folder; falls back to favicon_url, then logo_url, when null.';

grant select (search_logo_url) on public.site_settings to anon;
