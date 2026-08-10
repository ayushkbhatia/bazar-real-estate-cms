-- 0083_drop_tour_requests.sql
-- Remove the "Schedule a viewing" surface and its table.
--
-- The card lived in the /p/[slug] sidebar: a date + time + name + phone form
-- whose only sink was `tour_requests`. Nothing ever read the table back. The
-- customer-facing view it was built for (/account/saved → Tour requests) went
-- away with customer accounts in 0068, and no CMS screen replaced it, so every
-- submission since has been write-only. Staff work the same intent through
-- enquiries, and confirmed slots live in `viewings`, which is scheduled from
-- the enquiry detail page and is NOT touched here.
--
-- The table is empty in production (0 rows), so nothing is lost.
--
-- Two dependencies come off first:
--
-- 1. `anonymise_by_email(text)` pseudonymises tour_requests as part of the
--    right-to-erasure scrub. Rebuilt below without that block, and without the
--    `tour_requests` key in its returned tally. Everything else in the body is
--    unchanged from 0067, including the `extensions` search_path that 0067
--    added to make gen_random_bytes() resolve.
--
-- 2. `tour_request_status` is used by nothing else once the table is gone.

create or replace function public.anonymise_by_email(target_email text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'extensions'
as $function$
declare
  pseudonym   text := 'deleted-' || encode(gen_random_bytes(6), 'hex');
  norm        text := lower(trim(target_email));
  acct        uuid;
  n_enq       int := 0;
  n_msg       int := 0;
  n_val       int := 0;
  n_mort      int := 0;
  n_news      int := 0;
begin
  if norm is null or norm = '' then
    raise exception 'anonymise_by_email requires an email address';
  end if;

  -- If the address still has an account, run the account-keyed scrub first so
  -- the two paths cannot drift apart.
  select a.user_id into acct
  from public.accounts a
  join auth.users u on u.id = a.user_id
  where lower(u.email) = norm
  limit 1;

  if acct is not null then
    perform public.anonymise_account(acct);
  end if;

  -- Message bodies on threads belonging to this subject's enquiries. Scrubbed
  -- before the enquiries themselves, while they can still be found by email.
  with threads as (
    select c.id
    from public.conversations c
    join public.enquiries e on e.id = c.enquiry_id
    where lower(e.email) = norm
  )
  update public.messages m
     set body = '[redacted at the data subject''s request]'
   where m.conversation_id in (select id from threads)
     and m.body <> '[redacted at the data subject''s request]';
  get diagnostics n_msg = row_count;

  update public.enquiries
     set name = pseudonym,
         email = null,
         phone = null,
         brief_raw = null,
         internal_notes = null
   where lower(email) = norm;
  get diagnostics n_enq = row_count;

  update public.valuation_requests
     set owner_name = pseudonym,
         owner_email = null,
         owner_phone = null,
         marketing_opt_in = false
   where lower(owner_email) = norm;
  get diagnostics n_val = row_count;

  update public.mortgage_inquiries
     set applicant_name = pseudonym,
         applicant_email = null,
         applicant_phone = null
   where lower(applicant_email) = norm;
  get diagnostics n_mort = row_count;

  -- The newsletter list is a consent record: drop the row outright rather than
  -- pseudonymising it, since a subscription with no identifiable subject has
  -- no purpose and would keep mailing nobody.
  delete from public.newsletter_subscribers where lower(email) = norm;
  get diagnostics n_news = row_count;

  -- Wipe inline IP / user-agent on this subject's own DSR audit rows, keeping
  -- the rows as evidence that the request was handled.
  update public.dsr_requests
     set ip = null, user_agent = null
   where lower(email) = norm;

  return jsonb_build_object(
    'email', norm,
    'account_anonymised', acct is not null,
    'enquiries', n_enq,
    'messages_redacted', n_msg,
    'valuation_requests', n_val,
    'mortgage_inquiries', n_mort,
    'newsletter_subscriptions_deleted', n_news
  );
end;
$function$;

revoke all on function public.anonymise_by_email(text) from public, anon, authenticated;
grant execute on function public.anonymise_by_email(text) to service_role;

comment on function public.anonymise_by_email(text) is
  'Right-to-erasure for a subject identified by email. Service-role only — the admin DSR tool calls it; there is no self-service path since customer accounts were removed.';

-- ── Drop the table ─────────────────────────────────────────────
-- No inbound foreign keys and no dependent views (verified against production
-- before writing this). `cascade` only has to take out the table's own
-- policies, indexes and updated_at trigger.

drop table if exists public.tour_requests cascade;
drop type  if exists public.tour_request_status;
