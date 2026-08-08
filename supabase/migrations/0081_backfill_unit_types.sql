-- ═══════════════════════════════════════════════════════════════════════
-- 0081 · Retrofit unit types + placeholder layouts onto every development
-- ═══════════════════════════════════════════════════════════════════════
--
-- The section is universal, so every project already on the site needs
-- something to show and something to edit. Rather than leave 19 blank pages
-- for someone to fill in by hand, derive a starting set from the bedrooms
-- string each project already publishes and seed placeholder layouts under it.
--
-- ⚠ APPLY THIS ONE AFTER THE CODE DEPLOYS, not before.
-- The legacy flat "Floor plans" section on the currently-deployed page lists
-- every `floor_plans` row for a development, with no idea that a unit type
-- exists. Seeding these rows against a deployment that predates this feature
-- would put "Layout A / Layout B" placeholder cards straight onto six live
-- project pages. The version in this branch filters that section to plans with
-- no unit type, which is what makes the seed invisible until it belongs
-- somewhere. 0079 (schema) and 0080 (section order) are safe to run early;
-- this one is not.
--
-- The same rules live in TypeScript (`lib/schemas/development-unit-plans.ts`,
-- `deriveUnitTypeSeeds`) — that copy is the live one, used by the "Add the
-- suggested unit types" button in the CMS and by the public page's fallback
-- when a project has no rows at all. This SQL runs once. Keep them in step.
--
-- Parsing rules, and why:
--   • `\m([1-7])\M` — a standalone digit 1-7. Word boundaries matter: the
--     real data contains "1313", which is a typo, not a 1313-bedroom villa.
--     Bare `[1-7]` would read it as 1 and 3.
--   • "studio" anywhere (case-insensitive) adds a Studio type at beds = 0.
--     "Studios, 1 - 3" is a real value in this table.
--   • Nothing parseable (null, "1313") falls back to 1-3 Bedroom, which is the
--     commonest shape in Abu Dhabi off-plan and is a starting point, not a
--     claim — every field is editable the moment the page loads.

-- ───────────────────────────────────────────────────────────────
-- 1 · Unit types, for developments that have none
-- ───────────────────────────────────────────────────────────────
with target as (
  select d.id as development_id, coalesce(d.bedrooms_text, '') as txt
  from public.developments d
  where not exists (
    select 1 from public.development_unit_types t
      where t.development_id = d.id
  )
),
bounds as (
  select
    t.development_id,
    t.txt ~* 'studio' as has_studio,
    (select min(m.groups[1]::int)
       from regexp_matches(t.txt, '\m([1-7])\M', 'g') as m(groups)) as lo,
    (select max(m.groups[1]::int)
       from regexp_matches(t.txt, '\m([1-7])\M', 'g') as m(groups)) as hi
  from target t
),
beds as (
  select b.development_id, g.beds
  from bounds b
  cross join lateral (
    select 0 as beds where b.has_studio
    union all
    select gs from generate_series(coalesce(b.lo, 1), coalesce(b.hi, 3)) as gs
  ) as g
)
insert into public.development_unit_types
  (development_id, label, beds, blurb, sort_order)
select
  b.development_id,
  case when b.beds = 0 then 'Studio' else b.beds || ' Bedroom' end,
  b.beds,
  'Placeholder copy — say what sets the '
    || case when b.beds = 0 then 'studios' else b.beds || '-bedroom homes' end
    || ' apart: aspect, ceiling height, terrace depth, who they suit.',
  b.beds
from beds b;

-- ───────────────────────────────────────────────────────────────
-- 2 · Two placeholder layouts per unit type
-- ───────────────────────────────────────────────────────────────
-- `media_id` stays null on purpose: the card falls back to the striped
-- PlaceholderImage, which reads as "not set yet" rather than as a real plan.
-- The section shows at most four, so two leaves visible room to add more.
insert into public.floor_plans
  (development_id, unit_type_id, label, beds, description, sort_order)
select
  t.development_id,
  t.id,
  'Layout ' || l.tag,
  t.beds,
  'Placeholder layout — upload the plan drawing and describe how it differs '
    || 'from the others in this unit type.',
  l.ord
from public.development_unit_types t
cross join (values ('A', 0), ('B', 1)) as l(tag, ord)
where not exists (
  select 1 from public.floor_plans f where f.unit_type_id = t.id
);

-- Section placement is migration 0080's job; it can run early, this can't.
