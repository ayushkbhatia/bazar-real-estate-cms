-- 0046_megamenu_batch_updates.sql
-- Client audit — batch megamenu updates for four tabs. Data-only; each tab
-- referenced by slug. Featured tiles are left untouched (preserved).
--
--   · new-projects : type column -> "Property Types" (Apartments, Villas,
--                    Townhouses, Penthouses, Branded Residences); drop the
--                    "Branded residences" + "Beachfront living" dev columns;
--                    right column becomes "Abu Dhabi Locations" (8).
--   · rent         : add a right-zone serif title so its sub-headings align
--                    with the left zone's.
--   · areas        : drop the right "Other locations" zone; left becomes a new
--                    "Abu Dhabi Areas" list; the community groupings move to
--                    the right under "Abu Dhabi communities".
--   · developers   : single ordered partner list (9) + "All developer
--                    partners"; "Boutique" -> "Mortgage Partners" (4 banks).

-- ── new-projects ────────────────────────────────────────────────
do $$
declare
  v_tab uuid; v_types uuid; v_loc1 uuid; v_loc2 uuid;
begin
  select id into v_tab from public.megamenu_tabs where slug = 'new-projects';
  if v_tab is null then raise notice 'new-projects tab missing'; return; end if;

  delete from public.megamenu_items
    where column_id in (select id from public.megamenu_columns where tab_id = v_tab);
  delete from public.megamenu_columns where tab_id = v_tab;

  update public.megamenu_tabs set right_column_title = 'Abu Dhabi Locations' where id = v_tab;

  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'left', 0, 'Property Types') returning id into v_types;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'right', 0, null) returning id into v_loc1;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'right', 1, null) returning id into v_loc2;

  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_types, 0, 'Apartments',         '/off-plan?type=apartment', 'property_type'),
    (v_types, 1, 'Villas',             '/off-plan?type=villa',     'property_type'),
    (v_types, 2, 'Townhouses',         '/off-plan?type=townhouse', 'property_type'),
    (v_types, 3, 'Penthouses',         '/off-plan?type=penthouse', 'property_type'),
    (v_types, 4, 'Branded Residences', '/off-plan',                null);

  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_loc1, 0, 'Hudayriyat Island', '/off-plan?area=hudayriyat-island', 'area'),
    (v_loc1, 1, 'Al Reem Island',    '/off-plan?area=al-reem-island',    'area'),
    (v_loc1, 2, 'Yas Island',        '/off-plan?area=yas-island',        'area'),
    (v_loc1, 3, 'Saadiyat Island',   '/off-plan?area=saadiyat-island',   'area');
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_loc2, 0, 'Al Raha Beach', '/off-plan?area=al-raha-beach', 'area'),
    (v_loc2, 1, 'Masdar City',   '/off-plan?area=masdar-city',   'area'),
    (v_loc2, 2, 'Al Ghadeer',    '/off-plan?area=al-ghadeer',    'area'),
    (v_loc2, 3, 'Zayed City',    '/off-plan?area=zayed-city',    'area');
end $$;

-- ── rent : align right sub-headings with the left zone ──────────
update public.megamenu_tabs
  set right_column_title = 'Guides & areas'
  where slug = 'rent';

-- ── areas (Communities) ─────────────────────────────────────────
do $$
declare
  v_tab uuid; v_a1 uuid; v_a2 uuid;
  v_water uuid; v_family uuid; v_beach uuid; v_lux uuid;
