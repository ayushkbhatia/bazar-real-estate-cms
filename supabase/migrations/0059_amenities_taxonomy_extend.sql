-- 0057 · Extend the amenity taxonomy to cover the vocabulary already in use.
--
-- `properties.amenities` is a text[] of labels. The taxonomy seeded in 0001
-- holds 21 entries, but the live catalogue uses 42 distinct values — the
-- other 29 ("Private garden", "Tennis court", "Marina access"…) were typed
-- free-hand before the picker existed and have no entry, so the picker shows
-- them as "not in the amenity list".
--
-- This adds the ones that are actually in use, so those listings resolve
-- cleanly and the values become selectable for everyone else. Additive only:
-- no listing rows are touched, and an admin can rename or deactivate any of
-- these under Settings → Fields.
--
-- Counts are uses across the catalogue at the time of writing.
insert into public.amenities_taxonomy (code, label, category, icon, sort_order, active)
values
  ('private_garden',  'Private garden',    'outdoor',   'leaf',      220, true),  -- 14
  ('community_pool',  'Community pool',    'outdoor',   'pool',      230, true),  -- 11
  ('tennis_court',    'Tennis court',      'outdoor',   'racquet',   240, true),  --  9
  ('beach_club',      'Beach club access', 'community', 'umbrella',  250, true),  --  7
  ('marina_access',   'Marina access',     'outdoor',   'anchor',    260, true),  --  5
  ('chiller_free',    'Chiller-free',      'building',  'snowflake', 270, true),  --  4
  ('lagoon_access',   'Lagoon access',     'outdoor',   'waves',     280, true),  --  4
  ('golf_access',     'Golf access',       'community', 'flag',      290, true),  --  3
  ('terrace',         'Terrace',           'outdoor',   'wind',      300, true),  --  2 (+ variants)
  ('study',           'Study',             'indoor',    'book',      310, true),  --  2
  ('hotel_service',   'Hotel service',     'building',  'bell',      320, true),  --  2
  ('loading_dock',    'Loading dock',      'building',  'truck',     330, true),  --  2
  ('elevator',        'Elevator',          'building',  'arrow-up',  340, true),  --  1
  ('mezzanine',       'Mezzanine',         'indoor',    'layers',    350, true),  --  1
  ('yard_area',       'Yard area',         'outdoor',   'square',    360, true)   --  1
on conflict (code) do nothing;

-- Left deliberately unmapped, because each needs a human decision rather than
-- a guess: 'Private beach' vs the existing 'Beach access'; 'Park access' vs
-- 'Park view'; '24-hour security' vs 'Security gate' vs the existing
-- '24h security'; 'Rooftop terrace' / 'Wraparound terrace' / 'Private terrace'
-- vs the new 'Terrace'; 'Bay access'; 'Cycle park access'; 'Parking' vs
-- 'Covered parking'; 'Loading area' vs 'Loading dock'; 'Footfall premium';
-- 'Entertainment suite'. They keep rendering on their listings and show in the
-- editor under "not in the amenity list" until someone folds them in.
