-- 0072_backfill_property_form.sql
--
-- Classifies the existing catalogue.
--
-- READ THIS BEFORE TRUSTING THE RESULT.
--
-- "ready-new" means NEVER PREVIOUSLY SOLD — developer first-sale inventory.
-- That is provenance, and no column on `properties` records it. `year_built`
-- is age, not sale history: a 2024 tower resold twice is, by this definition,
-- a resale.
--
-- So the split below is a STARTING POINT chosen with the client, not a fact
-- the data supports. It exists so both /buy/ready and /buy/resale launch with
-- stock rather than one of them being empty. Staff correct any listing from
-- the Property form control on /admin/properties/[id] in seconds, and that is
-- the expected workflow for the first pass.
--
-- Expected effect on the catalogue as it stands (39 buy rows):
--   year_built >= 2023  -> ready_new   (13 rows: 6x2023, 5x2024, 2x2025)
--   year_built <  2023  -> resale      (23 rows, 2008-2022)
--   year_built is null  -> left NULL   (3 rows, all unpublished drafts)
--
-- The 3 NULL rows are deliberately left unclassified rather than guessed.
-- They are drafts, so nothing public changes, and lib/publishability.ts blocks
-- publishing a sale listing with no form — which puts the decision in front of
-- whoever publishes it, at the moment they know the answer.
--
-- off_plan is NOT backfilled from mode='off_plan'. Those 10 rows keep saying
-- off-plan through `mode` alone for now; introducing a second writable
-- spelling of the same concept before the column has bedded in is how you get
-- rows that disagree with themselves. Consolidating the two is a later,
-- deliberate migration.
--
-- Idempotent: only touches rows whose form is still NULL, so a re-run after
-- staff have reclassified will not undo their work.

do $$
declare
  n_ready integer;
  n_resale integer;
begin
  update public.properties
     set property_form = 'ready_new'
   where mode = 'buy'
     and property_form is null
     and year_built is not null
     and year_built >= 2023;
  get diagnostics n_ready = row_count;

  update public.properties
     set property_form = 'resale'
   where mode = 'buy'
     and property_form is null
     and year_built is not null
     and year_built < 2023;
  get diagnostics n_resale = row_count;

  raise notice '0072: classified % ready_new, % resale; buy rows with no year_built left NULL for staff',
    n_ready, n_resale;
end $$;
