-- ═══════════════════════════════════════════════════════════════════════
-- 0099 · landing_pages — campaign pages assembled from the block catalogue
-- ═══════════════════════════════════════════════════════════════════════
--
-- A fourth content shape, and deliberately NOT a fourth `pages.slug` prefix.
-- `pages` already carries three (bare = Block[], master/ = section document,
-- subpage/ = section document), and every read of it filters the other two out
-- by hand — see the `.not("slug","like",…)` calls in lib/queries/pages.ts. A
-- campaign page has things those sentinel rows do not: a real draft lifecycle,
-- a soft delete, and a slug namespace of its own. Sharing the table would mean
-- a fourth filter on every existing query and a media-usage index that links a
-- builder image at the wrong admin route.
--
-- `blocks` holds a `BlockInstance[]` — see lib/page-builder/types.ts. The
-- catalogue in code is authoritative for *what blocks exist*; storage is
-- authoritative for *which ones this page uses, in what order, with what copy*.
--
-- The draft column is the point of the whole table. Everywhere else in this CMS
-- a save on a published row is a deploy: `saveBlocks` writes and revalidates in
-- one go. A marketing manager assembling a campaign over an afternoon would
-- publish every intermediate state that way. Here `draft_blocks` absorbs the
-- edits and `blocks` only changes when someone presses Publish.

set local search_path = public, auth, extensions;

create table if not exists public.landing_pages (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  -- Reuses the existing two-value enum rather than adding a second one.
  status        public.page_status not null default 'draft',
  -- The live document. Public reads only ever touch this column.
  blocks        jsonb not null default '[]'::jsonb,
  -- Unpublished edits. NULL means "live and draft agree", which is also how the
  -- admin list derives its "unpublished changes" badge without a second flag.
  draft_blocks  jsonb,
  seo           jsonb,
  -- Paid-ad landing pages often should not compete with the canonical route in
  -- search. Off by default; the publish gate forces the decision either way.
  noindex       boolean not null default false,
  published_at  timestamptz,
  created_by    uuid references public.staff(user_id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  -- Stricter than `pages.slug`, which permits '/'. /lp/[slug] is ONE dynamic
  -- segment, so a slash there produces a %2F URL that the CMS would link past.
  constraint landing_pages_slug_shape
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,138}[a-z0-9]$'),
  constraint landing_pages_blocks_is_array
    check (jsonb_typeof(blocks) = 'array'),
  constraint landing_pages_draft_is_array
    check (draft_blocks is null or jsonb_typeof(draft_blocks) = 'array')
);

create index if not exists landing_pages_slug_idx
  on public.landing_pages (slug);
create index if not exists landing_pages_live_idx
  on public.landing_pages (published_at desc)
  where status = 'published' and deleted_at is null;
create index if not exists landing_pages_updated_idx
  on public.landing_pages (updated_at desc)
  where deleted_at is null;

drop trigger if exists landing_pages_set_updated_at on public.landing_pages;
create trigger landing_pages_set_updated_at before update on public.landing_pages
  for each row execute function public.set_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────
-- Read and write stay two separate policies: 0087 rules consolidating
-- permissive policies out of scope, and merging them here would widen the
-- public read to whatever the write predicate allows.
--
-- `is_staff()` is wrapped as a scalar subquery so it hoists to a
-- statement-level InitPlan instead of running once per row. That is exactly the
-- shape 0087_rls_helper_initplan.sql exists to fix — the bare form measured
-- 788,913 sequential scans against `staff`.
--
-- No column-level grants: every column here is public-safe, so the 0096/0097
-- `site_settings` pattern does not apply. `draft_blocks` is kept off the public
-- select in the query layer instead (see lib/queries/landing-pages.ts), because
-- an ungranted column fails the *whole* PostgREST select rather than one field.
alter table public.landing_pages enable row level security;

drop policy if exists landing_pages_public_read on public.landing_pages;
create policy landing_pages_public_read on public.landing_pages
  for select using (status = 'published' and deleted_at is null);

drop policy if exists landing_pages_staff_all on public.landing_pages;
create policy landing_pages_staff_all on public.landing_pages
  for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

comment on table public.landing_pages is
  'Campaign landing pages built in /admin/page-builder, served at /lp/<slug>.';
comment on column public.landing_pages.blocks is
  'Live BlockInstance[] — changes only on publish.';
comment on column public.landing_pages.draft_blocks is
  'Unpublished BlockInstance[]; NULL when the draft matches the live document.';
