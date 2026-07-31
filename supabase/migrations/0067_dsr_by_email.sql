-- 0067_dsr_by_email.sql
-- Make data-subject requests work without customer accounts.
--
-- With the customer-account surface removed, the personal data Bazar holds is
-- keyed by EMAIL, not by account: enquiries, tour requests, valuation requests,
-- mortgage enquiries, newsletter subscriptions and the message threads hanging
-- off an enquiry. Nobody signs in, so there is no `accounts` row to hang a
-- request on.
--
-- Two things follow.
--
-- 1. `dsr_requests.account_id` was `not null`. A request from someone who never
--    had an account — which is now everyone — could not be recorded at all. It
--    becomes nullable. `email` is already `not null` and is the real subject
--    key.
--
-- 2. `anonymise_account(uuid)` scrubs by account id, so it cannot serve a
--    subject who has no account. `anonymise_by_email(text)` is the email-keyed
--    equivalent, and delegates to `anonymise_account` when an account does
--    exist so the two never diverge.
--
-- Retention philosophy is unchanged from 0011/0037: rows on AML-relevant
-- tables are KEPT with their inline PII wiped, so who-interacted-with-us can
-- still be reconstructed for the 7-year window. Nothing here hard-deletes.
--
-- 3. FIXES A LATENT BUG IN anonymise_account. It builds its pseudonym with
--    gen_random_bytes(), which pgcrypto installs into the `extensions` schema,
--    while its search_path is only `public, auth`. Any real call therefore
--    fails outright:
--        ERROR 42883: function gen_random_bytes(integer) does not exist
--    Right-to-erasure has never actually run. Found by invoking it from the
--    new email-keyed path; both functions now carry `extensions`.

alter table public.dsr_requests
  alter column account_id drop not null;

comment on column public.dsr_requests.account_id is
  'Legacy link to a customer account. Null for every request since customer accounts were removed — `email` is the subject key.';

-- ── anonymise_by_email(text) ────────────────────────────────────
-- Returns a JSON tally of what was scrubbed, so the admin can show the staff
-- member what actually happened rather than a bare "done".
create or replace function public.anonymise_by_email(target_email text)
returns jsonb
language plpgsql
security definer
-- `extensions` is required: pgcrypto installs gen_random_bytes() there, and
-- omitting it is exactly what left anonymise_account broken (see below).
set search_path = public, auth, extensions
as $$
declare
  pseudonym   text := 'deleted-' || encode(gen_random_bytes(6), 'hex');
  norm        text := lower(trim(target_email));
  acct        uuid;
  n_enq       int := 0;
  n_msg       int := 0;
  n_tour      int := 0;
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

  update public.tour_requests
     set full_name = pseudonym,
         email = null,
         phone = null
   where lower(email) = norm;
  get diagnostics n_tour = row_count;

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
    'tour_requests', n_tour,
    'valuation_requests', n_val,
    'mortgage_inquiries', n_mort,
    'newsletter_subscriptions_deleted', n_news
  );
end;
$$;

revoke all on function public.anonymise_by_email(text) from public, anon, authenticated;
grant execute on function public.anonymise_by_email(text) to service_role;

comment on function public.anonymise_by_email(text) is
  'Right-to-erasure for a subject identified by email. Service-role only — the admin DSR tool calls it; there is no self-service path since customer accounts were removed.';

-- ── Repair anonymise_account's search_path ──────────────────────
-- Same defect, same fix. Rebuilt from the live definition so the body is
-- untouched and only the search_path changes — the body is 200+ lines of
-- table-by-table scrubbing that must not be restated here and drift.
do $$
declare
  def text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'anonymise_account'
  limit 1;

  if def is null then
    raise notice 'anonymise_account not found - nothing to repair';
    return;
  end if;

  if def like '%extensions%' then
    raise notice 'anonymise_account already has extensions on its search_path';
    return;
  end if;

  def := replace(def, 'SET search_path TO public, auth',
                      'SET search_path TO public, auth, extensions');
  def := replace(def, 'SET search_path TO ''public'', ''auth''',
                      'SET search_path TO ''public'', ''auth'', ''extensions''');
  execute def;
  raise notice 'anonymise_account search_path repaired';
end $$;
