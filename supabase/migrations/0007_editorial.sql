-- 0007_editorial.sql
-- Phase 3 editorial schema.
--   · articles                — the blog (/insights). Tiptap HTML body.
--   · pages                   — block-based content pages (3b).
--   · reviews                 — agent/area/development reviews; moderation
--                                queue lands in Phase 6.
--   · newsletter_subscribers  — "Bazar Brief" signup capture (3c).

-- ───────────────────────────────────────────────────────────────
-- Enums
-- ───────────────────────────────────────────────────────────────
create type public.article_status as enum (
  'draft',
  'scheduled',
  'published',
  'archived'
);

create type public.article_category as enum (
  'market_report',
  'buyers_guide',
  'sellers_guide',
  'field_note',
  'policy',
  'off_plan_watch'
);

create type public.page_status as enum ('draft', 'published');

create type public.review_subject_kind as enum (
  'agent',
  'area',
  'development'
);
create type public.review_status as enum (
  'pending',
  'approved',
  'rejected'
);

create type public.newsletter_status as enum (
  'pending',
  'confirmed',
  'unsubscribed',
  'bounced'
);

-- ───────────────────────────────────────────────────────────────
-- articles — long-form editorial for /insights
-- ───────────────────────────────────────────────────────────────
create table public.articles (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  title          text not null,
  excerpt        text,
  category       public.article_category not null default 'field_note',
  status         public.article_status   not null default 'draft',
  author_id      uuid references public.staff(user_id) on delete set null,
  hero_image_id  uuid references public.media_assets(id) on delete set null,
  body_html      text not null default '',
  read_minutes   int,
  seo            jsonb,
  published_at   timestamptz,
  scheduled_for  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index articles_slug_idx         on public.articles (slug);
create index articles_status_idx       on public.articles (status);
create index articles_category_idx     on public.articles (category);
create index articles_author_idx       on public.articles (author_id);
create index articles_published_at_idx on public.articles (published_at desc)
  where status = 'published' and deleted_at is null;
create trigger articles_set_updated_at before update on public.articles
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- pages — block-based content pages
-- ───────────────────────────────────────────────────────────────
create table public.pages (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  status        public.page_status not null default 'draft',
  blocks        jsonb not null default '[]'::jsonb,
  seo           jsonb,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index pages_slug_idx   on public.pages (slug);
create index pages_status_idx on public.pages (status);
create trigger pages_set_updated_at before update on public.pages
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- reviews — staff moderation queue arrives in Phase 6
-- ───────────────────────────────────────────────────────────────
create table public.reviews (
  id             uuid primary key default gen_random_uuid(),
  subject_kind   public.review_subject_kind not null,
  subject_id     uuid not null,
  rating         int  not null check (rating between 1 and 5),
  title          text,
  body           text,
  author_name    text,
  author_email   text,
  account_id     uuid references public.accounts(user_id) on delete set null,
  status         public.review_status not null default 'pending',
  moderated_at   timestamptz,
  moderated_by   uuid references public.staff(user_id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index reviews_subject_idx on public.reviews (subject_kind, subject_id);
create index reviews_status_idx  on public.reviews (status);
create trigger reviews_set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- newsletter_subscribers — "Bazar Brief" signup
-- ───────────────────────────────────────────────────────────────
create table public.newsletter_subscribers (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null unique,
  account_id          uuid references public.accounts(user_id) on delete set null,
  status              public.newsletter_status not null default 'pending',
  confirmation_token  text unique,
  source              text,
  subscribed_at       timestamptz not null default now(),
  confirmed_at        timestamptz,
  unsubscribed_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index newsletter_status_idx  on public.newsletter_subscribers (status);
create index newsletter_account_idx on public.newsletter_subscribers (account_id)
  where account_id is not null;
create trigger newsletter_set_updated_at before update on public.newsletter_subscribers
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────────
alter table public.articles               enable row level security;
alter table public.pages                  enable row level security;
alter table public.reviews                enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- ARTICLES: public read for published; staff writes all
drop policy if exists articles_public_read on public.articles;
drop policy if exists articles_staff_all   on public.articles;
create policy articles_public_read on public.articles
  for select using (status = 'published' and deleted_at is null);
create policy articles_staff_all on public.articles
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- PAGES: public read for published; staff writes all
drop policy if exists pages_public_read on public.pages;
drop policy if exists pages_staff_all   on public.pages;
create policy pages_public_read on public.pages
  for select using (status = 'published');
create policy pages_staff_all on public.pages
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- REVIEWS: public reads approved; anon can submit (status forced pending);
-- staff moderates everything.
drop policy if exists reviews_public_read on public.reviews;
drop policy if exists reviews_anon_insert on public.reviews;
drop policy if exists reviews_staff_all   on public.reviews;
create policy reviews_public_read on public.reviews
  for select using (status = 'approved');
create policy reviews_anon_insert on public.reviews
  for insert with check (status = 'pending');
create policy reviews_staff_all on public.reviews
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- NEWSLETTER_SUBSCRIBERS:
--   · anyone can INSERT a 'pending' row (signup form);
--   · signed-in account can SELECT / UPDATE their own row;
--   · staff can do anything (export, status changes).
drop policy if exists newsletter_anon_insert on public.newsletter_subscribers;
drop policy if exists newsletter_own_select  on public.newsletter_subscribers;
drop policy if exists newsletter_own_update  on public.newsletter_subscribers;
drop policy if exists newsletter_staff_all   on public.newsletter_subscribers;
create policy newsletter_anon_insert on public.newsletter_subscribers
  for insert with check (status = 'pending');
create policy newsletter_own_select on public.newsletter_subscribers
  for select to authenticated using (account_id = auth.uid());
create policy newsletter_own_update on public.newsletter_subscribers
  for update to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());
create policy newsletter_staff_all on public.newsletter_subscribers
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Done.
