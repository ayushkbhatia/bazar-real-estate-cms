-- 0154_drop_mortgage_inquiries.sql
-- Remove the unused `mortgage_inquiries` table and its three enums
-- (docs/mortgage/DECISIONS.md D26).
--
-- The table came with the tools in 0008, for the calculator's "save
-- scenario", which was never wired: nothing in the app writes it, and its
-- only reader, the DSR tool's subject lookup, counted rows that never
-- existed. The mortgage module's own tables (0138 onwards) replaced it. It is
-- empty in production (0 rows, checked 1 Oct 2026), and the guard below
-- refuses to run if that has changed. Apply this only after the code that
-- stops reading it is deployed.
--
-- Two dependencies come off first, as 0083 did for `tour_requests`:
--
-- 1. `anonymise_by_email(text)` pseudonymises mortgage_inquiries as part of
--    the right-to-erasure scrub. Rebuilt below without that block, and without
--    the `mortgage_inquiries` key in its returned tally. Everything else in
--    the body is unchanged from 0083.
--
-- 2. `mortgage_inquiry_status`, `mortgage_buyer_status` and
--    `mortgage_loan_type` are used by nothing else once the table is gone (no
--    other column, function signature or view; checked against production).
--
-- No inbound foreign keys and no dependent views. `cascade` only has to take
-- out the table's own policies (including an `anon` insert policy), indexes
-- and updated_at trigger.

do $guard$
begin
  if exists (select 1 from public.mortgage_inquiries) then
    raise exception 'mortgage_inquiries has rows: D26 says keep it (see 0154)';
  end if;
end
$guard$;

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
    'newsletter_subscriptions_deleted', n_news
  );
end;
$function$;

revoke all on function public.anonymise_by_email(text) from public, anon, authenticated;
grant execute on function public.anonymise_by_email(text) to service_role;

comment on function public.anonymise_by_email(text) is
  'Right-to-erasure for a subject identified by email. Service-role only — the admin DSR tool calls it; there is no self-service path since customer accounts were removed.';

-- ── Drop the table ─────────────────────────────────────────────

drop table if exists public.mortgage_inquiries cascade;
drop type  if exists public.mortgage_inquiry_status;
drop type  if exists public.mortgage_buyer_status;
drop type  if exists public.mortgage_loan_type;
