-- 0038_function_hardening.sql
-- Close the Supabase security-advisor findings from the June 2026 audit.
--
-- 1. anonymise_account(uuid): Postgres grants EXECUTE to PUBLIC on new
--    functions by default, and 0011/0037 additionally granted
--    `authenticated`. The function is SECURITY DEFINER, takes an
--    arbitrary target uuid, and has no auth.uid() guard — so any anon
--    or signed-in caller could irreversibly scrub any account through
--    PostgREST (`/rest/v1/rpc/anonymise_account`). The only legitimate
--    caller is the service-role client in the data-deletion server
--    action (app/(account)/account/data-deletion/_actions.ts), which
--    keeps its explicit service_role grant.
--
-- 2. deal_buyer_account(uuid) is referenced only by deal-room RLS
--    policies scoped to authenticated users; anon has no reason to
--    call it via RPC.
--
-- 3. Trigger / event-trigger functions are fired by the system and
--    never need PostgREST exposure. (EXECUTE on a trigger function is
--    checked at CREATE TRIGGER time, not at fire time, so revoking
--    does not affect the triggers themselves.)
--
-- 4. set_updated_at() had a role-mutable search_path (advisor lint
--    0011). Pin it; the body only touches NEW + pg_catalog.now().

revoke execute on function public.anonymise_account(uuid)
  from public, anon, authenticated;

revoke execute on function public.deal_buyer_account(uuid)
  from public, anon;

revoke execute on function public.set_updated_at()
  from public, anon, authenticated;
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
revoke execute on function public.handle_new_enquiry()
  from public, anon, authenticated;
revoke execute on function public.handle_staff_invitation()
  from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;

alter function public.set_updated_at() set search_path = '';

-- is_admin() / is_staff() / current_staff_role() stay executable by
-- anon + authenticated on purpose: they are evaluated inside RLS
-- policies for those roles and only inspect the caller's own uid.
