-- 0155_mortgage_site_locale.sql
-- Which version of the website a mortgage request came from: the English
-- site or the Arabic one, for a column in the team's queue (C1).
--
-- Not `locale`. That column is the language Bazar writes to the applicant in
-- (every email reads it), and the flow serves English only until Bazar
-- approves its Arabic (decision D12), so a request from the Arabic site still
-- gets English emails. This one records where the visitor was: an entry link
-- on an /ar page carries `site=ar` (lib/i18n/routing.ts), the proxy adds it
-- when it sends /ar/mortgages/... to English, and the flow reads it on its
-- first step.
--
-- Null for requests made before this existed, and for a pre-approval made
-- through an adviser's invite link (it is copied from nowhere): the queue
-- shows those as unknown. Set by the submit route right after
-- mortgage_create_request(); the requests guard (0139) leaves this column
-- alone, like every column outside status, clock and decision.

alter table public.mortgage_requests
  add column site_locale text check (site_locale in ('en', 'ar'));

comment on column public.mortgage_requests.site_locale is
  'The website version the request came from (en or ar); null = not recorded. Not the correspondence language, which is locale.';
