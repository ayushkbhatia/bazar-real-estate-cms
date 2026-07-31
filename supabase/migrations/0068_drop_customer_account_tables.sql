-- 0068_drop_customer_account_tables.sql
-- Phase 9: drop the tables left behind by the customer-account removal.
--
-- Runs LAST, after every line of app code that touched these was deleted
-- (phases 1-8). Each table below was verified empty in production and has no
-- remaining reader or writer in app/, lib/ or components/.
--
--   saved_properties   the heart on listing cards
--   saved_searches     "Save search" in the filter bar; its alert crons and
--                      lib/saved-search-alerts.ts went with it
--   recently_viewed    the "Recent" tab on /account/saved
--   referrals          /account/referrals
--   comparisons        the account-backed compare list. NOTE: the compare
--                      TOOL survives — CompareButton and /tools/compare keep
--                      their state client-side and never touched this table
--   deals              the Deal Room (phase 5)
--   documents          the KYC vault and deal documents (phase 5)
--
-- WHAT IS DELIBERATELY NOT DROPPED
--
-- `accounts` STAYS. It is referenced by fourteen tables, eight of which
-- survive: enquiries, dsr_requests, newsletter_subscribers, valuation_requests,
-- mortgage_inquiries, tour_requests, viewings and reviews. Their `account_id`
-- columns are nullable legacy links and cost nothing. More to the point, all
-- fifteen rows in `accounts` belong to STAFF — the handle_new_user trigger
-- creates one for every auth user, staff included — so dropping it would take
-- out the staff records too. There are zero customer rows to remove.
--
-- `tour_requests` and `viewings` STAY. Tour requests are a public lead form on
-- the property page that anonymous visitors submit; viewings are scheduled by
-- staff from the enquiry. Neither needed an account.
--
-- `dsr_requests` STAYS — it is the compliance evidence that a data-subject
-- request was handled, and 0067 made its account_id nullable precisely so it
-- outlives accounts.
--
-- Order matters: `documents` and `deals` reference each other's neighbourhood,
-- so documents goes first. Everything else is independent.

drop table if exists public.documents cascade;
drop table if exists public.deals cascade;
drop table if exists public.saved_properties cascade;
drop table if exists public.saved_searches cascade;
drop table if exists public.recently_viewed cascade;
drop table if exists public.referrals cascade;
drop table if exists public.comparisons cascade;

-- Enums that existed only for the dropped tables. Guarded individually: a
-- dependency left anywhere means the type is still needed, and failing loudly
-- there is better than a cascade quietly removing a column.
do $$ begin
  drop type if exists public.deal_stage;
exception when dependent_objects_still_exist then
  raise notice 'deal_stage still has dependents - left in place';
end $$;

do $$ begin
  drop type if exists public.document_kind;
exception when dependent_objects_still_exist then
  raise notice 'document_kind still has dependents - left in place';
end $$;

do $$ begin
  drop type if exists public.document_status;
exception when dependent_objects_still_exist then
  raise notice 'document_status still has dependents - left in place';
end $$;

do $$ begin
  drop type if exists public.document_owner_kind;
exception when dependent_objects_still_exist then
  raise notice 'document_owner_kind still has dependents - left in place';
end $$;

do $$ begin
  drop type if exists public.referral_status;
exception when dependent_objects_still_exist then
  raise notice 'referral_status still has dependents - left in place';
end $$;
