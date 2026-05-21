-- seed.sql — Bazar Real Estate
-- Phase 0 / 1 placeholder data so the marketplace has something to render.
-- Idempotent: uses ON CONFLICT (slug/reference) DO NOTHING.
-- Run via: bash scripts/db-seed.sh
--
-- Notes:
--   - We seed catalogue entities only (no staff or accounts). To create the
--     first admin user, sign up via /sign-up with your real email and then
--     run scripts/promote-staff.sh <email> admin.
--   - Property assigned_agent_id is NULL until staff are seeded.

-- ── Areas ───────────────────────────────────────────────────────
-- Abu Dhabi emirate + 5 sub-areas matching the home mosaic.
insert into public.areas (id, parent_id, kind, name, slug, description) values
  ('11111111-0000-0000-0000-000000000001', null, 'emirate', 'Abu Dhabi', 'abu-dhabi', 'The capital of the United Arab Emirates.')
on conflict (parent_id, slug) do nothing;

insert into public.areas (id, parent_id, kind, name, slug, description) values
  ('11111111-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'area', 'Saadiyat Island', 'saadiyat-island', 'Cultural island home to the Louvre Abu Dhabi, beach villas, and Mamsha Al Saadiyat.'),
  ('11111111-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'area', 'Yas Island',      'yas-island',      'Entertainment-led island with Ferrari World, Yas Marina Circuit, and waterfront living.'),
  ('11111111-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', 'area', 'Al Reem Island',  'al-reem-island',  'Mid-island skyline of high-rise towers, schools, and waterfront apartments.'),
  ('11111111-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', 'area', 'Al Raha',         'al-raha',         'Established mainland community: Al Raha Beach, Al Raha Gardens.'),
  ('11111111-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000001', 'area', 'Corniche',        'corniche',        'The eight-kilometre waterfront promenade and surrounding addresses.')
on conflict (parent_id, slug) do nothing;

-- ── Developers ──────────────────────────────────────────────────
insert into public.developers (id, name, slug, founded_year, description) values
  ('22222222-0000-0000-0000-000000000001', 'Aldar Properties', 'aldar', 1992, 'Abu Dhabi-headquartered developer of Saadiyat, Yas, and many of the emirate''s flagship master-plans.')
on conflict (slug) do nothing;

-- ── Developments ────────────────────────────────────────────────
insert into public.developments (id, developer_id, area_id, name, slug, status, handover_date, total_units, starting_price, description, amenities) values
  ('33333333-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000002',
   'Mamsha Al Saadiyat', 'mamsha-al-saadiyat', 'on_sale', '2027-12-01', 461, 2800000,
   'Beachfront residences on Saadiyat with direct access to the Cultural District.',
   array['Private beach','Concierge','Infinity pool','Spa','Kids'' club','Fitness']
  )
on conflict (slug) do nothing;

-- ── Properties (6 published listings matching the home placeholder grid) ──
insert into public.properties (
  id, reference, slug, title, short_description, description,
  mode, status, type, area_id, sub_community_id,
  beds, baths, built_up_ft2, year_built,
  tenure, furnishing, view, price_aed, service_charge_per_ft2,
  amenities, flags, published_at, created_at
) values
  ('44444444-0000-0000-0000-000000000001',
   'BAZ-AD-04891', 'mamsha-3-bed-beachfront-apartment',
   'Mamsha · 3-bed beachfront apartment',
   'Three-bedroom beachfront residence with direct lagoon access on Saadiyat.',
   'A rare three-bedroom unit in the Mamsha Al Saadiyat development with uninterrupted views toward the Louvre and direct beach access via the private boardwalk. Includes maid''s room, two parking bays, and access to the residents'' clubhouse.',
   'buy', 'published', 'apartment',
   '11111111-0000-0000-0000-000000000002', null,
   3, 4, 2840, 2023,
   'freehold', 'fully', 'Sea view', 4200000, 18.5,
   array['Beach access','Concierge','Pool','Gym','Sauna','Covered parking'],
   '{"exclusive": true, "vacant_on_transfer": true, "mortgage_eligible": true}'::jsonb,
   now() - interval '2 days', now() - interval '2 days'),

  ('44444444-0000-0000-0000-000000000002',
   'BAZ-AD-04864', 'nudra-5-bed-villa',
   'Nudra · 5-bed villa with private pool',
   'Cantilevered Nudra villa with rooftop terrace and private pool on Saadiyat Beach.',
   'One of only 37 villas in the iconic Nudra cluster: 6,200 ft² of single-floor living with five bedrooms, a 14-metre pool, double-height majlis, and dedicated staff quarters. Walking distance to Saadiyat Beach Club.',
   'buy', 'published', 'villa',
   '11111111-0000-0000-0000-000000000002', null,
   5, 6, 6200, 2017,
   'freehold', 'fully', 'Beach view', 12500000, 14.2,
   array['Private pool','Garden','Beach access','Maid''s room','Driver''s room','Smart home'],
   '{"vacant_on_transfer": true, "mortgage_eligible": true}'::jsonb,
   now() - interval '5 days', now() - interval '5 days'),

  ('44444444-0000-0000-0000-000000000003',
   'BAZ-AD-04887', 'reflection-skyline-penthouse',
   'Reflection · Skyline penthouse',
   'Two-bedroom penthouse with 270° skyline views over Al Reem.',
   'Top-floor unit in the Reflection tower with floor-to-ceiling glazing, a 32-metre private terrace, and direct lift access. Building amenities include three pools, a residents'' lounge, and 24-hour concierge.',
   'buy', 'published', 'penthouse',
   '11111111-0000-0000-0000-000000000004', null,
   2, 3, 1980, 2021,
   'freehold', 'semi', 'Skyline view', 2800000, 16.0,
   array['Pool','Gym','Concierge','Covered parking','Storage'],
   '{"mortgage_eligible": true}'::jsonb,
   now() - interval '1 day', now() - interval '1 day'),

  ('44444444-0000-0000-0000-000000000004',
   'BAZ-AD-04902', 'yas-bay-2-bed-waterfront',
   'Yas Bay · 2-bed waterfront apartment',
   'Waterfront two-bedroom in Yas Bay with marina views.',
   'Newly handed-over two-bedroom apartment overlooking the Yas Bay marina and Etihad Arena. Includes two parking bays, full kitchen appliances, and access to the Yas Bay residents'' amenities.',
   'buy', 'published', 'apartment',
   '11111111-0000-0000-0000-000000000003', null,
   2, 2, 1340, 2024,
   'freehold', 'fully', 'Marina view', 1850000, 17.5,
   array['Pool','Gym','Beach club access','Covered parking'],
   '{"mortgage_eligible": true}'::jsonb,
   now() - interval '3 days', now() - interval '3 days'),

  ('44444444-0000-0000-0000-000000000005',
   'BAZ-AD-04911', 'al-raha-gardens-3-bed-townhouse',
   'Al Raha Gardens · 3-bed townhouse',
   'Family townhouse in Al Raha Gardens with private garden.',
   'Three-bedroom townhouse in the Sidra cluster with a private rear garden, study, and maid''s room. Walking distance to Yasmina British Academy and Aldar Headquarters.',
   'buy', 'published', 'townhouse',
   '11111111-0000-0000-0000-000000000005', null,
   3, 4, 2410, 2010,
   'freehold', 'unfurnished', 'Garden view', 2950000, 9.4,
   array['Private garden','Maid''s room','Community pool','Tennis court'],
   '{"mortgage_eligible": true}'::jsonb,
   now() - interval '7 days', now() - interval '7 days'),

  ('44444444-0000-0000-0000-000000000006',
   'BAZ-AD-04920', 'corniche-2-bed-rental',
   'Corniche · 2-bed apartment for rent',
   'Two-bedroom rental with Corniche and skyline views.',
   'Mid-floor two-bedroom apartment on the Corniche with views toward Marina Mall and the Etihad Towers. Chiller-free building, two parking bays, and 12-month furnished lease.',
   'rent', 'published', 'apartment',
   '11111111-0000-0000-0000-000000000006', null,
   2, 3, 1480, 2018,
   'leasehold', 'fully', 'Sea view', 160000, null,
   array['Pool','Gym','Concierge','Covered parking','Chiller-free'],
   '{}'::jsonb,
   now() - interval '4 days', now() - interval '4 days')
on conflict (reference) do nothing;
