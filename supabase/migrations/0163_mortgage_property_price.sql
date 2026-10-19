-- 0163_mortgage_property_price.sql
-- The price, in dirhams, of the property an applicant hopes to buy: an
-- optional answer on W2 (Bazar, 19 Oct 2026), so the mortgage team reading a
-- request has a sense of what the applicant is eligible for before they call.
--
-- Optional and never a gate: a request without it is as complete as one with
-- it, and nothing the team or the database does depends on it. Null for every
-- request made before this existed and for any applicant who left it empty.
--
-- Set by the submit route right after mortgage_create_request(), like
-- site_locale (0155), so that function's signature doesn't change; the
-- requests guard (0139) leaves this column alone, like every column outside
-- status, clock and decision.

alter table public.mortgage_requests
  add column property_price_aed bigint check (property_price_aed > 0 and property_price_aed < 10000000000);

comment on column public.mortgage_requests.property_price_aed is
  'The applicant''s desired property price in AED, as given on W2; null = not given. Informational only.';
