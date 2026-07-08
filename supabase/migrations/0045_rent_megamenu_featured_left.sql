-- 0045_rent_megamenu_featured_left.sql
-- Rent megamenu, iteration 2 (client reflections):
--   · Featured Rentals moves further left — achieved by collapsing the left
--     zone to a single column (Property Types), which the panel now sizes to
--     content so the featured tiles slide left (see megamenu-panel.tsx).
--   · For Tenants + For Landlords combine into one stacked column.
--
-- New layout (left -> right):
--   LEFT        : Property Types
--   MIDDLE      : Featured Rentals (hydrated at runtime; fallback tiles seeded)
--   RIGHT col 0 : For Tenants & Landlords (tenant links then landlord links)
--   RIGHT col 1 : Abu Dhabi Locations
--
-- Data-only; references the Rent tab by slug.

do $$
declare
  v_tab    uuid;
  v_types  uuid;
  v_guides uuid;
  v_loc    uuid;
begin
  select id into v_tab from public.megamenu_tabs where slug = 'rent';
  if v_tab is null then
    raise notice 'Rent megamenu tab not found — skipping 0045';
    return;
  end if;

  delete from public.megamenu_items
    where column_id in (select id from public.megamenu_columns where tab_id = v_tab);
  delete from public.megamenu_columns where tab_id = v_tab;
  delete from public.megamenu_featured_tiles where tab_id = v_tab;

  update public.megamenu_tabs set right_column_title = null where id = v_tab;

  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'left', 0, 'Property Types') returning id into v_types;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'right', 0, 'For Tenants & Landlords') returning id into v_guides;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'right', 1, 'Abu Dhabi Locations') returning id into v_loc;

  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_types, 0, 'Apartments',            '/rent?type=apartment', 'property_type'),
    (v_types, 1, 'Villas',                '/rent?type=villa',     'property_type'),
    (v_types, 2, 'Townhouses',            '/rent?type=townhouse', 'property_type'),
    (v_types, 3, 'Penthouses',            '/rent?type=penthouse', 'property_type'),
    (v_types, 4, 'Commercial Properties', '/commercial',          null);

  -- Combined guides: tenant links first, then landlord links.
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_guides, 0, 'Tenant Guide',        '/insights?category=tenant-guide',       'page'),
    (v_guides, 1, 'Move-In Guide',       '/insights?category=move-in',            'page'),
    (v_guides, 2, 'Required Documents',  '/insights?category=required-documents', 'page'),
    (v_guides, 3, 'Rental Process',      '/insights?category=rental-process',     'page'),
    (v_guides, 4, 'List Your Property',  '/services/sell',                        'service'),
    (v_guides, 5, 'Property Management', '/services/manage',                      'service'),
    (v_guides, 6, 'Landlord Guide',      '/insights?category=landlord-guide',     'page');

  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_loc, 0, 'Hudayriyat Island', '/rent?area=hudayriyat-island', 'area'),
    (v_loc, 1, 'Al Reem Island',    '/rent?area=al-reem-island',    'area'),
    (v_loc, 2, 'Yas Island',        '/rent?area=yas-island',        'area'),
    (v_loc, 3, 'Saadiyat Island',   '/rent?area=saadiyat-island',   'area'),
    (v_loc, 4, 'Al Raha Beach',     '/rent?area=al-raha-beach',     'area'),
    (v_loc, 5, 'Masdar City',       '/rent?area=masdar-city',       'area'),
    (v_loc, 6, 'Al Ghadeer',        '/rent?area=al-ghadeer',        'area'),
    (v_loc, 7, 'Zayed City',        '/rent?area=zayed-city',        'area');

  insert into public.megamenu_featured_tiles
    (tab_id, position, variant, badge_label, badge_kind, headline, href, media_asset_id, cta_label) values
    (v_tab, 0, 'dark',  'For rent', 'dot', 'Featured rentals', '/rent', null, 'Browse rentals'),
    (v_tab, 1, 'light', 'For rent', 'dot', 'New this week',    '/rent', null, 'Browse rentals');
end $$;
