-- 0178 · Buy menu: the seven "Our Expertise" areas under "Abu Dhabi Locations".
--
-- The client asked (24 Nov 2026) for Nareel Island, Khalifa City, Shakhbout
-- City, Al Bateen, Zayed City, MBZ City and Al Shamkha in the Buy menu. All
-- seven are existing areas; this creates none. Zayed City is already listed,
-- so six links are added.
--
-- The right zone is two unheaded columns that read as ONE list
-- (`zoneIsOneSplitList`: the phone drawer rejoins them 2-up), 6 + 6 today.
-- Six more would make it 6 + 12, so the list is rebalanced to 9 + 9 in the
-- same reading order: the islands first (Jubail and Ramhan move up beside
-- the other islands, Nareel joins them), then the mainland districts.
--
-- Data only, idempotent: an item is matched on its href, so a second run
-- moves nothing and adds nothing. Also editable at /admin/navigation.

begin;

do $$
declare
  islands  uuid;
  mainland uuid;
begin
  select c.id into islands
    from public.megamenu_columns c
    join public.megamenu_tabs t on t.id = c.tab_id
   where t.slug = 'buy' and c.zone = 'right' and c.position = 2;
  select c.id into mainland
    from public.megamenu_columns c
    join public.megamenu_tabs t on t.id = c.tab_id
   where t.slug = 'buy' and c.zone = 'right' and c.position = 3;

  if islands is null or mainland is null then
    raise notice '0178: Buy menu right-zone columns not found; nothing to do';
    return;
  end if;

  -- The two islands that sat at the head of the second column.
  update public.megamenu_items set column_id = islands, position = 6
   where column_id = mainland and href = '/buy/search?area=jubail-island';
  update public.megamenu_items set column_id = islands, position = 7
   where column_id = mainland and href = '/buy/search?area=ramhan-island';

  insert into public.megamenu_items (column_id, position, label, label_ar, href)
  select islands, 8, 'Nareel Island', 'جزيرة ناريل', '/buy/search?area=nareel-island'
   where not exists (select 1 from public.megamenu_items
                      where column_id in (islands, mainland)
                        and href = '/buy/search?area=nareel-island');

  -- The mainland, in the order they were: Al Raha, Masdar City, Al Ghadeer,
  -- Zayed City; then the new districts.
  update public.megamenu_items set position = 0 where column_id = mainland and href = '/buy/search?area=al-raha-beach';
  update public.megamenu_items set position = 1 where column_id = mainland and href = '/buy/search?area=masdar-city';
  update public.megamenu_items set position = 2 where column_id = mainland and href = '/buy/search?area=al-ghadeer';
  update public.megamenu_items set position = 3 where column_id = mainland and href = '/buy/search?area=zayed-city';

  insert into public.megamenu_items (column_id, position, label, label_ar, href)
  select mainland, v.position, v.label, v.label_ar, v.href
    from (values
      (4, 'Khalifa City',   'مدينة خليفة',        '/buy/search?area=khalifa-city'),
      (5, 'MBZ City',       'مدينة محمد بن زايد', '/buy/search?area=mohammed-bin-zayed-city'),
      (6, 'Shakhbout City', 'مدينة شخبوط',        '/buy/search?area=shakhbout-city'),
      (7, 'Al Bateen',      'البطين',             '/buy/search?area=al-bateen'),
      (8, 'Al Shamkha',     'الشامخة',            '/buy/search?area=al-shamkha')
    ) as v(position, label, label_ar, href)
   where not exists (select 1 from public.megamenu_items i
                      where i.column_id in (islands, mainland) and i.href = v.href);
end $$;

commit;
