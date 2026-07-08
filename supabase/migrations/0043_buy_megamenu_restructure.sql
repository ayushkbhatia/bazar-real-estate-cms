-- 0043_buy_megamenu_restructure.sql
-- Restructure the public "Buy" megamenu panel into the client-specified
-- 4 sub-sections, in order:
--
--   1. Property Types   (left col 0)   — simple list
--   2. Property Status  (left col 1)   — simple list
--   3. New Launches     (featured)     — 2 promo tiles for our showcased
--                                        off-plan projects (mirrors the
--                                        home-page off-plan strip, which
--                                        surfaces the two most-recent
--                                        published developments)
--   4. Abu Dhabi Locations (right)     — simple list, split across 2 cols
--
-- Data-only migration: rewrites the Buy tab's columns / items / featured
-- tiles. References the tab by slug (no hardcoded generated UUID). Content
-- stays fully CMS-editable via /admin/navigation afterwards.

do $$
declare
  v_tab    uuid;
  v_types  uuid;
  v_status uuid;
  v_loc1   uuid;
  v_loc2   uuid;
begin
  select id into v_tab from public.megamenu_tabs where slug = 'buy';
  if v_tab is null then
    raise notice 'Buy megamenu tab not found — skipping 0043';
    return;
  end if;

  -- Clear existing panel content for the Buy tab (items cascade from columns,
  -- but delete explicitly to be order-independent).
  delete from public.megamenu_items
    where column_id in (select id from public.megamenu_columns where tab_id = v_tab);
  delete from public.megamenu_columns where tab_id = v_tab;
  delete from public.megamenu_featured_tiles where tab_id = v_tab;

  -- Right-zone serif heading.
  update public.megamenu_tabs
    set right_column_title = 'Abu Dhabi Locations'
    where id = v_tab;

  -- Columns.
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'left', 0, 'Property Types') returning id into v_types;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'left', 1, 'Property Status') returning id into v_status;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'right', 0, null) returning id into v_loc1;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'right', 1, null) returning id into v_loc2;

  -- 1. Property Types.
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_types, 0, 'Apartments',            '/buy?type=apartment', 'property_type'),
    (v_types, 1, 'Villas',                '/buy?type=villa',     'property_type'),
    (v_types, 2, 'Townhouses',            '/buy?type=townhouse', 'property_type'),
    (v_types, 3, 'Penthouses',            '/buy?type=penthouse', 'property_type'),
    (v_types, 4, 'Commercial Properties', '/commercial',         null);

  -- 2. Property Status. (No ready/resale filter exists on /buy yet, so both
  --    route to the buy index — the client can refine hrefs in admin.)
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_status, 0, 'Off-Plan Properties',   '/off-plan',   'transaction'),
    (v_status, 1, 'Ready Properties',       '/buy',        'transaction'),
    (v_status, 2, 'Resale Properties',      '/buy',        'transaction'),
    (v_status, 3, 'Commercial Properties',  '/commercial', null);

  -- 4. Abu Dhabi Locations — 8 communities split 4 + 4 across the right zone's
  --    2-col grid. Slugs without a seeded area row (Hudayriyat / Al Ghadeer /
  --    Zayed City) resolve to an empty buy result rather than a 404, and
  --    self-heal once those areas are seeded.
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_loc1, 0, 'Hudayriyat Island', '/buy?area=hudayriyat-island', 'area'),
    (v_loc1, 1, 'Al Reem Island',    '/buy?area=al-reem-island',    'area'),
    (v_loc1, 2, 'Yas Island',        '/buy?area=yas-island',        'area'),
    (v_loc1, 3, 'Saadiyat Island',   '/buy?area=saadiyat-island',   'area');
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_loc2, 0, 'Al Raha Beach',     '/buy?area=al-raha-beach',     'area'),
    (v_loc2, 1, 'Masdar City',       '/buy?area=masdar-city',       'area'),
    (v_loc2, 2, 'Al Ghadeer',        '/buy?area=al-ghadeer',        'area'),
    (v_loc2, 3, 'Zayed City',        '/buy?area=zayed-city',        'area');

  -- 3. New Launches — featured tiles for the two off-plan projects currently
  --    showcased on the home-page off-plan strip.
  insert into public.megamenu_featured_tiles
    (tab_id, position, variant, badge_label, badge_kind, headline, href, media_asset_id, cta_label) values
    (v_tab, 0, 'dark',  'New launch', 'dot', 'Solaya by Aldar',      '/off-plan/solaya-by-aldar',    null, 'Discover more'),
    (v_tab, 1, 'light', 'New launch', 'dot', 'Reem Hills Phase 4',   '/off-plan/reem-hills-phase-4', null, 'Discover more');
end $$;
