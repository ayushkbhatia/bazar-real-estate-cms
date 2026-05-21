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
  amenities, flags, geo,
  listing_permit_no, listing_permit_expires_at, compliance,
  published_at, created_at
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
   '{"lat": 24.5440, "lng": 54.4406}'::jsonb,
   'ORN-28041-AD', current_date + interval '1 year',
   '{"form_a": true, "title_deed": true, "noc": true, "power_of_attorney": true}'::jsonb,
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
   '{"lat": 24.5358, "lng": 54.4279}'::jsonb,
   'ORN-28041-AD', current_date + interval '1 year',
   '{"form_a": true, "title_deed": true, "noc": true, "power_of_attorney": true}'::jsonb,
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
   '{"lat": 24.5102, "lng": 54.4034}'::jsonb,
   'ORN-28041-AD', current_date + interval '1 year',
   '{"form_a": true, "title_deed": true, "noc": true, "power_of_attorney": true}'::jsonb,
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
   '{"lat": 24.4859, "lng": 54.6005}'::jsonb,
   'ORN-28041-AD', current_date + interval '1 year',
   '{"form_a": true, "title_deed": true, "noc": true, "power_of_attorney": true}'::jsonb,
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
   '{"lat": 24.4145, "lng": 54.6112}'::jsonb,
   'ORN-28041-AD', current_date + interval '1 year',
   '{"form_a": true, "title_deed": true, "noc": true, "power_of_attorney": true}'::jsonb,
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
   '{"lat": 24.4814, "lng": 54.3680}'::jsonb,
   'ORN-28041-AD', current_date + interval '1 year',
   '{"form_a": true, "title_deed": true, "noc": true, "power_of_attorney": true}'::jsonb,
   now() - interval '4 days', now() - interval '4 days')
on conflict (reference) do nothing;

-- ── Articles (Phase 3a) ─────────────────────────────────────────
-- A handful of published articles so /insights renders against real data and
-- the E2E test has something to navigate into. Idempotent on slug.
insert into public.articles (id, slug, title, excerpt, category, status, body_html, read_minutes, published_at, created_at, updated_at) values
  ('55555555-0000-0000-0000-000000000001',
   'saadiyat-q1-2026',
   'Saadiyat closed Q1 up 8.4%. Here''s what that means for the rest of 2026.',
   'A close look at the 67 transactions on the island this quarter, the four neighborhoods that outperformed, and where the smart money is pre-positioning for Q2.',
   'market_report',
   'published',
   '<p>The Saadiyat resale median crossed AED 2,000 per square foot in March for the first time. Two transactions on the Mamsha closed above 2,300. The market is sending a fairly clear signal — but it''s worth being careful about which signal.</p><h2>The headline number</h2><p>Quarterly data from the Department of Municipal Affairs shows 67 closed transactions on Saadiyat in Q1 2026, with a weighted median of AED 2,012/ft². That''s up 8.4% on the same quarter last year, and up 3.6% sequentially from Q4 2025.</p><p>But there are two things to flag immediately. First, transaction volume itself was modest — 67 closes is 12% below the trailing four-quarter average. Second, the pricing strength was heavily concentrated.</p><h2>What''s behind the 8.4%</h2><p>Three drivers, in order of contribution: <strong>Mamsha freehold scarcity</strong>, a <strong>foreign-buyer mix shift</strong>, and what we''re calling the <strong>Louvre effect</strong> finally arriving at the Cultural District.</p><blockquote>Comparable evidence is genuinely scarce — the 67 closes were spread across 23 different building combinations.</blockquote><p>Read together, this looks more like a thin-market melt-up than a structural re-rating.</p>',
   14,
   now() - interval '9 days', now() - interval '9 days', now() - interval '9 days'),
  ('55555555-0000-0000-0000-000000000002',
   'off-plan-payment-plans-decoded',
   'Off-plan: how to read a payment plan without being fooled',
   'An 8-minute deconstruction of post-handover plans, milestone risk, and which developer terms to walk away from.',
   'buyers_guide',
   'published',
   '<p>Most Abu Dhabi off-plan brochures bury the actual financial structure under hero shots and amenity lists. Here''s what to look for instead.</p><h2>The numbers that matter</h2><p>Three figures decide whether a payment plan is buyer-friendly or developer-friendly: the <strong>at-handover percentage</strong>, the <strong>post-handover tail</strong>, and the implied <strong>interest cost</strong>.</p><ul><li>At-handover ≤ 50% is generous.</li><li>A post-handover tail ≥ 30% over 2–3 years means you''re effectively financed by the developer.</li><li>Watch for milestone definitions that drift — "70% structure complete" is not an objective standard.</li></ul><p>The most underrated red flag is the cancellation clause. Read the part nobody reads.</p>',
   8,
   now() - interval '12 days', now() - interval '12 days', now() - interval '12 days'),
  ('55555555-0000-0000-0000-000000000003',
   'freehold-zoning-q2-2026',
   'What the new freehold zoning amendment means for non-resident buyers',
   'A short briefing on the Q2 2026 amendments, who they help, and three counterintuitive consequences.',
   'policy',
   'published',
   '<p>The Q2 2026 freehold zoning amendments expand the list of plots eligible for non-resident ownership across four sub-communities on Saadiyat and one on Yas. The headline is straightforward; the second-order effects less so.</p><h2>Who actually benefits</h2><p>GCC nationals already enjoy parity in most of the same zones, so the practical incremental impact lands on non-GCC foreign buyers — primarily UK, German, and South Asian capital.</p><h3>Three things to watch</h3><ol><li>Building-level NOC requirements remain unchanged, which means individual building boards can still gate non-resident purchases.</li><li>Trakheesi permit timelines have not been updated to match the expanded zone — expect 3–6 week lags in Q3.</li><li>Service-charge transparency rules apply on transfer, not on listing — sellers can still understate.</li></ol>',
   6,
   now() - interval '15 days', now() - interval '15 days', now() - interval '15 days')
