-- 0044_rent_megamenu_restructure.sql
-- Restructure the public "Rent" megamenu panel into the client-specified
-- sections. Panel zones are LEFT (2-col) | MIDDLE (featured) | RIGHT (2-col);
-- featured is always the middle zone. Reading left -> right:
--
--   LEFT  col 0 : Property Types      (list)
--   LEFT  col 1 : For Tenants         (list)
--   MIDDLE      : Featured Rentals     (2 tiles — hydrated at runtime with the
--                                       2 most-recent published rent listings;
--                                       the rows seeded here are the static
--                                       fallback used when no listings resolve)
--   RIGHT col 0 : For Landlords       (list)
--   RIGHT col 1 : Abu Dhabi Locations (list, 8 communities)
--
-- Data-only migration; references the tab by slug (no hardcoded UUID).
-- Content stays CMS-editable via /admin/navigation (the featured tiles are
-- overridden dynamically on the public site — see
-- lib/queries/megamenu-hydrate.ts).

do $$
declare
  v_tab      uuid;
  v_types    uuid;
  v_tenants  uuid;
  v_landlord uuid;
  v_loc      uuid;
begin
  select id into v_tab from public.megamenu_tabs where slug = 'rent';
  if v_tab is null then
    raise notice 'Rent megamenu tab not found — skipping 0044';
    return;
  end if;

  delete from public.megamenu_items
    where column_id in (select id from public.megamenu_columns where tab_id = v_tab);
  delete from public.megamenu_columns where tab_id = v_tab;
  delete from public.megamenu_featured_tiles where tab_id = v_tab;

  -- Right zone holds two distinct sections, so no single serif title.
  update public.megamenu_tabs
    set right_column_title = null
    where id = v_tab;

  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'left', 0, 'Property Types') returning id into v_types;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'left', 1, 'For Tenants') returning id into v_tenants;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'right', 0, 'For Landlords') returning id into v_landlord;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'right', 1, 'Abu Dhabi Locations') returning id into v_loc;

  -- Property Types.
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_types, 0, 'Apartments',            '/rent?type=apartment', 'property_type'),
    (v_types, 1, 'Villas',                '/rent?type=villa',     'property_type'),
    (v_types, 2, 'Townhouses',            '/rent?type=townhouse', 'property_type'),
    (v_types, 3, 'Penthouses',            '/rent?type=penthouse', 'property_type'),
    (v_types, 4, 'Commercial Properties', '/commercial',          null);

  -- For Tenants. (Required Documents / Rental Process have no page yet —
  -- these render the filtered insights index, empty until content is seeded.)
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_tenants, 0, 'Tenant Guide',       '/insights?category=tenant-guide',      'page'),
    (v_tenants, 1, 'Move-In Guide',      '/insights?category=move-in',           'page'),
    (v_tenants, 2, 'Required Documents', '/insights?category=required-documents', 'page'),
    (v_tenants, 3, 'Rental Process',     '/insights?category=rental-process',     'page');

  -- For Landlords.
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_landlord, 0, 'List Your Property',   '/services/sell',                   'service'),
    (v_landlord, 1, 'Property Management',  '/services/manage',                 'service'),
    (v_landlord, 2, 'Landlord Guide',       '/insights?category=landlord-guide', 'page');

  -- Abu Dhabi Locations. Slugs without a seeded area row resolve to an empty
  -- rent result rather than a 404, and self-heal once seeded.
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_loc, 0, 'Hudayriyat Island', '/rent?area=hudayriyat-island', 'area'),
    (v_loc, 1, 'Al Reem Island',    '/rent?area=al-reem-island',    'area'),
    (v_loc, 2, 'Yas Island',        '/rent?area=yas-island',        'area'),
    (v_loc, 3, 'Saadiyat Island',   '/rent?area=saadiyat-island',   'area'),
    (v_loc, 4, 'Al Raha Beach',     '/rent?area=al-raha-beach',     'area'),
    (v_loc, 5, 'Masdar City',       '/rent?area=masdar-city',       'area'),
    (v_loc, 6, 'Al Ghadeer',        '/rent?area=al-ghadeer',        'area'),
    (v_loc, 7, 'Zayed City',        '/rent?area=zayed-city',        'area');

  -- Featured Rentals — static fallback tiles. Overridden at runtime by
  -- getPublishedMegamenuHydrated() with live rent listings.
  insert into public.megamenu_featured_tiles
    (tab_id, position, variant, badge_label, badge_kind, headline, href, media_asset_id, cta_label) values
    (v_tab, 0, 'dark',  'For rent', 'dot', 'Featured rentals',   '/rent', null, 'Browse rentals'),
    (v_tab, 1, 'light', 'For rent', 'dot', 'New this week',      '/rent', null, 'Browse rentals');
end $$;
