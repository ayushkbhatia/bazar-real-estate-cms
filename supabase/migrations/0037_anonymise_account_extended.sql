-- 0037_anonymise_account_extended.sql
-- Extend public.anonymise_account() (originally 0011_dsr.sql) to cover the
-- PII surfaces missed by the first cut. The original migration covered
-- accounts / enquiries / messages / viewings / newsletter / saved_* /
-- reviews — but Bazar accumulated five more PII-bearing tables since
-- (valuation_requests, mortgage_inquiries, tour_requests, referrals,
-- recently_viewed, comparisons, notifications, concierge_sessions,
-- concierge_messages) plus inline IP / user-agent on audit_log and
-- dsr_requests that should be wiped on right-to-be-forgotten.
--
-- Philosophy unchanged from 0011:
--   - rows on AML-relevant tables stay (valuation, mortgage, tour,
--     enquiries, viewings, dsr_requests, audit_log) with inline PII
--     wiped, so post-hoc reconstruction of who-interacted-with-us
--     still works for the 7-year AML retention window.
--   - rows with no AML value get hard-deleted (notifications,
--     comparisons, recently_viewed, concierge_sessions + cascade).

create or replace function public.anonymise_account(target uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  pseudonym text := 'deleted-' || encode(gen_random_bytes(6), 'hex');
begin
  -- ── Original 0011_dsr.sql scrubs ───────────────────────────────

  update public.accounts
    set first_name = null,
        last_name = null,
        nationality = null,
        residency_status = null,
        marketing_opt_in = false,
        deleted_at = now(),
        anonymised_at = now()
    where user_id = target;

  update public.enquiries
    set name = pseudonym,
        email = null,
        phone = null,
        brief_raw = '[redacted on user request]',
        inferred_constraints = null,
        internal_notes = null
    where account_id = target;

  update public.messages
    set body = '[redacted on user request]'
    where author_id = target;

  update public.viewings
    set notes = null,
        feedback = null
    where account_id = target;

  update public.newsletter_subscribers
    set email = pseudonym || '@redacted.invalid',
        status = 'unsubscribed',
        unsubscribed_at = now(),
        confirmation_token = null,
        account_id = null
    where account_id = target;

  delete from public.saved_properties where user_id = target;
  delete from public.saved_searches    where user_id = target;
  delete from public.reviews           where account_id = target;

  -- ── New in 0037: scrubs on AML-retained tables ─────────────────

  update public.valuation_requests
    set owner_name = pseudonym,
        owner_email = null,
        owner_phone = null,
        address_line = null,
        building_name = null,
        unit_number = null,
        marketing_opt_in = false
    where account_id = target;

  update public.mortgage_inquiries
    set applicant_name = pseudonym,
        applicant_email = null,
        applicant_phone = null,
        annual_income_aed = null,
        notes = null
    where account_id = target;

  update public.tour_requests
    set full_name = pseudonym,
        email = null,
        phone = null,
        message = null
    where account_id = target;

  update public.referrals
    set notes = null
    where referrer_account_id = target or referee_account_id = target;

  -- audit_log: keep the row (AML 7-year retention), null transient
  -- network identifiers tied to the user's actions.
  update public.audit_log
    set ip = null,
        user_agent = null
    where actor_id = target;

  -- dsr_requests: keep rows (the audit trail of the deletion itself)
  -- but null inline network identifiers. We intentionally keep the
  -- `email` column so a future legal request can correlate which
  -- account corresponds to which prior request.
  update public.dsr_requests
    set ip = null,
        user_agent = null
    where account_id = target;

  -- ── New in 0037: hard-deletes on no-AML-value tables ───────────

  -- Notifications: transient; payload may contain property titles,
  -- enquiry briefs, deal references etc.
  delete from public.notifications where user_id = target;

  -- Recently viewed: pure browsing history.
  delete from public.recently_viewed where user_id = target;

  -- Comparisons: user-named lists of properties.
  delete from public.comparisons where account_id = target;

  -- Concierge sessions: chat history with the AI advisor.
  -- concierge_messages cascade-delete via session_id FK.
  delete from public.concierge_sessions where user_id = target;
end;
$$;

-- Grant unchanged from 0011_dsr.sql; restating for completeness.
grant execute on function public.anonymise_account(uuid) to service_role, authenticated;
