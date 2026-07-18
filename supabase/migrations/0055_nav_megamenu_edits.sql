-- 0055_nav_megamenu_edits.sql
-- Client nav edits across three megamenu tabs. Content-only except for Rent,
-- which pairs with a generic renderer change in components/brand/megamenu-panel.tsx
-- (right-column headings get the serif title treatment when the tab carries no
-- right_column_title of its own).
--
--   · Areas       — finish the /communities -> /areas rename (0054 missed the
--                   right-zone title) + a second featured tile.
--   · Developers  — drop the mortgage partners column, top 8 developers only,
--                   featured tiles become All Developers + All Partners.
--   · Rent        — split the single "Guides & areas" title into one per column.
--
-- Re-runnable: every insert is preceded by a delete of the rows it replaces.

do $$
declare
  v_areas      uuid;
  v_developers uuid;
  v_rent       uuid;
  v_col        uuid;
begin
  select id into v_areas      from public.megamenu_tabs where slug = 'areas';
  select id into v_developers from public.megamenu_tabs where slug = 'developers';
  select id into v_rent       from public.megamenu_tabs where slug = 'rent';

  -- ─── AREAS ───────────────────────────────────────────────────
  -- 0054 renamed the tab label, panel title and every href, but the right-zone
  -- title still rendered "Abu Dhabi communities" in the panel. "Areas by
  -- lifestyle" describes what that zone actually groups (Waterfront living /
  -- Family living / Beachfront / Luxury) without repeating the left zone's
  -- "Abu Dhabi areas" title verbatim.
  update public.megamenu_tabs
  set right_column_title = 'Areas by lifestyle'
  where id = v_areas;

  -- Second featured tile. A lone tile renders centred at max-w-320; a pair
  -- fills the middle track two-up, as on Buy / Rent / Services.
  delete from public.megamenu_featured_tiles
  where tab_id = v_areas and position = 1;
  insert into public.megamenu_featured_tiles
    (tab_id, position, variant, badge_label, badge_kind, headline, href, cta_label)
  values
    (v_areas, 1, 'light', 'Area guide', 'dot', 'Saadiyat Island', '/areas/saadiyat-island', 'Explore');


  -- ─── DEVELOPERS ──────────────────────────────────────────────
  -- Left zone rebuilt wholesale (items cascade): the mortgage partners column
  -- is gone, Taraf is out, and the "All developer partners" view-all link is
  -- redundant now that both featured tiles point at the master page.
  --
  -- The remaining 8 developers are split 4 + 4 rather than left as one column.
  -- A single left column trips the narrow-zone heuristic in the panel renderer
  -- (max-content track), and with no right zone on this tab the two tiles
  -- would claim the rest of the panel — they are aspect-square, so they'd
  -- render ~620px tall. Two columns keep the balanced 1fr track. Headings stay
  -- null: the "All developers" panel title already names the zone, and an
  -- eyebrow on only the first of two columns would misalign their baselines.
  delete from public.megamenu_columns
  where tab_id = v_developers and zone = 'left';

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_developers, 'left', 0, null)
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Aldar Properties', '/developers/aldar', 'developer'),
    (v_col, 1, 'Modon Properties', '/developers/modon', 'developer'),
    (v_col, 2, 'Bloom Holding',    '/developers/bloom', 'developer'),
    (v_col, 3, 'IMKAN Properties', '/developers/imkan', 'developer');

  insert into public.megamenu_columns (tab_id, zone, position, heading)
  values (v_developers, 'left', 1, null)
  returning id into v_col;
  insert into public.megamenu_items (column_id, position, label, href, target_kind) values
    (v_col, 0, 'Reportage Properties', '/developers/reportage',           'developer'),
    (v_col, 1, 'Eagle Hills',          '/developers/eagle-hills',         'developer'),
    (v_col, 2, 'Radiant Real Estate',  '/developers/radiant-real-estate', 'developer'),
    (v_col, 3, 'Ohana Development',    '/developers/ohana-development',   'developer');

  -- Featured tiles — both route to the /developers master page, which carries
  -- the full partner directory as its "Our partners" grid.
  delete from public.megamenu_featured_tiles where tab_id = v_developers;
  insert into public.megamenu_featured_tiles
    (tab_id, position, variant, badge_label, badge_kind, headline, href, cta_label)
  values
    (v_developers, 0, 'dark',  'Directory',      'dot', 'All Developers', '/developers', 'Browse all'),
    (v_developers, 1, 'light', 'Bazar partners', 'dot', 'All Partners',   '/developers', 'Browse all');


  -- ─── RENT ────────────────────────────────────────────────────
  -- One combined "Guides & areas" title becomes a title per column. Clearing
  -- the tab-level title is what promotes each column heading to the serif
  -- treatment in the panel renderer.
  update public.megamenu_tabs
  set right_column_title = null
  where id = v_rent;

  update public.megamenu_columns
  set heading = 'Guides'
  where tab_id = v_rent and zone = 'right' and position = 0;

  update public.megamenu_columns
  set heading = 'Areas'
  where tab_id = v_rent and zone = 'right' and position = 1;

end $$;
