-- 0130 · Salesforce lead sync — the queue lives on the enquiry row.
--
-- Phase 1 of the Salesforce integration pushes every public enquiry into the
-- `Lead__c` custom object. The queue is these columns rather than a separate
-- table on purpose: an enquiry IS the unit of work, `crm_sync_state` defaults
-- to 'pending', and so every insert path — the shared form action, the owner
-- wizard, the service leads, the valuation gate — enqueues itself with no code
-- change and no chance of one path being forgotten.
--
-- ── On the backfill ──────────────────────────────────────────────────────
-- Existing rows are set to 'skipped', not 'pending'. Without that line the
-- first cron run would replay the entire historical enquiry table into the
-- client's CRM as brand-new leads. 'skipped' is also honest in a way that
-- back-dating `crm_synced_at` would not be: those leads were never sent.
--
-- ── On exactly-once ──────────────────────────────────────────────────────
-- `Lead__c` currently has no field marked as an External ID, so the only
-- available verb is POST (create) — a crash between Salesforce committing and
-- us recording `crm_external_id` re-sends on the next run and duplicates the
-- lead. `crm_attempts` caps that blast radius at MAX_ATTEMPTS rather than
-- forever. The moment Levarus adds an External ID field, setting
-- SALESFORCE_LEAD_EXTERNAL_ID_FIELD switches the client to PATCH-upsert and
-- the window closes; no schema change is needed for that.

alter table public.enquiries
  add column crm_sync_state text not null default 'pending',
  add column crm_external_id text,
  add column crm_synced_at timestamptz,
  add column crm_attempts integer not null default 0,
  add column crm_last_error text,
  add column crm_next_attempt_at timestamptz not null default now();

-- Everything that predates the integration is out of scope, permanently.
update public.enquiries set crm_sync_state = 'skipped';

alter table public.enquiries
  add constraint enquiries_crm_sync_state_ck
  check (crm_sync_state in ('pending', 'synced', 'failed', 'skipped'));

-- The cron's only query: due, pending, oldest first. Partial so the index
-- stays the size of the backlog rather than the size of the table.
create index enquiries_crm_pending_idx
  on public.enquiries (crm_next_attempt_at)
  where crm_sync_state = 'pending';

-- One Salesforce record per enquiry. Belt-and-braces against the duplicate
-- window described above: if a retry ever does succeed twice, the second
-- write fails loudly here instead of silently overwriting the first id.
create unique index enquiries_crm_external_id_key
  on public.enquiries (crm_external_id)
  where crm_external_id is not null;

comment on column public.enquiries.crm_sync_state is
  'Salesforce Lead__c push: pending | synced | failed | skipped. Defaults to pending so every enquiry insert path enqueues itself.';
comment on column public.enquiries.crm_external_id is
  'Salesforce record id returned by the create call, e.g. a04iy0000000PsrAAE.';
comment on column public.enquiries.crm_last_error is
  'Last Salesforce errorCode + message. Retained after a successful retry for triage.';

-- The integrations panel at /admin/settings/integrations renders a card per
-- KIND_META key and reads status from this enum. No row is inserted here: the
-- cron upserts one on its first run, and PostgreSQL will not let a value added
-- by this transaction be used inside it.
alter type public.integration_kind add value if not exists 'salesforce';
