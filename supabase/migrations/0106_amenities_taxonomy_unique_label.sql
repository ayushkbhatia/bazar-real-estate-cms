-- 0106 — one active amenity per label.
--
-- We store amenity *labels*, not codes: properties.amenities is a text[] of
-- "Playground", and lib/amenities.ts resolves a stored value back to the
-- taxonomy by label (see the note at the top of that file). The table,
-- however, keys on code — so two rows can carry the same label, and to the
-- rest of the system they are the same amenity twice.
--
-- That is exactly what happened. /admin/settings/fields rejects a duplicate
-- *code* with "Code already exists. Toggle the existing entry instead." and
-- says nothing about the label, so when the taxonomy was rebuilt on
-- 2026-08-13 each collision was worked around by doubling a letter in the
-- code: balconyy, sea_vieww, canal_viewss, covered_parkingg, walkin_closet,
-- marinaa, picnic_areass, playgroundd. Eight labels, sixteen rows.
--
-- Five of those pairs were tidied by hand at the time — the older seeded row
-- deactivated, the new one kept. Three were missed and left both rows active,
-- which is what surfaced in the property editor: one tick of "Playground"
-- wrote the label twice, spending two slots of the amenities cap for one
-- visible selection. The app-side half of that shipped in #386 (toOptions
-- collapses duplicate labels, orderAmenities de-duplicates its output), so
-- this migration is not load-bearing for the bug — it removes the phantom at
-- the source and stops the next one being created.

set local search_path = public, auth, extensions;

-- ── The three pairs left half-finished ───────────────────────────────────
-- Deactivated, not deleted, matching how the other five were resolved and
-- the table's own convention (inactive rows stay so a historical code on an
-- existing listing still resolves). The keeper in each pair is the newer,
-- re-categorised row, which is also the one the app already picks today.
--
-- Safe to drop from the active set: no row in properties.amenities or
-- developments.amenities stores any of these six codes, and each pair shares
-- one label character-for-character, so nothing a listing holds changes
-- meaning. Neither side of these three pairs carries an icon or a label_ar.
update public.amenities_taxonomy
   set active = false
 where code in ('playground', 'marina', 'picnic_areas')
   and active;

-- ── Stop it recurring ────────────────────────────────────────────────────
-- Partial, because the five already-resolved pairs (and these three) keep an
-- inactive row holding the same label on purpose — the constraint we want is
-- "one *selectable* amenity per label", not "one row ever". `active` is
-- `not null`, so `where active` covers precisely the rows the picker, the
-- facet and the public read policy can see.
--
-- lower(btrim(...)) matches how lib/amenities.ts compares labels, so a label
-- the app would treat as a duplicate is one the database refuses too. Note
-- this admits "Sea view" alongside "Sea View" no more than the app does.
create unique index if not exists amenities_taxonomy_active_label_uniq
  on public.amenities_taxonomy (lower(btrim(label)))
  where active;