on conflict (slug) do nothing;

-- ── Pages (Phase 3b) ────────────────────────────────────────────
-- Sample "About Bazar" page so /pages/about renders against real
-- block data and the E2E test has something to navigate into.
insert into public.pages (id, slug, title, status, blocks, seo, published_at, created_at, updated_at) values
  ('66666666-0000-0000-0000-000000000001',
   'about',
   'About Bazar',
   'published',
   '[
     {
       "type": "hero",
       "eyebrow": "About",
       "title": "Abu Dhabi, properly understood.",
       "subtitle": "Bazar is a twelve-advisor boutique that closes fewer deals by design. We are paid by clients, not developers — and we publish what we know.",
       "cta": { "label": "Meet the team", "href": "/agents" }
     },
     {
       "type": "strip",
       "eyebrow": "How we work",
       "heading": "Curated, not aggregated.",
       "body": "We do not list every property in Abu Dhabi. We list the ones we believe in and can defend with comparable evidence. Most of our briefs do not end in a transaction within ninety days — that is a feature, not a bug.",
       "align": "left"
     },
     {
       "type": "grid",
       "heading": "What we stand for",
       "items": [
         { "title": "Fiduciary advisory", "body": "Paid by clients, not developers. Compensation is transparent and disclosed upfront." },
         { "title": "Off-market access", "body": "Roughly a third of what we transact never appears on Property Finder or Bayut." },
         { "title": "Numerically honest", "body": "Every listing is benchmarked against comparable closes — we will tell you when a listing is overpriced." }
       ]
     },
     {
       "type": "banner",
       "title": "Tell us what you are looking for.",
       "body": "Briefs are confidential and reviewed by a senior advisor within one business day.",
       "cta": { "label": "Open a brief", "href": "/contact" },
       "variant": "ink"
     }
   ]'::jsonb,
   '{"meta_title":"About Bazar — Abu Dhabi, properly understood","meta_description":"Bazar is a twelve-advisor boutique real-estate firm covering Abu Dhabi. Fiduciary advisory, off-market access, and numerically honest analysis."}'::jsonb,
   now() - interval '6 days', now() - interval '20 days', now() - interval '6 days')
on conflict (slug) do nothing;
