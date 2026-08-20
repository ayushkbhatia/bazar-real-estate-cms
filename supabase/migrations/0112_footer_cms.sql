-- 0112 — the footer becomes a CMS surface, in both languages.
--
-- Until now `components/brand/public-footer.tsx` held its own content: three
-- `const` arrays of links, a social list, a contact block and a paragraph of
-- brand copy, all English, all in code. The visible consequence was narrow and
-- embarrassing — flipping to Arabic reversed the footer's LAYOUT (the logical
-- utilities did their job) while every word in it stayed English, because the
-- only strings that could translate were the four in `messages/*/footer.json`.
--
-- So this is the same move the megamenu made in 0031: content out of the
-- component and into tables the client can edit, with an Arabic twin beside
-- every English string.
--
--   · footer_settings       — singleton. Brand blurb, contact heading, legal line.
--   · footer_columns        — a heading + a list of links. kind = links | legal.
--   · footer_links          — one link inside a column.
--   · footer_socials        — the pill row under the wordmark.
--   · footer_contact_items  — the Contact column's labelled entries.
--
-- ── Why the contact block is rows and not a jsonb bag ─────────────────────
--
-- It is three labelled entries — phone, email, office — where the LABEL is
-- prose ("Office location") and the BODY is sometimes prose (an address) and
-- sometimes an identity (a phone number). Rows let the label carry a twin and
-- the address carry a twin while the phone numbers simply never get one typed
-- in, which is the honest shape. `href` is derived from `kind` at render time
-- (tel: / mailto:) rather than stored, so a number edited in one place cannot
-- disagree with its own link.
--
-- ── Why no draft/published status ────────────────────────────────────────
--
-- The megamenu has one because tabs are added and removed and a half-built tab
-- must not reach the public bar. The footer is a singleton surface that is
-- always live; the equivalent control here is `is_visible` per row, which is
-- what an editor actually reaches for ("hide the socials for now").
--
-- ── Grants ───────────────────────────────────────────────────────────────
--
-- These five tables use table-wide grants plus RLS, like the megamenu's four
-- and unlike `site_settings` — so the `_ar` columns need no `grant select (…)`.
-- See 0102's second trap for what that distinction costs when it is missed.

