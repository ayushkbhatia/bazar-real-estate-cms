-- 0003_audit_insert.sql
-- Staff can append to public.audit_log via their own session. They cannot
-- spoof another actor_id and cannot use actor_kind other than 'user'.
-- (Reads are still admin-only — policy in 0001_core.sql.)

drop policy if exists "audit_log_staff_insert" on public.audit_log;
create policy "audit_log_staff_insert"
  on public.audit_log for insert
  to authenticated
  with check (
    public.is_staff()
    and actor_id = auth.uid()
    and actor_kind = 'user'
  );
