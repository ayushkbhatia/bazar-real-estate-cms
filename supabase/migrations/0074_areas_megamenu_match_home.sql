-- 0074_areas_megamenu_match_home.sql
--
-- Makes the Areas megamenu's left column list the same eight communities, in
-- the same order, as the home page's "Location-based browsing" section.
--
-- Before: Saadiyat, Al Reem, Yas, Al Maryah | Al Raha Beach, Khalifa City,
--         Hudayriyat, Masdar City
-- After:  Hudayriyat, Saadiyat, Al Reem, Yas | Zayed City, Al Raha Beach,
--         Masdar City, Al Ghadeer
--
-- Six communities were already common to both. This drops Al Maryah Island
-- and Khalifa City and adds Zayed City and Al Ghadeer, then reorders to match.
--
-- WHY TWO OF THE EIGHT POINT SOMEWHERE DIFFERENT
-- Six link to their community guide at /areas/<slug>. Zayed City and Al
-- Ghadeer link to /buy/search?area=<slug> instead, because neither has an
-- `areas` row or a seeded `area_guides` row — /areas/zayed-city and
-- /areas/al-ghadeer both return 404 today (verified in production). The search
-- route returns 200 with an empty result for an unknown area, which is why the
-- home page's cards have always pointed there.
--
-- That is not cosmetic: e2e/megamenu-links.spec.ts reads every href straight
-- from this table and asserts it does not 404, so linking those two at
-- /areas/... would turn CI red the moment it ran.
--
-- The proper fix is to seed both communities with published guides and move
-- them to /areas/<slug>. That needs real editorial copy — intro, stats,
-- schools, amenities — so it is a content task, tracked separately. When it
-- lands, only these two hrefs change.
--
-- Delete-then-insert rather than eight positional UPDATEs: the rows are
-- reordered as well as swapped, so an in-place rewrite would depend on the
-- current order being exactly what we think it is. This does not.
--
-- Idempotent: re-running produces the same eight rows.
--
-- Applying this through the Supabase MCP does NOT run
-- revalidatePath("/", "layout") — that only fires from the megamenu admin
-- action — so the nav serves the old list from the layout cache until the next
-- deploy or a Save in /admin/megamenu/areas.

do $$
declare
  v_col0 uuid;
  v_col1 uuid;
begin
  select c.id into v_col0
    from public.megamenu_columns c
    join public.megamenu_tabs t on t.id = c.tab_id
   where t.slug = 'areas' and c.zone = 'left' and c.position = 0;

  select c.id into v_col1
    from public.megamenu_columns c
    join public.megamenu_tabs t on t.id = c.tab_id
   where t.slug = 'areas' and c.zone = 'left' and c.position = 1;

  if v_col0 is null or v_col1 is null then
    raise exception '0074: expected two left-zone columns on the areas tab';
  end if;

  delete from public.megamenu_items where column_id in (v_col0, v_col1);

  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col0, 0, 'Hudayriyat Island', '/areas/hudayriyat-island', 'area'),
    (v_col0, 1, 'Saadiyat Island',   '/areas/saadiyat-island',   'area'),
    (v_col0, 2, 'Al Reem Island',    '/areas/al-reem-island',    'area'),
    (v_col0, 3, 'Yas Island',        '/areas/yas-island',        'area');

  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    -- No area row or guide yet — see the note above.
    (v_col1, 0, 'Zayed City',    '/buy/search?area=zayed-city', 'area'),
    (v_col1, 1, 'Al Raha Beach', '/areas/al-raha-beach',        'area'),
    (v_col1, 2, 'Masdar City',   '/areas/masdar-city',          'area'),
    -- No area row or guide yet — see the note above.
    (v_col1, 3, 'Al Ghadeer',    '/buy/search?area=al-ghadeer', 'area');
end $$;
