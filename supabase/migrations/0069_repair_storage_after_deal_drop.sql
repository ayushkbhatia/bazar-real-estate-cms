-- 0069_repair_storage_after_deal_drop.sql
-- HOTFIX: media uploads have been failing since 0068.
--
-- 0068 ran `drop table public.deals cascade`. CASCADE removed the table and
-- everything Postgres tracks a dependency for — but Postgres does NOT parse
-- function bodies for dependencies, so `public.deal_buyer_account(uuid)`
-- survived while the table it queries did not:
--
--     ERROR 42P01: relation "public.deals" does not exist
--     QUERY: select buyer_account_id from public.deals where id = deal_id;
--
-- That function is called by the RLS policy `documents_deal_buyer_select` on
-- `storage.objects` — which lives in the `storage` schema and depends on the
-- FUNCTION, not the table, so CASCADE never reached it either.
--
-- Postgres evaluates every permissive policy for a command. So ANY select on
-- storage.objects by an authenticated user hit the broken policy and errored,
-- and Supabase's upload does an existence check before writing. Net effect:
-- image upload stopped working everywhere — the media library and every
-- section editor — for a reason that had nothing to do with images.
--
-- Two more casualties of the same blind spot, fixed here:
--
--   · `anonymise_account(uuid)` still deleted from saved_properties and
--     saved_searches. Right-to-erasure would have thrown on the first of
--     them, and `anonymise_by_email` (0067) delegates to it whenever the
--     subject has an account. This is the second time that function has been
--     silently broken; 0067 fixed its search_path, and 0068 broke its body.
--
--   · The `documents` storage bucket and its seven policies guarded the KYC
--     and deal-document vault, removed in phase 5. The bucket is empty
--     (verified: 0 objects) and unreachable.
--
-- The media bucket, its policies and all 57 objects in it are untouched.

-- ── 1. Storage policies for a feature that no longer exists ─────
drop policy if exists documents_account_own_insert on storage.objects;
drop policy if exists documents_account_own_select on storage.objects;
drop policy if exists documents_deal_buyer_select  on storage.objects;
drop policy if exists documents_staff_all_select   on storage.objects;
drop policy if exists documents_staff_all_insert   on storage.objects;
drop policy if exists documents_staff_all_update   on storage.objects;
drop policy if exists documents_staff_all_delete   on storage.objects;

-- ── 2. The function the policy called ───────────────────────────
drop function if exists public.deal_buyer_account(uuid);

-- ── 3. The bucket itself ────────────────────────────────────────
-- NOT dropped here: Postgres refuses direct deletes from storage.buckets
-- ("Direct deletion from storage tables is not allowed"), and rightly. The
-- bucket is empty and now has no policies, so nothing can read or write it.
-- Remove it via the Storage API or the dashboard if you want it gone.

-- ── 4. Repair anonymise_account ─────────────────────────────────
-- Rebuilt from the live definition with only the two dropped-table deletes
-- removed, so the rest of the scrub is untouched.
CREATE OR REPLACE FUNCTION public.anonymise_account(target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
declare
  pseudonym text := 'deleted-' || encode(gen_random_bytes(6), 'hex');
begin
  -- accounts: zero out PII fields, set the timestamps.
  update public.accounts
    set first_name = null,
        last_name = null,
        nationality = null,
        residency_status = null,
        marketing_opt_in = false,
        deleted_at = now(),
        anonymised_at = now()
    where user_id = target;

  -- enquiries: keep the row, scrub the inline PII so the audit trail still
  -- shows that an enquiry happened from this account.
  update public.enquiries
    set name = pseudonym,
        email = null,
        phone = null,
        brief_raw = '[redacted on user request]',
        inferred_constraints = null,
        internal_notes = null
    where account_id = target;

  -- messages authored by the user: redact the body.
  update public.messages
    set body = '[redacted on user request]'
    where author_id = target;

  -- viewings: drop notes + feedback (PII). Keep the slot + status.
  update public.viewings
    set notes = null,
        feedback = null
    where account_id = target;

  -- newsletter: mark as unsubscribed and drop the contact.
  update public.newsletter_subscribers
    set email = pseudonym || '@redacted.invalid',
        status = 'unsubscribed',
        unsubscribed_at = now(),
        confirmation_token = null,
        account_id = null
    where account_id = target;

  -- saved_* + reviews: hard-delete; no audit value, all PII.
  delete from public.reviews           where account_id = target;
end;
$function$;
