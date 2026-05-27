-- 0036_staff_public_agent_read.sql
-- /agents is a public page; the original staff RLS policies only
-- exposed rows to authenticated callers, so lib/queries/agents.ts
-- silently fell back to lib/seeds/agents.ts (6 hardcoded entries) for
-- anonymous visitors. Add a permissive SELECT policy that exposes
-- only the rows the public marketplace genuinely needs: active agents.
--
-- All non-public staff columns the public page does not query (email,
-- joined_at internal notes, etc.) are unaffected because the queries
-- in lib/queries/agents.ts and lib/queries/staff-agents.ts only request
-- the public-safe field set.
create policy staff_public_agents
  on public.staff
  for select
  to anon, authenticated
  using (role = 'agent' and status = 'active');
