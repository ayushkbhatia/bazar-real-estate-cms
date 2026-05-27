-- 0034_catalogue_seed_expansion.sql
-- Sprint 15 Phase 3: seed catalogue records the megamenu already links to.
--
-- The megamenu (0031_megamenu.sql) references slug-based pages for 17
-- areas, 10 developers, and 6 developments — but seed.sql only populated
-- a handful. Without this migration the slug routes 404 because the
-- dynamic-page templates call `notFound()` when the DB row is missing.
--
-- This migration adds:
--   · 14 new areas      (the megamenu's 17 minus 3 already seeded)
--   · 5  new developers (the megamenu's 10 minus 5 already in DB or seed lib)
--   · 6  new developments (the megamenu's featured tiles + solaya-by-aldar)
--
-- Idempotent: ON CONFLICT DO NOTHING. UUID family matches seed.sql
-- (11.. = areas, 22.. = developers, 33.. = developments).
--
-- Content is plausible Abu Dhabi stub copy — the client edits at handover
-- through the admin CMS. Structure exists so the public navigation has
-- no dead links.

-- ── Areas ────────────────────────────────────────────────────────────
-- Top-level areas and sub-communities under the existing Abu Dhabi emirate.
-- Parent IDs: 11.01 = Abu Dhabi · 11.02 = Saadiyat · 11.03 = Yas · 11.05 = Al Raha.

insert into public.areas (id, parent_id, kind, name, slug, description) values
  ('11111111-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000001', 'area',          'ADGM',                'adgm',                'Abu Dhabi Global Market — financial free-zone on Al Maryah Island. Freehold mixed-use towers and the ADGM courts.'),
  ('11111111-0000-0000-0000-000000000008', '11111111-0000-0000-0000-000000000001', 'area',          'Al Maryah Island',    'al-maryah',           'Central business island linking downtown to Reem — The Galleria Mall, Cleveland Clinic, and ADGM offices.'),
  ('11111111-0000-0000-0000-000000000009', '11111111-0000-0000-0000-000000000002', 'sub_community', 'Hidd Al Saadiyat',    'hidd-al-saadiyat',    'Beachfront villa enclave on north Saadiyat. Freehold for all nationalities; large plots, low density.'),
  ('11111111-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000001', 'area',          'Khalifa City',        'khalifa-city',        'Mainland community of villas and low-rise apartments, popular with families working near the airport.'),
  ('11111111-0000-0000-0000-00000000000b', '11111111-0000-0000-0000-000000000001', 'area',          'KIZAD',               'kizad',               'Khalifa Industrial Zone Abu Dhabi — logistics and industrial real estate close to Khalifa Port.'),
  ('11111111-0000-0000-0000-00000000000c', '11111111-0000-0000-0000-000000000001', 'area',          'Masdar City',         'masdar-city',         'Sustainable urban district east of the airport — research campuses, low-rise apartments, and Etihad Eco-Villa.'),
  ('11111111-0000-0000-0000-00000000000d', '11111111-0000-0000-0000-000000000001', 'area',          'Mussafah',            'mussafah',            'Industrial and light-industrial mainland district — warehousing, auto trade, and workforce housing.'),
  ('11111111-0000-0000-0000-00000000000e', '11111111-0000-0000-0000-000000000001', 'area',          'Nurai Island',        'nurai-island',        'Boutique private island off Saadiyat — ultra-prime villa-only inventory, accessed by ferry.'),
  ('11111111-0000-0000-0000-00000000000f', '11111111-0000-0000-0000-000000000003', 'sub_community', 'Yas Acres',           'yas-acres',           'Aldar family-oriented villa community on Yas Island with park frontage and golf access.'),
  ('11111111-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000005', 'sub_community', 'Al Raha Beach',       'al-raha-beach',       'Waterfront apartment cluster within Al Raha — promenade restaurants and the marina.'),
  ('11111111-0000-0000-0000-000000000011', '11111111-0000-0000-0000-000000000005', 'sub_community', 'Al Raha Gardens',     'al-raha-gardens',     'Established Aldar villa community within Al Raha, built around 2010. Mature trees, schools, mosques.'),
  ('11111111-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000002', 'sub_community', 'Mamsha Al Saadiyat',  'mamsha-al-saadiyat',  'Six low-rise beachfront residences pressed against an 800m boardwalk in the Saadiyat Cultural District.'),
  ('11111111-0000-0000-0000-000000000013', '11111111-0000-0000-0000-000000000002', 'sub_community', 'Saadiyat Lagoons',    'saadiyat-lagoons',    'Lagoon-fed villa community on Saadiyat — 312 freehold villas across 4 km of crystal waterways.'),
  ('11111111-0000-0000-0000-000000000014', '11111111-0000-0000-0000-000000000002', 'sub_community', 'Saadiyat Reserve',    'saadiyat-reserve',    'Aldar eco-themed cluster on Saadiyat — low-density villas and townhouses with mangrove views.')
on conflict (parent_id, slug) do nothing;

-- ── Developers ───────────────────────────────────────────────────────
-- Five public UAE developers the megamenu links to. Five more (bloom,
-- imkan, modon, reportage, q-properties) already resolve via the seed
-- lib at lib/seeds/developers.ts — adding them to the DB is a future
-- cleanup, not a 404 fix.

insert into public.developers (id, name, slug, founded_year, description) values
  ('22222222-0000-0000-0000-000000000002', 'Eagle Hills',           'eagle-hills',       2014, 'Abu Dhabi-headquartered real-estate investment and development company behind Marsa Al Arab and several international master-plans.'),
  ('22222222-0000-0000-0000-000000000003', 'IFA Hotels & Resorts',  'ifa-hotels',        1994, 'Hotel-residence developer with UAE and international assets — Fairmont, Raffles, and other branded resorts.'),
  ('22222222-0000-0000-0000-000000000004', 'National Holding',      'national-holding',  2005, 'Abu Dhabi-based diversified developer with retail, hospitality, and residential projects across the emirate.'),
  ('22222222-0000-0000-0000-000000000005', 'RAK Properties',        'rak-properties',    2005, 'Publicly-listed Ras Al Khaimah master-developer behind Mina Al Arab and Hayat Island.'),
  ('22222222-0000-0000-0000-000000000006', 'Tiger Properties',      'tiger-properties',  1976, 'Long-established UAE developer with high-volume apartment supply in Dubai and Sharjah.')
on conflict (slug) do nothing;

-- ── Developments ─────────────────────────────────────────────────────
-- Six new developments the megamenu features. All Aldar-developed and
-- pinned to Saadiyat / Yas / Reem to match the curated "New Projects"
-- tab. Floor plans + units are intentionally omitted — the development
-- page degrades gracefully without them, and the client populates rich
-- unit data through the admin CMS.

insert into public.developments (
  id, developer_id, area_id, name, slug, status, handover_date,
  total_units, starting_price, description, amenities,
  tagline, bedrooms_text, vision, published_at
) values
  ('33333333-0000-0000-0000-000000000003',
   '22222222-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000002',
   'Bayviews Saadiyat', 'bayviews-saadiyat', 'on_sale', '2027-09-01',
   148, 2400000,
   'Mid-rise beachfront apartments on north Saadiyat with a shared infinity pool and direct boardwalk access.',
   array['Beach access','Pool','Concierge','Gym','Covered parking'],
   'Bazar exclusive · public release pending',
   '1–3 bed',
   'A measured complement to Mamsha: smaller floorplates, larger balconies, and the same north-facing beach orientation that defines the Saadiyat freehold cluster.',
   now()),

  ('33333333-0000-0000-0000-000000000004',
   '22222222-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000002',
   'Bulgari Residences', 'bulgari-residences', 'pre_launch', '2028-06-01',
   62, 9500000,
   'Branded residences on Saadiyat — 62 units across two low-rise blocks, fitted to the Bulgari design language.',
   array['Bulgari concierge','Private beach','Spa','Pool','Wine cellar','Cigar lounge','Library'],
   'Pre-launch · Bazar access only',
   '2–5 bed',
   'Branded living in Abu Dhabi has so far been thin; Bulgari fills the gap at the top of the Saadiyat freehold market. Interior architecture by Antonio Citterio Patricia Viel.',
   now()),

  ('33333333-0000-0000-0000-000000000005',
   '22222222-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000002',
   'Mandarin Oriental Residences', 'mandarin-oriental', 'pre_launch', '2028-12-01',
   84, 8200000,
   'Branded apartments and a small villa cluster on Saadiyat, operated by Mandarin Oriental.',
   array['Mandarin concierge','Spa','Pool','Beach club','Restaurant'],
   'Branded living · Bazar exclusive',
   '2–4 bed',
   'Mandarin Oriental brings the same design discipline that defines its hotels to Saadiyat freehold. Service standards are run by the operator, not the developer.',
   now()),

  ('33333333-0000-0000-0000-000000000006',
   '22222222-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000004',
   'Reem Hills Phase 4', 'reem-hills-phase-4', 'on_sale', '2027-04-01',
   220, 3100000,
   'Fourth phase of Reem Hills — mid-rise apartments and townhouses around the master-plan hillside park.',
   array['Park frontage','Pool','Gym','Retail strip','School onsite'],
   'Final phase release',
   '1–4 bed',
   'The closing phase of the Reem Hills master-plan. Townhouses sold out in earlier phases; this phase tilts back to apartments with strong school access.',
   now()),

  ('33333333-0000-0000-0000-000000000007',
   '22222222-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000002',
   'Six Senses Residences', 'six-senses-residences', 'pre_launch', '2029-03-01',
   54, 7800000,
   'Eco-luxury branded residences on Saadiyat — 54 units with a wellness-first programme and a private mangrove reserve.',
   array['Wellness centre','Mangrove walk','Pool','Yoga deck','Organic kitchen','Spa'],
   'Wellness-first · pre-launch',
   '2–4 bed',
   'Six Senses extends its retreat model into residential. The brief prioritises sleep architecture, biophilic interiors, and a smaller-than-usual unit count.',
   now()),

  ('33333333-0000-0000-0000-000000000008',
   '22222222-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000003',
   'Solaya by Aldar', 'solaya-by-aldar', 'on_sale', '2028-01-01',
   190, 2900000,
   'Yas Island launch of mid-rise apartments and a small townhouse cluster — Aldar''s new flagship for the family-investor segment.',
   array['Pool','Gym','Park','Retail strip','Yas Acres access','Co-working'],
   'New launch · public release',
   '1–4 bed',
   'Solaya is Aldar''s thesis on the post-handover Yas Island market: family-friendly amenities at the apartment scale, with a small townhouse cluster as the anchor product.',
   now())
on conflict (slug) do nothing;
