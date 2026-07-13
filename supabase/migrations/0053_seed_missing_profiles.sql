-- Seed the entities the megamenu linked to but which weren't in the DB
-- (0052 had repointed those links to indexes as a stopgap). Now that the rows
-- exist, restore the direct detail links.
--
-- Developer profiles render from a `developers` row alone (developer_profiles
-- overlay is optional). The Hudayriyat area guide renders via the
-- SEED_AREA_GUIDES fallback (added in lib/seeds/areas.ts); the areas row here
-- makes it appear in the /communities index with a live listing count.

insert into public.developers (slug, name, description) values
  ('radiant-real-estate', 'Radiant Real Estate',
   'Known for modern residential towers, waterfront residences, and strategically located projects across Abu Dhabi''s active communities.'),
  ('ohana-development', 'Ohana Development',
   'A UAE luxury developer known for premium residences, branded collaborations, and lifestyle-led waterfront communities.'),
  ('taraf', 'Taraf',
   'Creates premium residential projects across Dubai and Abu Dhabi, focused on elegant design, exclusivity, and elevated living.')
on conflict (slug) do nothing;

-- `areas` has no unique constraint on slug, so guard with NOT EXISTS
-- rather than ON CONFLICT.
insert into public.areas (slug, name, kind, description)
select 'hudayriyat-island', 'Hudayriyat Island', 'area',
       'One of Abu Dhabi''s rising lifestyle destinations, shaped around waterfront living, sport, and wellness.'
where not exists (select 1 from public.areas where slug = 'hudayriyat-island');

-- Restore the direct megamenu links (reverse of 0052).
update public.megamenu_items
  set href = '/communities/hudayriyat-island'
  where href = '/off-plan/search?area=hudayriyat-island';

update public.megamenu_items
  set href = '/developers/radiant-real-estate'
  where href = '/developers' and label = 'Radiant Real Estate';

update public.megamenu_items
  set href = '/developers/ohana-development'
  where href = '/developers' and label = 'Ohana Development';

update public.megamenu_items
  set href = '/developers/taraf'
  where href = '/developers' and label = 'Taraf';
