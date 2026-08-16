-- 0110_off_plan_is_a_buy_form.sql
--
-- Off-plan is a way of BUYING, so it is written on the buy-side axis too.
--
-- `properties.mode` has always carried off-plan as a sibling of `buy`, which
-- reads as "off-plan is not a purchase". It is one: a plan bought before
-- handover is a sale with a longer completion. #408 patched the consequence in
-- the query layer — `mode = 'buy'` expands to `in ('buy','off_plan')` — but the
-- rows themselves still said the two were alternatives, and every new consumer
-- had to learn the umbrella by reading the code.
--
-- This writes the fact down. `property_form` (0071) already declares 'off_plan'
-- in its enum; it was simply never written, because two writable spellings of
-- one concept looked like a trap. It is the smaller trap: the completion axis
-- is exactly where "not yet built" belongs, beside ready_new and resale.
--
-- WHY `mode` KEEPS 'off_plan'
-- Deliberate duplication. Dropping the mode value would mean rewriting the
-- /off-plan routes, the mode tabs, syndication portal mappings, the concierge
-- tool schema and the Meilisearch document in one migration, for no visitor
-- benefit. `ALTER TYPE` has no DROP VALUE either, so the enum entry would
-- survive regardless. The trigger below keeps the two spellings from ever
-- contradicting each other, which is the failure mode duplication actually has.
--
-- WHAT THIS GIVES THE SEARCH SURFACES
-- /buy/search can now narrow by completion form the same way /buy/ready and
-- /buy/resale do — off-plan stock becomes a facet *inside* buy, not only a
-- separate route. Before this, `property_form` was NULL on all 18 published
-- rows, so the facet would have matched nothing.

-- 1 ── Backfill. Every published row in the catalogue is mode = 'off_plan'.
update public.properties
set property_form = 'off_plan'::public.property_form
where mode = 'off_plan'::public.property_mode
  and property_form is distinct from 'off_plan'::public.property_form;

-- 2 ── Keep the two spellings in step, whoever writes the row.
--
-- A trigger rather than a CHECK: the CSV/DLD importer, the seed script and the
-- syndication inbound path all write `mode` without knowing this rule exists,
-- and a CHECK would turn that into a failed import. Filling the value is the
-- behaviour we want anyway — there is exactly one correct form for an off-plan
-- row.
--
-- It only ever fills. mode = 'buy' with property_form = 'off_plan' is a
-- legitimate combination (an off-plan unit filed on the buy axis), so moving a
-- row off `mode = 'off_plan'` leaves its form alone.
create or replace function public.properties_sync_off_plan_form()
returns trigger
language plpgsql
as $$
begin
  if new.mode = 'off_plan'::public.property_mode
     and new.property_form is distinct from 'off_plan'::public.property_form then
    new.property_form := 'off_plan'::public.property_form;
  end if;
  return new;
end;
$$;

comment on function public.properties_sync_off_plan_form() is
  'Fills property_form = off_plan on any row whose mode is off_plan, so the completion axis never contradicts the transaction axis. Fills only; never clears.';

drop trigger if exists properties_sync_off_plan_form_tr on public.properties;

create trigger properties_sync_off_plan_form_tr
  before insert or update of mode, property_form on public.properties
  for each row
  execute function public.properties_sync_off_plan_form();

comment on column public.properties.property_form is
  'Buy-side completion form. off_plan = not yet completed, bought from the developer before handover (mirrored from mode = off_plan by properties_sync_off_plan_form). ready_new = developer first sale, never previously owned. resale = previously owned. NULL for rentals, and for sale listings nobody has classified yet — publishing one is blocked in lib/publishability.ts.';
