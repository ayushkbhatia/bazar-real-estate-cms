-- 0031_megamenu.sql
-- CMS-editable site megamenu — the dropdown panels triggered from the
-- public-site top nav (Buy / Sell / Rent / Commercial / New Projects /
-- Areas / Developers / Services / Insights / About).
--
--   · megamenu_tabs            — top-nav entries. 10 rows. 8 have panels.
--   · megamenu_columns         — column inside a tab's panel. zone left|right.
--   · megamenu_items           — link inside a column.
--   · megamenu_featured_tiles  — 0-2 large promo tiles per tab.
--
-- All four tables are RLS-on. Public reads only published tabs (and their
-- children, gated by the tab's status). Staff (any active role) can write
-- — the finer-grained role check (admin/editor/marketing) is enforced by
-- the server actions in app/(admin)/admin/navigation, mirroring how
-- /admin/pages handles it.

-- ───────────────────────────────────────────────────────────────
-- Enums
-- ───────────────────────────────────────────────────────────────
create type public.megamenu_zone as enum ('left', 'right');

create type public.megamenu_target_kind as enum (
  'area',
  'developer',
  'service',
  'property_type',
  'transaction',
  'page',
  'development',
  'article',
  'external'
);

create type public.megamenu_badge_variant as enum (
  'default',
  'hot',
  'luxury',
  'new',
  'trending',
  'partner'
);

create type public.megamenu_tile_variant as enum ('dark', 'light', 'image');

create type public.megamenu_tile_badge_kind as enum ('dot', 'icon', 'none');

create type public.megamenu_tab_status as enum ('draft', 'published');

-- ───────────────────────────────────────────────────────────────
-- Tables
-- ───────────────────────────────────────────────────────────────
create table public.megamenu_tabs (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  label              text not null,
  -- Direct-link href, used iff has_panel = false (e.g. /insights, /about).
  href               text,
  has_panel          boolean not null default true,
  position           int not null,
  -- Title shown above the left zone. e.g. 'Commercial in Abu Dhabi'.
  panel_title        text,
  -- Optional href the title links to (the entire site section page).
  panel_title_href   text,
  -- Header shown above the right zone. e.g. 'Sub-markets', 'Other Locations'.
  right_column_title text,
  status             public.megamenu_tab_status not null default 'draft',
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index megamenu_tabs_position_idx on public.megamenu_tabs (position);
create index megamenu_tabs_status_idx   on public.megamenu_tabs (status);
create trigger megamenu_tabs_set_updated_at before update on public.megamenu_tabs
  for each row execute function public.set_updated_at();

create table public.megamenu_columns (
  id         uuid primary key default gen_random_uuid(),
  tab_id     uuid not null references public.megamenu_tabs(id) on delete cascade,
  zone       public.megamenu_zone not null,
  position   int not null,
  heading    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index megamenu_columns_tab_zone_idx on public.megamenu_columns (tab_id, zone, position);
create trigger megamenu_columns_set_updated_at before update on public.megamenu_columns
  for each row execute function public.set_updated_at();

create table public.megamenu_items (
  id            uuid primary key default gen_random_uuid(),
  column_id     uuid not null references public.megamenu_columns(id) on delete cascade,
  position      int not null,
  label         text not null,
  href          text not null,
  -- Optional link to a live entity. target_id is intentionally NOT a
  -- hard FK so target_kind can point at multiple tables (areas,
  -- developers, pages, articles, developments). Server actions validate
  -- the (kind, id) pair on save.
  target_kind   public.megamenu_target_kind,
  target_id     uuid,
  icon          text,
  badge_label   text,
  badge_variant public.megamenu_badge_variant not null default 'default',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index megamenu_items_column_idx on public.megamenu_items (column_id, position);
create trigger megamenu_items_set_updated_at before update on public.megamenu_items
  for each row execute function public.set_updated_at();

create table public.megamenu_featured_tiles (
  id             uuid primary key default gen_random_uuid(),
  tab_id         uuid not null references public.megamenu_tabs(id) on delete cascade,
  position       int not null,
  variant        public.megamenu_tile_variant not null default 'dark',
  badge_label    text,
  badge_kind     public.megamenu_tile_badge_kind not null default 'dot',
  headline       text not null,
  href           text not null,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  cta_label      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index megamenu_featured_tiles_tab_idx on public.megamenu_featured_tiles (tab_id, position);
create trigger megamenu_featured_tiles_set_updated_at before update on public.megamenu_featured_tiles
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────────
alter table public.megamenu_tabs            enable row level security;
alter table public.megamenu_columns         enable row level security;
alter table public.megamenu_items           enable row level security;
alter table public.megamenu_featured_tiles  enable row level security;

-- TABS — public reads published; staff write all.
drop policy if exists megamenu_tabs_public_read on public.megamenu_tabs;
drop policy if exists megamenu_tabs_staff_all   on public.megamenu_tabs;
create policy megamenu_tabs_public_read on public.megamenu_tabs
  for select using (status = 'published');
create policy megamenu_tabs_staff_all on public.megamenu_tabs
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- COLUMNS — gated by parent tab status.
drop policy if exists megamenu_columns_public_read on public.megamenu_columns;
drop policy if exists megamenu_columns_staff_all   on public.megamenu_columns;
create policy megamenu_columns_public_read on public.megamenu_columns
  for select using (
    exists (
      select 1 from public.megamenu_tabs t
      where t.id = tab_id and t.status = 'published'
    )
  );
create policy megamenu_columns_staff_all on public.megamenu_columns
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ITEMS — gated by parent tab status (via column).
drop policy if exists megamenu_items_public_read on public.megamenu_items;
drop policy if exists megamenu_items_staff_all   on public.megamenu_items;
create policy megamenu_items_public_read on public.megamenu_items
  for select using (
    exists (
      select 1
      from public.megamenu_columns c
      join public.megamenu_tabs    t on t.id = c.tab_id
      where c.id = column_id and t.status = 'published'
    )
  );
create policy megamenu_items_staff_all on public.megamenu_items
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- FEATURED TILES — gated by parent tab status.
drop policy if exists megamenu_featured_tiles_public_read on public.megamenu_featured_tiles;
drop policy if exists megamenu_featured_tiles_staff_all   on public.megamenu_featured_tiles;
create policy megamenu_featured_tiles_public_read on public.megamenu_featured_tiles
  for select using (
    exists (
      select 1 from public.megamenu_tabs t
      where t.id = tab_id and t.status = 'published'
    )
  );
create policy megamenu_featured_tiles_staff_all on public.megamenu_featured_tiles
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ───────────────────────────────────────────────────────────────
-- Seed
--
-- Mirrors the Bazar mockups so the public site has a working megamenu
-- from day one and the admin UI has real rows to drag-reorder. Easily
-- changeable in /admin/navigation post-launch.
--
-- Wrapped in a DO block to capture inserted UUIDs without hardcoding.
-- ───────────────────────────────────────────────────────────────
do $$
declare
  v_buy_tab          uuid;
  v_sell_tab         uuid;
  v_rent_tab         uuid;
  v_commercial_tab   uuid;
  v_newprojects_tab  uuid;
  v_areas_tab        uuid;
  v_developers_tab   uuid;
  v_services_tab     uuid;
  v_col              uuid;
begin

  -- ─── BUY ─────────────────────────────────────────────────────
  insert into public.megamenu_tabs
    (slug, label, position, panel_title, panel_title_href, right_column_title, status, published_at, has_panel)
  values
    ('buy', 'Buy', 0, 'Buy properties in Abu Dhabi', '/buy', 'Other Locations', 'published', now(), true)
  returning id into v_buy_tab;

  -- Left zone — Resale
  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_buy_tab, 'left', 0, 'Resale & ready properties')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Apartments',  '/buy?type=apartment',      'property_type'),
    (v_col, 1, 'Villas',      '/buy?type=villa',          'property_type'),
    (v_col, 2, 'Townhouses',  '/buy?type=townhouse',      'property_type'),
    (v_col, 3, 'Penthouses',  '/buy?type=penthouse',      'property_type'),
    (v_col, 4, 'Homes',       '/buy',                     'transaction');
  insert into public.megamenu_items (column_id, position, label, href, target_kind, badge_label, badge_variant) values
    (v_col, 5, 'Hot deals', '/buy?sort=hot',    'transaction', 'HOT DEALS', 'hot'),
    (v_col, 6, 'Luxury',    '/buy?tier=luxury', 'transaction', 'LUXURY',    'luxury');

  -- Left zone — Off-plan
  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_buy_tab, 'left', 1, 'Off plan')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Apartments',  '/off-plan?type=apartment', 'property_type'),
    (v_col, 1, 'Penthouses',  '/off-plan?type=penthouse', 'property_type'),
    (v_col, 2, 'Townhouses',  '/off-plan?type=townhouse', 'property_type'),
    (v_col, 3, 'Villas',      '/off-plan?type=villa',     'property_type');

  -- Right zone — Other Emirates
  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_buy_tab, 'right', 0, 'Other Emirates')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Dubai',          '/buy?emirate=dubai',          'area'),
    (v_col, 1, 'Sharjah',        '/buy?emirate=sharjah',        'area'),
    (v_col, 2, 'Ajman',          '/buy?emirate=ajman',          'area'),
    (v_col, 3, 'Ras Al Khaimah', '/buy?emirate=ras-al-khaimah', 'area');

  -- Right zone — International
  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_buy_tab, 'right', 1, 'International')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Saudi Arabia', '/buy?country=saudi-arabia', 'area'),
    (v_col, 1, 'Oman',         '/buy?country=oman',         'area'),
    (v_col, 2, 'Maldives',     '/buy?country=maldives',     'area');

  insert into public.megamenu_featured_tiles
    (tab_id, position, variant, badge_label, badge_kind, headline, href, cta_label)
  values
    (v_buy_tab, 0, 'dark',  'New launch', 'dot', 'Solaya by Aldar',         '/off-plan/solaya-by-aldar', 'Discover more'),
    (v_buy_tab, 1, 'light', 'Top picks',  'dot', 'Saadiyat trophy homes',   '/areas/saadiyat-island',    'Browse');


  -- ─── SELL ────────────────────────────────────────────────────
  insert into public.megamenu_tabs
    (slug, label, position, panel_title, panel_title_href, status, published_at, has_panel)
  values
    ('sell', 'Sell', 1, 'Sell your property in Abu Dhabi', '/services/sell', 'published', now(), true)
  returning id into v_sell_tab;

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_sell_tab, 'left', 0, 'For sellers')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'List your property', '/services/sell',   'service'),
    (v_col, 1, 'Online valuation',   '/tools/valuation', 'service'),
    (v_col, 2, 'Pricing strategy',   '/services/sell',   'service'),
    (v_col, 3, 'Resale reports',     '/insights',        'page');

  insert into public.megamenu_featured_tiles
    (tab_id, position, variant, badge_label, badge_kind, headline, href, cta_label)
  values
    (v_sell_tab, 0, 'dark',  'How-to',   'dot', 'How to sell your property', '/services/sell',   'Read guide'),
    (v_sell_tab, 1, 'light', 'New tool', 'dot', 'Online valuation',          '/tools/valuation', 'Try it');


  -- ─── RENT ────────────────────────────────────────────────────
  insert into public.megamenu_tabs
    (slug, label, position, panel_title, panel_title_href, status, published_at, has_panel)
  values
    ('rent', 'Rent', 2, 'Rent properties in Abu Dhabi', '/rent', 'published', now(), true)
  returning id into v_rent_tab;

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_rent_tab, 'left', 0, 'Rental properties')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Apartments', '/rent?type=apartment', 'property_type'),
    (v_col, 1, 'Villas',     '/rent?type=villa',     'property_type'),
    (v_col, 2, 'Townhouses', '/rent?type=townhouse', 'property_type');

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_rent_tab, 'left', 1, 'Landlord tools')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind, icon) values
    (v_col, 0, 'Property management', '/services/property-management', 'service', 'home');

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_rent_tab, 'left', 2, 'Guides')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Landlord guide', '/insights?category=landlord-guide', 'page'),
    (v_col, 1, 'Tenant guide',   '/insights?category=tenant-guide',   'page'),
    (v_col, 2, 'Move-in guide',  '/insights?category=move-in',        'page');

  insert into public.megamenu_featured_tiles
    (tab_id, position, variant, badge_label, badge_kind, headline, href, cta_label)
  values
    (v_rent_tab, 0, 'dark',  'For landlords', 'dot', 'Discover property management', '/services/property-management', 'Learn more'),
    (v_rent_tab, 1, 'light', 'Best offers',   'dot', 'Hot properties for rent',      '/rent?sort=hot',                'Browse');


  -- ─── COMMERCIAL ──────────────────────────────────────────────
  insert into public.megamenu_tabs
    (slug, label, position, panel_title, panel_title_href, right_column_title, status, published_at, has_panel)
  values
    ('commercial', 'Commercial', 3, 'Commercial in Abu Dhabi', '/commercial', 'Sub-markets', 'published', now(), true)
  returning id into v_commercial_tab;

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_commercial_tab, 'left', 0, 'By asset class')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind, icon) values
    (v_col, 0, 'Office space',           '/commercial?type=office',     'property_type', 'building-2'),
    (v_col, 1, 'Retail',                 '/commercial?type=retail',     'property_type', 'building-2'),
    (v_col, 2, 'F&B units',              '/commercial?type=fb',         'property_type', 'building-2'),
    (v_col, 3, 'Warehouses & logistics', '/commercial?type=warehouse',  'property_type', 'building-2'),
    (v_col, 4, 'Hotel apartments',       '/commercial?type=hotel',      'property_type', 'building-2');

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_commercial_tab, 'left', 1, 'By transaction')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'For sale',              '/commercial?mode=buy',       'transaction'),
    (v_col, 1, 'For lease',             '/commercial?mode=rent',      'transaction'),
    (v_col, 2, 'Off-plan commercial',   '/commercial?mode=off_plan',  'transaction'),
    (v_col, 3, 'Investment portfolios', '/commercial?mode=portfolio', 'transaction'),
    (v_col, 4, 'Land & plots',          '/commercial?type=land',      'property_type');

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_commercial_tab, 'right', 0, 'Free zones')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'ADGM',        '/areas/adgm',        'area'),
    (v_col, 1, 'Masdar City', '/areas/masdar-city', 'area'),
    (v_col, 2, 'KIZAD',       '/areas/kizad',       'area');

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_commercial_tab, 'right', 1, 'Mainland')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Corniche',     '/areas/corniche',     'area'),
    (v_col, 1, 'Mussafah',     '/areas/mussafah',     'area'),
    (v_col, 2, 'Khalifa City', '/areas/khalifa-city', 'area');

  insert into public.megamenu_featured_tiles
    (tab_id, position, variant, badge_label, badge_kind, headline, href, cta_label)
  values
    (v_commercial_tab, 0, 'dark', 'ADGM exclusive', 'dot', 'Al Maryah trophy assets', '/commercial?area=al-maryah', 'Discover');


  -- ─── NEW PROJECTS ────────────────────────────────────────────
  insert into public.megamenu_tabs
    (slug, label, position, panel_title, panel_title_href, right_column_title, status, published_at, has_panel)
  values
    ('new-projects', 'New Projects', 4, 'New projects in Abu Dhabi', '/off-plan', 'Explore by location', 'published', now(), true)
  returning id into v_newprojects_tab;

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_newprojects_tab, 'left', 0, null)
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind, icon) values
    (v_col, 0, 'Apartments',  '/off-plan?type=apartment', 'property_type', 'building-2'),
    (v_col, 1, 'Penthouses',  '/off-plan?type=penthouse', 'property_type', 'home'),
    (v_col, 2, 'Villas',      '/off-plan?type=villa',     'property_type', 'home'),
    (v_col, 3, 'Townhouses',  '/off-plan?type=townhouse', 'property_type', 'building');

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_newprojects_tab, 'left', 1, 'Branded residences')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Bulgari Residences',    '/developments/bulgari-residences',    'development'),
    (v_col, 1, 'Mandarin Oriental',     '/developments/mandarin-oriental',     'development'),
    (v_col, 2, 'Six Senses Residences', '/developments/six-senses-residences', 'development');

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_newprojects_tab, 'left', 2, 'Beachfront living')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Bayviews · Saadiyat',  '/developments/bayviews-saadiyat',  'development'),
    (v_col, 1, 'Saadiyat Lagoons',     '/developments/saadiyat-lagoons',   'development'),
    (v_col, 2, 'Reem Hills · Phase 4', '/developments/reem-hills-phase-4', 'development');

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_newprojects_tab, 'right', 0, 'Off-plan properties in')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Saadiyat',       '/off-plan?area=saadiyat',          'area'),
    (v_col, 1, 'Al Reem',        '/off-plan?area=al-reem',           'area'),
    (v_col, 2, 'Ras Al Khaimah', '/off-plan?emirate=ras-al-khaimah', 'area'),
    (v_col, 3, 'Yas Island',     '/off-plan?area=yas-island',        'area'),
    (v_col, 4, 'Al Raha',        '/off-plan?area=al-raha',           'area'),
    (v_col, 5, 'Maldives',       '/off-plan?country=maldives',       'area');

  insert into public.megamenu_featured_tiles
    (tab_id, position, variant, badge_label, badge_kind, headline, href, cta_label)
  values
    (v_newprojects_tab, 0, 'dark', 'New launch', 'dot', 'Solaya by Aldar', '/off-plan/solaya-by-aldar', 'Discover');


  -- ─── AREAS ───────────────────────────────────────────────────
  insert into public.megamenu_tabs
    (slug, label, position, panel_title, panel_title_href, right_column_title, status, published_at, has_panel)
  values
    ('areas', 'Areas', 5, 'Abu Dhabi areas', '/areas', 'Other locations', 'published', now(), true)
  returning id into v_areas_tab;

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_areas_tab, 'left', 0, 'Waterfront living')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Saadiyat Island', '/areas/saadiyat-island', 'area'),
    (v_col, 1, 'Al Reem',         '/areas/al-reem',         'area'),
    (v_col, 2, 'Al Maryah',       '/areas/al-maryah',       'area');

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_areas_tab, 'left', 1, 'Family living')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Yas Acres',       '/areas/yas-acres',       'area'),
    (v_col, 1, 'Khalifa City',    '/areas/khalifa-city',    'area'),
    (v_col, 2, 'Al Raha Gardens', '/areas/al-raha-gardens', 'area');

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_areas_tab, 'left', 2, 'Beachfront')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Mamsha Al Saadiyat', '/areas/mamsha-al-saadiyat', 'area'),
    (v_col, 1, 'Hidd Al Saadiyat',   '/areas/hidd-al-saadiyat',   'area'),
    (v_col, 2, 'Al Raha Beach',      '/areas/al-raha-beach',      'area');

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_areas_tab, 'left', 3, 'Luxury')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Saadiyat Reserve', '/areas/saadiyat-reserve', 'area'),
    (v_col, 1, 'Nurai Island',     '/areas/nurai-island',     'area'),
    (v_col, 2, 'Saadiyat Lagoons', '/areas/saadiyat-lagoons', 'area');

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_areas_tab, 'right', 0, 'Other Emirates')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Dubai',          '/areas?emirate=dubai',          'area'),
    (v_col, 1, 'Sharjah',        '/areas?emirate=sharjah',        'area'),
    (v_col, 2, 'Ajman',          '/areas?emirate=ajman',          'area'),
    (v_col, 3, 'Ras Al Khaimah', '/areas?emirate=ras-al-khaimah', 'area');

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_areas_tab, 'right', 1, 'International')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Saudi Arabia', '/areas?country=saudi-arabia', 'area'),
    (v_col, 1, 'Oman',         '/areas?country=oman',         'area'),
    (v_col, 2, 'Georgia',      '/areas?country=georgia',      'area'),
    (v_col, 3, 'Maldives',     '/areas?country=maldives',     'area');

  insert into public.megamenu_featured_tiles
    (tab_id, position, variant, badge_label, badge_kind, headline, href, cta_label)
  values
    (v_areas_tab, 0, 'dark', 'Trending area', 'dot', 'Hidd Al Saadiyat', '/areas/hidd-al-saadiyat', 'Explore');


  -- ─── DEVELOPERS ──────────────────────────────────────────────
  insert into public.megamenu_tabs
    (slug, label, position, panel_title, panel_title_href, status, published_at, has_panel)
  values
    ('developers', 'Developers', 6, 'All developers', '/developers', 'published', now(), true)
  returning id into v_developers_tab;

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_developers_tab, 'left', 0, 'Top developers')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Aldar',     '/developers/aldar',     'developer'),
    (v_col, 1, 'Modon',     '/developers/modon',     'developer'),
    (v_col, 2, 'Imkan',     '/developers/imkan',     'developer'),
    (v_col, 3, 'Reportage', '/developers/reportage', 'developer'),
    (v_col, 4, 'Bloom',     '/developers/bloom',     'developer');

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_developers_tab, 'left', 1, 'Boutique')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Eagle Hills',      '/developers/eagle-hills',       'developer'),
    (v_col, 1, 'Tiger Properties', '/developers/tiger-properties',  'developer'),
    (v_col, 2, 'National Holding', '/developers/national-holding',  'developer'),
    (v_col, 3, 'IFA Hotels',       '/developers/ifa-hotels',        'developer'),
    (v_col, 4, 'RAK Properties',   '/developers/rak-properties',    'developer');

  insert into public.megamenu_featured_tiles
    (tab_id, position, variant, badge_label, badge_kind, headline, href, cta_label)
  values
    (v_developers_tab, 0, 'dark',  'Top developer', 'dot', 'Aldar Properties', '/developers/aldar', 'Profile'),
    (v_developers_tab, 1, 'light', 'Bazar partner', 'dot', 'Modon Properties', '/developers/modon', 'Profile');


  -- ─── SERVICES ────────────────────────────────────────────────
  insert into public.megamenu_tabs
    (slug, label, position, panel_title, panel_title_href, right_column_title, status, published_at, has_panel)
  values
    ('services', 'Services', 7, 'All services in Abu Dhabi', '/services', 'Landlord tools', 'published', now(), true)
  returning id into v_services_tab;

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_services_tab, 'left', 0, 'For owners & buyers')
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Property management',   '/services/property-management', 'service'),
    (v_col, 1, 'Consulting services',   '/services/consulting',          'service'),
    (v_col, 2, 'Conveyancing & escrow', '/services/conveyancing',        'service'),
    (v_col, 3, 'Snagging inspection',   '/services/snagging',            'service'),
    (v_col, 4, 'Property handover',     '/services/handover',            'service');

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_services_tab, 'left', 1, null)
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Mortgage assistance',          '/tools/mortgage',           'service'),
    (v_col, 1, 'Interior design & furnishing', '/services/interior-design', 'service'),
    (v_col, 2, 'Residency visas',              '/services/residency-visas', 'service'),
    (v_col, 3, 'Developer services',           '/services/developer',       'service'),
    (v_col, 4, 'Sales & leasing',              '/services/sales-leasing',   'service');

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_services_tab, 'right', 0, null)
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Rental finance management', '/services/rental-finance',      'service'),
    (v_col, 1, 'Snagging inspection',       '/services/snagging',            'service'),
    (v_col, 2, 'Interior design in AD',     '/services/interior-design',     'service'),
    (v_col, 3, 'Tenant matchmaking',        '/services/tenant-matchmaking',  'service');

  insert into public.megamenu_featured_tiles
    (tab_id, position, variant, badge_label, badge_kind, headline, href, cta_label)
  values
    (v_services_tab, 0, 'dark',  'Golden Visa',    'dot', 'Pathways for investors and residents.', '/services/residency-visas', 'Discover more'),
    (v_services_tab, 1, 'light', 'For developers', 'dot', 'Services for developers and sponsors.', '/services/developer',       'Discover more');


  -- ─── INSIGHTS (direct link, no panel) ────────────────────────
  insert into public.megamenu_tabs (slug, label, position, has_panel, href, status, published_at)
  values ('insights', 'Insights', 8, false, '/insights', 'published', now());


  -- ─── ABOUT (direct link, no panel) ───────────────────────────
  insert into public.megamenu_tabs (slug, label, position, has_panel, href, status, published_at)
  values ('about', 'About', 9, false, '/about', 'published', now());

end $$;
