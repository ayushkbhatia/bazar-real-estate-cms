-- 0057_harden_catchup_functions.sql
-- Hardening for the three functions introduced by the 0056 catch-up.
--
-- Supabase's security advisor flagged all three after 0056 was applied:
--
--   functions_base_url() and fire_enquiry_auto_reply() are SECURITY DEFINER.
--   Postgres grants EXECUTE to PUBLIC by default, which exposed both over
--   PostgREST as /rest/v1/rpc/... to the anon role. For functions_base_url()
--   that was a real leak: it returns app_settings.functions_base_url, and
--   that table's RLS restricts reads to staff — so an anonymous caller could
--   read the value by going through the RPC instead of the table.
--
--   fire_enquiry_auto_reply() is a trigger function, so a direct RPC call is
--   rejected by Postgres regardless; it is revoked for tidiness.
--
-- Revoking from PUBLIC does not break the enquiries_auto_reply trigger:
-- EXECUTE on a trigger function is checked at CREATE TRIGGER time, not when
-- the trigger fires, and fire_enquiry_auto_reply() is SECURITY DEFINER, so
-- its internal call to functions_base_url() runs as the function owner.
-- Verified after applying: an anon INSERT into public.enquiries through
-- PostgREST still returns 201 with the trigger attached.

revoke execute on function public.functions_base_url()      from public, anon, authenticated;
revoke execute on function public.fire_enquiry_auto_reply()  from public, anon, authenticated;

-- match_properties() is SECURITY INVOKER, so a mutable search_path is a
-- hardening gap rather than a privilege-escalation path. Pin it anyway;
-- extensions is required for the pgvector <=> operator.
create or replace function public.match_properties(
  query_embedding vector(1024),
  match_limit int default 8
)
returns table (property_id uuid, distance float)
language sql stable
set search_path = public, extensions
as $$
  select pe.property_id, (pe.embedding <=> query_embedding) as distance
  from public.property_embeddings pe
  join public.properties p on p.id = pe.property_id
  where p.status = 'published' and p.deleted_at is null
  order by pe.embedding <=> query_embedding
  limit match_limit;
$$;

grant execute on function public.match_properties(vector, int)
  to anon, authenticated, service_role;
