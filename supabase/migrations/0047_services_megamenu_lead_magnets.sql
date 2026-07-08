-- 0047_services_megamenu_lead_magnets.sql
-- Rebuild the Services megamenu panel as six "lead magnet" cards under
-- "Our Services" (client audit). Each service is its own column: the service
-- name is the column heading, the one-line description is the (clickable)
-- entry linking to the service page. The panel lays six left-zone columns out
-- as a 3-up grid (see megamenu-panel.tsx). Old columns + promo tiles dropped.
--
-- Data-only; references the tab by slug.

do $$
declare
  v_tab uuid;
  v_buy uuid; v_sell uuid; v_rent uuid; v_list uuid; v_manage uuid; v_mortgage uuid;
begin
  select id into v_tab from public.megamenu_tabs where slug = 'services';
  if v_tab is null then raise notice 'services tab missing'; return; end if;

  delete from public.megamenu_items
    where column_id in (select id from public.megamenu_columns where tab_id = v_tab);
  delete from public.megamenu_columns where tab_id = v_tab;
  delete from public.megamenu_featured_tiles where tab_id = v_tab;

  update public.megamenu_tabs
    set panel_title = 'Our Services',
        panel_title_href = '/services',
        right_column_title = null
    where id = v_tab;

  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'left', 0, 'Buy a Property') returning id into v_buy;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'left', 1, 'Sell Your Property') returning id into v_sell;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'left', 2, 'Rent a Property') returning id into v_rent;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'left', 3, 'List Your Property') returning id into v_list;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'left', 4, 'Property Management') returning id into v_manage;
  insert into public.megamenu_columns (tab_id, zone, position, heading)
    values (v_tab, 'left', 5, 'Mortgage Support') returning id into v_mortgage;

  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_buy,      0, 'Find the right residential, commercial, or land opportunity.', '/services/buy',           'service'),
    (v_sell,     0, 'Market and sell your property or land with professional support.', '/services/sell',      'service'),
    (v_rent,     0, 'Helping tenants find suitable homes and commercial spaces.', '/rent',                     null),
    (v_list,     0, 'Supporting landlords with leasing and tenant placement.', '/services/sales-leasing',      'service'),
    (v_manage,   0, 'Managing properties with ongoing care and professional service.', '/services/manage',     'service'),
    (v_mortgage, 0, 'Guiding buyers with financing and mortgage assistance.', '/tools/mortgage',               null);
end $$;
