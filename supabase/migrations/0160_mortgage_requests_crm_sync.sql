-- 0160 · Mortgage requests go to Salesforce as leads (Bazar, 14 Oct 2026).
--
-- "We want a similar configuration for the mortgage enquiries — they should
-- show up as leads in Salesforce. We don't want to show documents, but it
-- should capture the basic details. It should tell in the CRM if it was for
-- a Fast Pre-Approval."
--
-- Same queue as the website's enquiries (0130), on the request itself: the
-- columns default to 'pending', so every request `mortgage_create_request()`
-- makes enrols itself, and the lead-sync cron is the only consumer. What it
-- sends is name, email, mobile, the service and the request's reference and
-- profile — never a document, a file, a consent or a date of birth
-- (lib/salesforce/mortgage-leads.ts).
--
-- `mortgage_requests_guard()` lists the columns only `mortgage_transition()`
-- may change; these are not among them, so the cron's service-role updates
-- pass it untouched.

alter table public.mortgage_requests
  add column crm_sync_state text not null default 'pending',
  add column crm_external_id text,
  add column crm_synced_at timestamptz,
  add column crm_attempts integer not null default 0,
  add column crm_last_error text,
  add column crm_next_attempt_at timestamptz not null default now();

-- The client-walkthrough samples (BZM-26-9xxx, applicants at @example.com)
-- must never reach the CRM. The cron skips that domain too, for any sample
-- made after this; this settles the ones already here. A real request already
-- in the table (the team's own test on 14 Oct) stays pending and is sent.
update public.mortgage_requests
   set crm_sync_state = 'skipped'
 where email like '%@example.com';

alter table public.mortgage_requests
  add constraint mortgage_requests_crm_sync_state_ck
  check (crm_sync_state in ('pending', 'synced', 'failed', 'skipped'));

create index mortgage_requests_crm_pending_idx
  on public.mortgage_requests (crm_next_attempt_at)
  where crm_sync_state = 'pending';

create unique index mortgage_requests_crm_external_id_key
  on public.mortgage_requests (crm_external_id)
  where crm_external_id is not null;

comment on column public.mortgage_requests.crm_sync_state is
  'Salesforce Lead__c push: pending | synced | failed | skipped. Defaults to pending so every new request enqueues itself.';
comment on column public.mortgage_requests.crm_external_id is
  'Salesforce record id returned by the upsert, e.g. a01i1000006UhleAAC.';
comment on column public.mortgage_requests.crm_last_error is
  'Last Salesforce errorCode + message. Retained after a successful retry for triage.';

-- ── Erasure ─────────────────────────────────────────────────────
--
-- An enquiry erased under PDPL keeps its row, pseudonymised, and carries its
-- own `crm_erasure_due_at` marker until the CRM copy is scrubbed (0131). A
-- mortgage request is deleted outright — by a data-subject erasure
-- (`mortgage_erase_requests()`) or the retention job (0151, 0156) — so its Salesforce
-- record id would go with it and the CRM copy would never be scrubbed.
--
-- So the id outlives the row: deleting a request that reached Salesforce
-- queues its record id here, and the lead-sync cron pseudonymises that record
-- exactly as it does an erased enquiry's, then deletes the queue row. Only the
-- Salesforce id is kept — no name, no contact detail.

create table public.salesforce_lead_erasures (
  sf_record_id text primary key,
  source       text not null,
  queued_at    timestamptz not null default now(),
  attempts     integer not null default 0,
  last_error   text
);

comment on table public.salesforce_lead_erasures is
  'Salesforce Lead__c records still to pseudonymise whose source row is already deleted (mortgage requests). Drained by the lead-sync cron.';

-- Service role only: no policy, so staff and the public read nothing.
alter table public.salesforce_lead_erasures enable row level security;

create function public.mortgage_requests_queue_crm_erasure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.crm_external_id is not null then
    insert into public.salesforce_lead_erasures (sf_record_id, source)
    values (old.crm_external_id, 'mortgage_request')
    on conflict (sf_record_id) do nothing;
  end if;
  return old;
end;
$$;

revoke all on function public.mortgage_requests_queue_crm_erasure() from public, anon, authenticated;

create trigger mortgage_requests_queue_crm_erasure_tr
  before delete on public.mortgage_requests
  for each row execute function public.mortgage_requests_queue_crm_erasure();
