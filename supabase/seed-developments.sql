-- seed-developments.sql — Phase 5a
-- Adds Saadiyat Lagoons (Aldar) as a flagship off-plan development with
-- content + 8 units + 3 floor plans. Re-runnable: ON CONFLICT (slug) DO
-- UPDATE on developments; tables for units/plans are wiped first so the
-- script is idempotent. Run via:
--   bash -c 'set -a && source .env.local && set +a && \
--     BODY=$(jq -Rs "{query: .}" < supabase/seed-developments.sql) && \
--     curl -fsSL -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
--       -H "Content-Type: application/json" -d "$BODY" \
--       "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query"'

-- Backfill the existing Mamsha development with content + publish it.
update public.developments
set
  tagline       = 'Bazar exclusive · launched 2023',
  bedrooms_text = '1–4 bed',
  vision        = 'Mamsha is Saadiyat''s first true beachfront freehold cluster — six low-rise residences pressed against an 800m boardwalk, with the Louvre five minutes south.',
  facts = '{
    "architecture": "Mossessian Architecture",
    "landscape": "Cracknell",
    "total_area_ft2": "1,200,000",
    "lagoon_area_ft2": "—",
    "density": "Mid · 32 units/ha",
    "rera_escrow": "ADCB · #04881",
    "service_charge_estimate": "AED 18.5/ft²",
    "tenure": "Freehold · all nationalities"
  }'::jsonb,
  payment_plan = '{
    "name": "60/40 post-handover",
    "milestones": [
      {"percent": 10, "label": "Booking",         "timing": "Today"},
      {"percent": 10, "label": "Within 30 days",  "timing": "+30 days"},
      {"percent": 10, "label": "Foundations",     "timing": "Q1 2026"},
      {"percent": 10, "label": "30% construction","timing": "Q3 2026"},
      {"percent": 20, "label": "Handover",        "timing": "Q4 2027"},
      {"percent": 20, "label": "12mo post",       "timing": "Q4 2028"},
      {"percent": 20, "label": "24mo post",       "timing": "Q4 2029"}
    ],
    "construction_pct": 40,
    "handover_pct": 20,
    "post_handover_pct": 40,
    "post_handover_months": 24
  }'::jsonb,
  escrow_account = 'ADCB · #04881',
  published_at = coalesce(published_at, now())
where slug = 'mamsha-al-saadiyat';

