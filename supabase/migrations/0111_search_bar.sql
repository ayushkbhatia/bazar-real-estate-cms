-- ═══════════════════════════════════════════════════════════════════════
-- 0111 · Search bar — the home hero's tabs, placeholders and CTA, in the CMS
-- ═══════════════════════════════════════════════════════════════════════
--
-- The first control a visitor touches on the busiest page on the site had its
-- copy written as literals in `lib/hero-search-config.ts`: four tab labels
-- ("Off-Plan", "Buy", "Rent", "Commercial"), two placeholders ("Area,
-- building, community or emirate"), nine property-type labels and a "Search"
-- button. None of it was reachable from /admin, and none of it had an Arabic
-- twin — so /ar rendered an English search bar over an Arabic page.
--
-- Two tables, and the same division of labour as `forms` / `form_fields`:
--
--   search_bar        the overridable labels, as a partial copy bag
--   search_bar_tabs   the ordered tab list, once an editor has touched it
--
-- `lib/search-bar/registry.ts` stays authoritative for what the bar IS — a tab
-- is a piece of a page, and a row that outlives its route is a ghost. Storage
-- is authoritative for what an editor changed. Both resolve at read time
-- (`lib/search-bar/resolve.ts`), which is why this migration seeds nothing:
-- with no rows the home page renders precisely what it rendered before, in
-- both languages, so applying it is a no-op until someone opens the manager.
--
-- Deliberately NOT a `forms` row. A search bar captures nothing, files no
-- lead and has no responses; giving it a handler, an enquiry source and a
-- submissions tab it can never use would make every one of those columns
-- nullable-and-meaningless for the sake of sharing a table.

set local search_path = public, auth, extensions;

-- ───────────────────────────────────────────────────────────────
-- search_bar — the overridable labels
-- ───────────────────────────────────────────────────────────────
create table if not exists public.search_bar (
  id         uuid primary key default gen_random_uuid(),
  -- Matches a key in lib/search-bar/registry.ts ('home_hero' today). A row
  -- whose key is not in the registry is inert: nothing renders it.
  key        text not null unique,
  -- Partial copy bag, English and Arabic. Absent keys fall back to the
  -- message catalogue rather than to a second hard-coded English string —
  -- see the docblock on lib/search-bar/copy-keys.ts for why the registry
  -- default for every one of these is *absence*.
  copy       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint search_bar_key_slug check (key ~ '^[a-z][a-z0-9_]*$'),
  constraint search_bar_copy_is_object check (jsonb_typeof(copy) = 'object')
);

create trigger search_bar_set_updated_at before update
  on public.search_bar
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- search_bar_tabs — the ordered tab list
-- ───────────────────────────────────────────────────────────────
-- Rows appear the first time an editor saves. Until then the registry's tabs
-- are what render, which is what makes this safe to apply ahead of the deploy.
create table if not exists public.search_bar_tabs (
  id            uuid primary key default gen_random_uuid(),
  bar_id        uuid not null references public.search_bar(id) on delete cascade,
  -- Stable identity, also the `defaultMode` the other landing pages pass.
  -- Hyphens allowed: the off-plan tab has been 'off-plan' since it shipped and
  -- renaming it would silently change which tab those pages open on.
  key           text not null,
  label         text not null,
  label_ar      text,
  -- Where the search submits. Constrained to a site-relative path: this value
  -- is pushed onto the router, and an editor pasting an external URL would
  -- turn the home page's main control into an off-site redirect.
  route         text not null,
  placeholder   text not null,
  placeholder_ar text,
  -- [{value, label, label_ar}] — `value` is a member of PROPERTY_TYPES and is
  -- what the search URL carries; the labels are what the visitor reads.
  types         jsonb not null default '[]'::jsonb,
  -- Residential tabs show a Beds select; commercial shows a size slider.
  beds          boolean not null default true,
  -- ft². Null on a tab with no size slider; both halves move together.
  size_max      int,
  size_step     int,
  -- AED. The bounds stay AED whatever the visitor's display currency is —
  -- they are written straight into price_min/price_max, which the search
  -- query reads as AED. Only the slider's labels convert.
  price_max     int not null,
  price_step    int not null,
  enabled       boolean not null default true,
  position      int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (bar_id, key),
  constraint search_bar_tabs_key_slug check (key ~ '^[a-z][a-z0-9_-]*$'),
  constraint search_bar_tabs_label_not_blank check (length(btrim(label)) > 0),
  constraint search_bar_tabs_route_relative check (route ~ '^/[A-Za-z0-9/_-]*$'),
  constraint search_bar_tabs_types_is_array check (jsonb_typeof(types) = 'array'),
  constraint search_bar_tabs_price check (price_max > 0 and price_step > 0),
  constraint search_bar_tabs_size_pair check (
    (size_max is null and size_step is null)
    or (size_max > 0 and size_step > 0))
);

create index if not exists search_bar_tabs_bar_position_idx
  on public.search_bar_tabs (bar_id, position);

create trigger search_bar_tabs_set_updated_at before update
  on public.search_bar_tabs
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────────
alter table public.search_bar enable row level security;
alter table public.search_bar_tabs enable row level security;

-- Public content, exactly like `forms`: these are the labels on a control an
-- anonymous visitor is looking at. A disabled tab is not hidden at this layer
-- — the resolver decides what renders, and hiding the row here would make the
-- manager's own list lie about what it is editing.
drop policy if exists search_bar_public_read on public.search_bar;
create policy search_bar_public_read on public.search_bar
  for select using (true);

drop policy if exists search_bar_staff_write on public.search_bar;
create policy search_bar_staff_write on public.search_bar
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists search_bar_tabs_public_read on public.search_bar_tabs;
create policy search_bar_tabs_public_read on public.search_bar_tabs
  for select using (true);

drop policy if exists search_bar_tabs_staff_write on public.search_bar_tabs;
create policy search_bar_tabs_staff_write on public.search_bar_tabs
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

comment on table public.search_bar is
  'Overridable labels for a search bar, editable at /admin/forms/search-bar. Absent row ⇒ the defaults in lib/search-bar/registry.ts (and the message catalogue) are live.';
comment on table public.search_bar_tabs is
  'The ordered tab list for a search bar, written the first time an editor saves it. Absent rows ⇒ the registry tab list is live.';
