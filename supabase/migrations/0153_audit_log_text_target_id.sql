-- 0153 · `audit_log.target_id` becomes text.
--
-- It was a uuid (0001), but about thirty of the app's ~130 audit calls name a
-- target that has no uuid: the site-settings singleton ("1"), the floating-CTA rail
-- ("rail"), the Salesforce sync settings ("settings"), a form's key, an
-- amenity's code, a blog category's slug, a Salesforce listing id, and a data
-- subject's email for the DSR export and erasure. Every one of those inserts
-- failed with 22P02 (invalid input syntax for type uuid), and `logAudit()`
-- swallows a failed insert by design, so the rows were never written. The
-- audit log is the PDPL/AML evidence; the DSR rows above are the ones a
-- regulator would ask for first.
--
-- The free-text search on /admin/audit-log failed the same way: it filters
-- `target_id ilike …`, and there is no ilike for uuid (42883), so every search
-- came back empty.
--
-- Text, not "null at the call sites": the id is the information. Existing
-- uuids become their canonical text form, which is what every reader already
-- compares against (PostgREST hands uuids to the app as that same string).
--
-- What depends on the column, checked against production on 1 Oct 2026:
--   · audit_log_target_idx (target_kind, target_id) — rebuilt by the ALTER.
--   · No view, foreign key, policy or trigger on audit_log reads it.
--   · staff_mortgage_role_audit() (0152) inserts `new.user_id`, a uuid: an
--     insert casts uuid to text by assignment, so it needs no change.

alter table public.audit_log
  alter column target_id type text using target_id::text;

comment on column public.audit_log.target_id is
  'The id of what the action touched, as text: a row''s uuid, or the key a singleton, form, code, slug or data subject is known by. Read with target_kind.';