-- Saadiyat Lagoons — flagship demo development matching the design page.
insert into public.developments (
  id, developer_id, area_id, name, slug, status, handover_date,
  total_units, starting_price, description, amenities,
  tagline, bedrooms_text, vision, facts, payment_plan, master_plan,
  escrow_account, published_at
) values (
  '33333333-0000-0000-0000-000000000002',
  '22222222-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000002',
  'Saadiyat Lagoons', 'saadiyat-lagoons', 'pre_launch', '2028-03-01',
  312, 6200000,
  '312 villas and townhouses set across lagoon-fed waterways. The most ambitious freehold launch on Saadiyat since Mamsha — and pre-released to Bazar clients three weeks before the public.',
  array['Private lagoons','Beach pavilion','Clubhouse','Kids'' club','Gym','Spa','Tennis','EV charging'],
  'Bazar exclusive · pre-launch access',
  '3–6 bed',
  'Aldar''s third phase on Saadiyat reimagines beachfront living through 4 km of crystal lagoons that wind between 312 freehold villas and townhouses. The masterplan is by SB Architects with landscaping by EDSA — both behind Saadiyat Reserve and Yas Acres respectively. Six villa types from 3,800 to 8,600 ft², plus a small run of 3-bed townhouses. Direct lagoon access on 64% of plots, beach-access privileges on Mamsha for all residents.',
  '{
    "architecture": "SB Architects",
    "landscape": "EDSA",
    "total_area_ft2": "1,460,000",
    "lagoon_area_ft2": "320,000",
    "density": "Low · 14 units/ha",
    "rera_escrow": "ADCB · #04881",
    "service_charge_estimate": "~AED 8/ft²",
    "tenure": "Freehold · all nationalities"
  }'::jsonb,
  '{
    "name": "60/40 post-handover",
    "milestones": [
      {"percent": 10, "label": "Booking",         "timing": "Today"},
      {"percent": 10, "label": "Within 30 days",  "timing": "+30 days"},
      {"percent": 10, "label": "Foundations",     "timing": "Jan 2027"},
      {"percent": 10, "label": "30% construction","timing": "Aug 2027"},
      {"percent": 20, "label": "Handover",        "timing": "Q1 2028"},
      {"percent": 20, "label": "12mo post",       "timing": "Q1 2029"},
      {"percent": 20, "label": "24mo post",       "timing": "Q1 2030"}
    ],
    "construction_pct": 40,
    "handover_pct": 20,
    "post_handover_pct": 40,
    "post_handover_months": 24
  }'::jsonb,
  '{
    "pins": [
      {"key": "A", "x": 32, "y": 44, "label": "Phase 1 · Villas"},
      {"key": "B", "x": 56, "y": 58, "label": "Phase 2 · Townhouses"},
      {"key": "C", "x": 72, "y": 36, "label": "Lagoon clubhouse"},
      {"key": "D", "x": 18, "y": 70, "label": "Beach pavilion"}
    ]
  }'::jsonb,
  'ADCB · #04881',
  now()
)
on conflict (slug) do update set
  tagline = excluded.tagline,
  bedrooms_text = excluded.bedrooms_text,
  vision = excluded.vision,
  facts = excluded.facts,
  payment_plan = excluded.payment_plan,
  master_plan = excluded.master_plan,
  escrow_account = excluded.escrow_account,
  description = excluded.description,
  starting_price = excluded.starting_price,
  total_units = excluded.total_units,
  handover_date = excluded.handover_date,
  published_at = excluded.published_at,
  amenities = excluded.amenities;

-- Clear and reseed floor_plans + units for Saadiyat Lagoons so this script
-- is fully idempotent.
delete from public.development_units
  where development_id = '33333333-0000-0000-0000-000000000002';
delete from public.floor_plans
  where development_id = '33333333-0000-0000-0000-000000000002';

insert into public.floor_plans (id, development_id, label, beds, area_ft2, sort_order) values
  ('55555555-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'Villa A · 3-bed', 3, 3800, 1),
  ('55555555-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000002', 'Villa C · 4-bed', 4, 5400, 2),
  ('55555555-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000002', 'Villa D · 5-bed', 5, 6200, 3);

insert into public.development_units (development_id, floor_plan_id, unit_type, beds, built_up_ft2, plot_ft2, lagoon_access, orientation, price_aed, plot_number, status, sort_order) values
  ('33333333-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000001', 'Villa A',     3, 3800,  5200, 'Direct',         'NW', 6200000,  'A-12', 'available', 1),
  ('33333333-0000-0000-0000-000000000002', null,                                    'Villa B',     4, 4600,  6400, 'Direct',         'N',  7420000,  'A-18', 'available', 2),
  ('33333333-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000002', 'Villa C',     4, 5400,  7800, 'Direct',         'NE', 8640000,  'B-04', 'available', 3),
  ('33333333-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000003', 'Villa D',     5, 6200,  9200, 'Frontage',       'NW', 10180000, 'B-12', 'available', 4),
  ('33333333-0000-0000-0000-000000000002', null,                                    'Villa E',     6, 7400, 11200, 'Frontage',       'N',  13200000, 'C-02', 'held',      5),
  ('33333333-0000-0000-0000-000000000002', null,                                    'Villa F',     6, 8600, 13400, 'Corner · double','NE', 16800000, 'C-08', 'available', 6),
  ('33333333-0000-0000-0000-000000000002', null,                                    'Townhouse',   3, 2640,  3200, 'Walking · 2 min','NW', 3400000,  'TH-04','held',      7),
  ('33333333-0000-0000-0000-000000000002', null,                                    'Townhouse',   3, 2640,  3200, 'Walking · 2 min','NE', 3400000,  'TH-12','available', 8);

-- Done.
