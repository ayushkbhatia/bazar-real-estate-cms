-- 0131 · Right to erasure has to reach Salesforce too.
--
-- The privacy policy names Salesforce as a processor and tells the public
-- their enquiry data is held there (see lib/master-pages/sections/
-- legal-privacy.ts §3/§4). Migration 0130 made that true. This makes the
-- other half true: `anonymise_by_email` (0067) scrubs Postgres and has never
-- known anything about the CRM, so without this an erasure request would
-- leave a fully identifiable copy of the subject sitting in the client's org.
--
-- ── Why a column and not "just call Salesforce in the action" ────────────
-- The Postgres scrub is the part with the legal deadline, and it must not be
-- blocked on a third party being reachable. So the action queues the CRM work
-- *before* it scrubs, attempts it inline, and clears the marker on success —
-- which means a Salesforce outage, or a crash halfway through, leaves a row
-- that the sync cron will finish later rather than an obligation nobody can
-- see.
--
-- ── Why this cannot be derived ───────────────────────────────────────────
-- `anonymise_by_email` sets `enquiries.email = null`, so a second later there
-- is no way to ask "which CRM records belonged to that address". The marker
-- has to be written while the link still exists. Inferring it afterwards from
-- `name like 'deleted-%'` would be guessing at a pseudonym format that
-- migration 0067 is free to change.

alter table public.enquiries
  add column crm_erasure_due_at timestamptz;

-- The cron's erasure pass reads exactly this set. Partial, because in steady
-- state it is empty: the marker exists only between an erasure request and
-- the CRM confirming the scrub, which is normally one HTTP round trip.
create index enquiries_crm_erasure_due_idx
  on public.enquiries (crm_erasure_due_at)
  where crm_erasure_due_at is not null;

comment on column public.enquiries.crm_erasure_due_at is
  'Set when a PDPL erasure request needs this row''s Salesforce record pseudonymised; cleared once the CRM confirms. Non-null means the obligation is outstanding.';