-- ───────────────────────────────────────────────────────────────
-- Enums
-- ───────────────────────────────────────────────────────────────
do $$ begin
  create type public.footer_column_kind as enum ('links', 'legal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.footer_contact_kind as enum ('phone', 'email', 'address', 'text');
exception when duplicate_object then null; end $$;

-- ───────────────────────────────────────────────────────────────
-- Tables
-- ───────────────────────────────────────────────────────────────
create table if not exists public.footer_settings (
  id                  uuid primary key default gen_random_uuid(),
  -- The paragraph under the wordmark.
  blurb               text,
  blurb_ar            text,
  -- Heading above the contact entries. Its own field rather than a
  -- `footer_columns` row: the contact column has entries, not links, so it
  -- would be a row in that table with nothing beneath it.
  contact_heading     text,
  contact_heading_ar  text,
  -- The copyright / licence / regulator line. Rendered twice — in the trust
  -- strip above the footer and in the footer's own bottom bar — from this one
  -- row, which is how those two stopped being able to disagree.
  legal_line          text,
  legal_line_ar       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
-- One row, enforced. A second row would be picked between arbitrarily.
create unique index if not exists footer_settings_singleton on public.footer_settings ((true));
drop trigger if exists footer_settings_set_updated_at on public.footer_settings;
create trigger footer_settings_set_updated_at before update on public.footer_settings
  for each row execute function public.set_updated_at();

create table if not exists public.footer_columns (
  id          uuid primary key default gen_random_uuid(),
  kind        public.footer_column_kind not null default 'links',
  heading     text,
  heading_ar  text,
  position    int not null,
  is_visible  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists footer_columns_kind_position_idx
  on public.footer_columns (kind, position);
drop trigger if exists footer_columns_set_updated_at on public.footer_columns;
create trigger footer_columns_set_updated_at before update on public.footer_columns
  for each row execute function public.set_updated_at();

create table if not exists public.footer_links (
  id         uuid primary key default gen_random_uuid(),
  column_id  uuid not null references public.footer_columns(id) on delete cascade,
  position   int not null,
  label      text not null,
  label_ar   text,
  href       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists footer_links_column_idx on public.footer_links (column_id, position);
drop trigger if exists footer_links_set_updated_at on public.footer_links;
create trigger footer_links_set_updated_at before update on public.footer_links
  for each row execute function public.set_updated_at();

create table if not exists public.footer_socials (
  id         uuid primary key default gen_random_uuid(),
  position   int not null,
  -- The network's own name. No twin, deliberately: "Instagram" is a wordmark
  -- in every language, and docs/I18N.md names a social network name as the
  -- example of a text field holding an identity rather than prose.
  label      text not null,
  href       text not null,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists footer_socials_position_idx on public.footer_socials (position);
drop trigger if exists footer_socials_set_updated_at on public.footer_socials;
create trigger footer_socials_set_updated_at before update on public.footer_socials
  for each row execute function public.set_updated_at();

create table if not exists public.footer_contact_items (
  id         uuid primary key default gen_random_uuid(),
  position   int not null,
  kind       public.footer_contact_kind not null default 'text',
  label      text not null,
  label_ar   text,
  -- One value per line. Two phone numbers are two lines of one row rather than
  -- two rows, because they share a label and render as one stacked group.
  body       text not null,
  body_ar    text,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists footer_contact_items_position_idx on public.footer_contact_items (position);
drop trigger if exists footer_contact_items_set_updated_at on public.footer_contact_items;
create trigger footer_contact_items_set_updated_at before update on public.footer_contact_items
  for each row execute function public.set_updated_at();

comment on column public.footer_settings.blurb_ar is
  'Arabic brand blurb. Blank falls back to the English in place.';
comment on column public.footer_contact_items.body is
  'One value per line. tel:/mailto: hrefs are derived from `kind` at render time.';

-- ───────────────────────────────────────────────────────────────
-- RLS — public reads everything visible; staff write.
-- ───────────────────────────────────────────────────────────────
alter table public.footer_settings      enable row level security;
alter table public.footer_columns       enable row level security;
alter table public.footer_links         enable row level security;
alter table public.footer_socials       enable row level security;
alter table public.footer_contact_items enable row level security;

drop policy if exists footer_settings_public_read on public.footer_settings;
drop policy if exists footer_settings_staff_all   on public.footer_settings;
create policy footer_settings_public_read on public.footer_settings
  for select using (true);
create policy footer_settings_staff_all on public.footer_settings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Hidden rows are filtered in the policy rather than in the query, so a
-- forgotten `.eq("is_visible", true)` in a future reader cannot un-hide them.
drop policy if exists footer_columns_public_read on public.footer_columns;
drop policy if exists footer_columns_staff_all   on public.footer_columns;
create policy footer_columns_public_read on public.footer_columns
  for select using (is_visible);
create policy footer_columns_staff_all on public.footer_columns
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists footer_links_public_read on public.footer_links;
drop policy if exists footer_links_staff_all   on public.footer_links;
create policy footer_links_public_read on public.footer_links
  for select using (
    exists (
      select 1 from public.footer_columns c
      where c.id = column_id and c.is_visible
    )
  );
create policy footer_links_staff_all on public.footer_links
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists footer_socials_public_read on public.footer_socials;
drop policy if exists footer_socials_staff_all   on public.footer_socials;
create policy footer_socials_public_read on public.footer_socials
  for select using (is_visible);
create policy footer_socials_staff_all on public.footer_socials
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists footer_contact_items_public_read on public.footer_contact_items;
drop policy if exists footer_contact_items_staff_all   on public.footer_contact_items;
create policy footer_contact_items_public_read on public.footer_contact_items
  for select using (is_visible);
create policy footer_contact_items_staff_all on public.footer_contact_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
