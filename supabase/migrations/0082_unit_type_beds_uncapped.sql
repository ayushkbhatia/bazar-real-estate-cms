-- ═══════════════════════════════════════════════════════════════════════
-- 0082 · Unit types — no upper bound on the bedroom count
-- ═══════════════════════════════════════════════════════════════════════
--
-- 0079 capped `development_unit_types.beds` at 7 "because that is what the
-- brief provisions for". That was a guess about the catalogue, not a fact
-- about the domain, and the first editor to meet it had no way around it —
-- the CMS reported `Too big: expected number to be <=9` on the bathroom field
-- of a floor plan and there was nothing to change but the code.
--
-- Bedroom and bathroom counts are now unbounded above at every layer: this
-- constraint, the zod schema in `lib/schemas/development-unit-plans.ts`, and
-- the bedroom field on the unit type card (a free number input, no longer a
-- dropdown of 0-7). The floor is kept — a negative count is a typo, never a
-- listing — and `int` still caps the value at 2147483647, which the zod schema
-- mirrors so an overflow reads as a form error rather than a Postgres 22003.
--
-- `floor_plans.beds` and `floor_plans.baths` need no change here: 0009 and
-- 0079 added them as bare `int` with no check, so the zod cap was the only
-- thing rejecting a 10-bathroom layout.

alter table public.development_unit_types
  drop constraint if exists development_unit_types_beds_range;

alter table public.development_unit_types
  add constraint development_unit_types_beds_range
    check (beds is null or beds >= 0);

comment on column public.development_unit_types.beds is
  '0 = studio, null = does not map to a bedroom count (penthouse, duplex). No upper bound — see migration 0082.';
