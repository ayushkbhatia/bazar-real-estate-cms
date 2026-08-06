-- 0071_property_form.sql
--
-- Adds the buy-side completion form: off-plan / ready-new / resale.
--
-- WHY A NEW COLUMN AND NOT TWO MORE VALUES ON property_mode
-- `mode` already conflates three unrelated dimensions: transaction type
-- (buy/rent), completion form (off_plan) and asset class (commercial). Adding
-- ready_new and resale to it would make "show me all sale stock" a union that
-- every consumer has to know about — the /buy landing, the 12 megamenu links
-- into /buy/search, /price-drops, /new-this-week, the concierge tools. Today
-- each of those is a single `.eq("mode", "buy")` and stays that way.
--
-- It is also reversible. `ALTER TYPE ... ADD VALUE` is a one-way door in
-- Postgres — there is no DROP VALUE — so extending the enum would permanently
-- commit us to an answer the business is still forming. This column can be
-- dropped.
--
-- WHY NULLABLE
-- A form only means something for a sale listing. Rentals have no completion
-- form, and the 3 unclassified drafts must be allowed to exist until someone
-- decides what they are. Completeness is enforced at publish time in
-- lib/publishability.ts, not by NOT NULL — the same pattern the development
-- hero facts use.

create type public.property_form as enum ('off_plan', 'ready_new', 'resale');

alter table public.properties
  add column if not exists property_form public.property_form;

comment on column public.properties.property_form is
  'Buy-side completion form. ready_new = developer first sale, never previously owned. resale = previously owned. off_plan = not yet completed. NULL for rentals, and for sale listings nobody has classified yet — publishing one is blocked in lib/publishability.ts.';

-- A rental has no completion form. Enforced here as well as in zod because the
-- CSV/DLD import path writes rows without going through the form.
alter table public.properties
  drop constraint if exists properties_form_rent_null_ck;

alter table public.properties
  add constraint properties_form_rent_null_ck
  check (mode <> 'rent'::public.property_mode or property_form is null);

-- Partial index: every query that uses this column also filters to published
-- sale stock, and it keeps the index off the 16 rentals.
create index if not exists properties_property_form_idx
  on public.properties (property_form)
  where property_form is not null;
