-- 0168_property_mode_sale_or_rent.sql
--
-- `properties.mode` is the transaction, and a transaction is a sale or a
-- letting. Nothing else.
--
-- The column was created (0001) with four values: buy, rent, off_plan,
-- commercial. Two of them were never transactions, and both have since been
-- given an axis of their own:
--
--   · off_plan  — a completion form. `property_form` (0071) holds it beside
--                 ready_new and resale, and 0110 wrote it onto every off-plan
--                 row, with a trigger keeping `mode = 'off_plan'` and
--                 `property_form = 'off_plan'` in step.
--   · commercial — a kind of building. `segment` (0121) holds it, and every
--                 public surface reads that.
--
-- So the two extra values only duplicated facts recorded elsewhere, and the
-- query layer had to know that `buy` meant `in ('buy','off_plan')`. This
-- re-files the rows and closes the column to the two real answers.
--
-- WHY A CHECK AND NOT A NEW ENUM
-- Postgres has no `ALTER TYPE … DROP VALUE`. Replacing the type means a new
-- enum, a column rewrite, and recreating the constraint, index and trigger
-- that mention it, for a result a CHECK gives in one statement. The enum
-- keeps listing all four; the CHECK is what decides. App code narrows its own
-- list in lib/schemas/property.ts (`PROPERTY_MODES`), because the generated
-- db/types.ts will keep reporting the enum's four labels.
--
-- At the time of writing (22 Oct 2026) production held 22 rows on
-- mode = 'off_plan' (18 published, 4 drafts), every one already carrying
-- property_form = 'off_plan', and none on mode = 'commercial'.

-- 1 ── Re-file. Off-plan rows are sales; their form already says off-plan.
-- The coalesce is belt and braces for a row the 0110 trigger somehow missed.
update public.properties
set mode = 'buy'::public.property_mode,
    property_form = coalesce(property_form, 'off_plan'::public.property_form)
where mode = 'off_plan'::public.property_mode;

-- A commercial row is a sale unless something says otherwise: the old
-- `commercial` mode never recorded for sale vs to let, and the building fact
-- moved to `segment` in 0121 (whose backfill already marked these rows
-- commercial). None exist in production; this is for any other database.
update public.properties
set mode = 'buy'::public.property_mode,
    segment = 'commercial'::property_segment
where mode = 'commercial'::public.property_mode;

-- 2 ── The trigger that copied mode = off_plan into property_form has nothing
-- left to copy.
drop trigger if exists properties_sync_off_plan_form_tr on public.properties;
drop function if exists public.properties_sync_off_plan_form();

-- 3 ── Hold the column to the two transactions. Every writer — the CMS, the
-- Salesforce listing sync, the CSV/DLD importer — now fails loudly on any
-- other value rather than reintroducing the duplicate.
alter table public.properties
  drop constraint if exists properties_mode_sale_or_rent_ck;

alter table public.properties
  add constraint properties_mode_sale_or_rent_ck
  check (mode in ('buy'::public.property_mode, 'rent'::public.property_mode));

comment on column public.properties.mode is
  'The transaction: buy (for sale) or rent (to let). Held to those two by properties_mode_sale_or_rent_ck since 0168; the enum''s off_plan and commercial labels are retired. Off-plan is property_form; commercial is segment.';

comment on column public.properties.property_form is
  'Sale-side completion form: off_plan = not yet completed, bought before handover; ready_new = developer first sale, never previously owned; resale = previously owned. NULL for rentals, and for sale listings nobody has classified yet — publishing one is blocked in lib/publishability.ts.';
