-- 0055_article_categories_table.sql
-- Make blog "types" (categories) editable from the CMS at runtime.
--
-- articles.category was a Postgres enum (article_category). An enum cannot be
-- extended from application code without DDL, so editors could not add a new
-- blog type. This migration replaces the enum with a lookup table
-- (article_categories) and repoints articles.category at it via a text FK.
-- Existing rows already hold the enum's slug values, so the cast is lossless
-- and every public URL / label keeps working.
--
-- Shape mirrors amenities_taxonomy (0019): public reads active rows, staff
-- manage all.

set local search_path = public, auth, extensions;

-- 1. Lookup table ------------------------------------------------------------
create table if not exists public.article_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  label       text not null,
  description text,
  sort_order  int  not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists article_categories_active_idx on public.article_categories (is_active);
create index if not exists article_categories_sort_idx   on public.article_categories (sort_order);

create trigger article_categories_set_updated_at before update on public.article_categories
  for each row execute function public.set_updated_at();

-- 2. Seed with the seven enum values + their CMS labels ----------------------
insert into public.article_categories (slug, label, sort_order) values
  ('market_report',  'Market report',       10),
  ('buyers_guide',   'Buyer''s guide',      20),
  ('sellers_guide',  'Seller''s guide',     30),
  ('field_note',     'Field note',          40),
  ('policy',         'Policy & regulation', 50),
  ('off_plan_watch', 'Off-plan watch',      60),
  ('luxury',         'Luxury',              70)
on conflict (slug) do nothing;

-- 3. Convert articles.category: enum -> text + FK to the lookup table --------
--    Drop the default first (it is typed as the enum and blocks the cast).
alter table public.articles alter column category drop default;
alter table public.articles
  alter column category type text using category::text;
alter table public.articles alter column category set default 'field_note';

--    ON UPDATE CASCADE so renaming a category slug propagates to articles.
--    No ON DELETE action: categories are retired via is_active = false, and a
--    category still referenced by an article cannot be hard-deleted.
alter table public.articles
  add constraint articles_category_fkey
  foreign key (category) references public.article_categories (slug)
  on update cascade;

-- 4. Retire the now-unused enum type ----------------------------------------
drop type if exists public.article_category;

-- 5. RLS --------------------------------------------------------------------
alter table public.article_categories enable row level security;

-- Public read is unrestricted (labels are non-sensitive taxonomy). Retiring a
-- category is `is_active = false`, but articles still referencing it must keep
-- rendering their real label and a working archive page, so the public client
-- has to see inactive rows too. "Don't offer / don't browse" is enforced in the
-- query layer (listArticleCategories filters is_active), not by RLS.
drop policy if exists article_categories_public_read on public.article_categories;
create policy article_categories_public_read on public.article_categories
  for select using (true);

drop policy if exists article_categories_staff_select on public.article_categories;
create policy article_categories_staff_select on public.article_categories
  for select to authenticated using (public.is_staff());

drop policy if exists article_categories_staff_write on public.article_categories;
create policy article_categories_staff_write on public.article_categories
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
