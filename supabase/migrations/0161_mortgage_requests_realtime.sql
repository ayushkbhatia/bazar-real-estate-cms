-- 0161 · The mortgage CMS updates live (Bazar, 14 Oct 2026).
--
-- "When the leads are switched between stages in the kanban view, their
-- statuses should update universally across the mortgage admin panel — a 1:1
-- sync, instantly."
--
-- The queue (list and board) and the file page re-read on their own every 30
-- and 60 seconds, so a move made on the board in one tab, or by another
-- adviser, took up to a minute to show anywhere else. Publishing the requests
-- table to Supabase Realtime lets each of those screens hear a change the
-- moment it commits and re-read (`usePostgresChanges`, a router refresh). The
-- polling stays, as the fallback for a dropped connection.
--
-- Realtime checks each change against the subscriber's own RLS before
-- delivering it: `mortgage_requests_team_select` already limits a request to
-- the mortgage team, so nobody hears about a request they could not read.
-- The screens use the event only as a signal and re-read through the same
-- loaders as before; nothing renders from the payload.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mortgage_requests'
     ) then
    alter publication supabase_realtime add table public.mortgage_requests;
  end if;
end;
$$;