begin
  select id into v_tab from public.megamenu_tabs where slug = 'areas';
  if v_tab is null then raise notice 'areas tab missing'; return; end if;

  delete from public.megamenu_items
    where column_id in (select id from public.megamenu_columns where tab_id = v_tab);
  delete from public.megamenu_columns where tab_id = v_tab;

  update public.megamenu_tabs
    set panel_title = 'Abu Dhabi Areas',
        panel_title_href = '/communities',
        right_column_title = 'Abu Dhabi communities'
    where id = v_tab;

  -- LEFT: new "Abu Dhabi Areas" list, 8 across two columns.
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'left', 0, null) returning id into v_a1;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'left', 1, null) returning id into v_a2;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_a1, 0, 'Saadiyat Island', '/communities/saadiyat-island', 'area'),
    (v_a1, 1, 'Al Reem Island',  '/communities/al-reem-island',  'area'),
    (v_a1, 2, 'Yas Island',      '/communities/yas-island',      'area'),
    (v_a1, 3, 'Al Maryah Island','/communities/al-maryah',       'area');
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_a2, 0, 'Al Raha Beach',    '/communities/al-raha-beach',    'area'),
    (v_a2, 1, 'Khalifa City',     '/communities/khalifa-city',     'area'),
    (v_a2, 2, 'Hudayriyat Island','/communities/hudayriyat-island','area'),
    (v_a2, 3, 'Masdar City',      '/communities/masdar-city',      'area');

  -- RIGHT: existing community groupings move here under "Abu Dhabi communities".
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'right', 0, 'Waterfront living') returning id into v_water;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'right', 1, 'Family living') returning id into v_family;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'right', 2, 'Beachfront') returning id into v_beach;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'right', 3, 'Luxury') returning id into v_lux;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_water, 0, 'Saadiyat Island', '/communities/saadiyat-island', 'area'),
    (v_water, 1, 'Al Reem',         '/communities/al-reem-island',  'area'),
    (v_water, 2, 'Al Maryah',       '/communities/al-maryah',       'area');
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_family, 0, 'Yas Acres',      '/communities/yas-acres',       'area'),
    (v_family, 1, 'Khalifa City',   '/communities/khalifa-city',    'area'),
    (v_family, 2, 'Al Raha Gardens','/communities/al-raha-gardens', 'area');
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_beach, 0, 'Mamsha Al Saadiyat', '/communities/mamsha-al-saadiyat', 'area'),
    (v_beach, 1, 'Hidd Al Saadiyat',   '/communities/hidd-al-saadiyat',   'area'),
    (v_beach, 2, 'Al Raha Beach',      '/communities/al-raha-beach',      'area');
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_lux, 0, 'Saadiyat Reserve', '/communities/saadiyat-reserve', 'area'),
    (v_lux, 1, 'Nurai Island',     '/communities/nurai-island',     'area'),
    (v_lux, 2, 'Saadiyat Lagoons', '/communities/saadiyat-lagoons', 'area');
end $$;

-- ── developers ──────────────────────────────────────────────────
do $$
declare
  v_tab uuid; v_devs uuid; v_mort uuid;
begin
  select id into v_tab from public.megamenu_tabs where slug = 'developers';
  if v_tab is null then raise notice 'developers tab missing'; return; end if;

  delete from public.megamenu_items
    where column_id in (select id from public.megamenu_columns where tab_id = v_tab);
  delete from public.megamenu_columns where tab_id = v_tab;

  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'left', 0, 'Developers') returning id into v_devs;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'left', 1, 'Mortgage Partners') returning id into v_mort;

  insert into public.megamenu_items (column_id, position, label, href, target_kind, badge_label, badge_variant) values
    (v_devs, 0, 'Aldar Properties',     '/developers/aldar',              'developer', null, 'default'),
    (v_devs, 1, 'Modon Properties',     '/developers/modon',              'developer', null, 'default'),
    (v_devs, 2, 'Bloom Holding',        '/developers/bloom',              'developer', null, 'default'),
    (v_devs, 3, 'IMKAN Properties',     '/developers/imkan',              'developer', null, 'default'),
    (v_devs, 4, 'Reportage Properties', '/developers/reportage',          'developer', null, 'default'),
    (v_devs, 5, 'Eagle Hills',          '/developers/eagle-hills',        'developer', null, 'default'),
    (v_devs, 6, 'Radiant Real Estate',  '/developers/radiant-real-estate','developer', null, 'default'),
    (v_devs, 7, 'Ohana Development',    '/developers/ohana-development',  'developer', null, 'default'),
    (v_devs, 8, 'Taraf',                '/developers/taraf',              'developer', null, 'default'),
    (v_devs, 9, 'All developer partners','/developers',                   null,        'View all', 'default');

  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_mort, 0, 'First Abu Dhabi Bank',       '/tools/mortgage', null),
    (v_mort, 1, 'Abu Dhabi Commercial Bank',  '/tools/mortgage', null),
    (v_mort, 2, 'Abu Dhabi Islamic Bank',     '/tools/mortgage', null),
    (v_mort, 3, 'Dubai Islamic Bank',         '/tools/mortgage', null);
end $$;
