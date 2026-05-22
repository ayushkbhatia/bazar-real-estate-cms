-- 0027_enquiry_extras.sql
-- Sprint 10 — workflow flags on enquiries.
--
-- ack_sent_at        — when the auto-reply (Sprint 11 Edge Function OR
--                      Sprint 10 fallback cron) fired. Idempotency key.
-- escalated_at       — when enquiry-escalation cron flagged the row
--                      to the manager fallback (60 min unanswered).
-- nurture_day7_at    — valuation_inquiries field analog for valuations
--                      lives on `valuation_inquiries` table; for
--                      enquiries the nurture happens at enquiry close.

set local search_path = public, auth, extensions;

alter table public.enquiries
  add column if not exists ack_sent_at  timestamptz,
  add column if not exists escalated_at timestamptz;

create index if not exists enquiries_unacked_idx
  on public.enquiries (created_at)
  where ack_sent_at is null;

create index if not exists enquiries_unescalated_idx
  on public.enquiries (created_at)
  where escalated_at is null and assigned_agent_id is null;

-- Valuation nurture tracking. valuations table doesn't yet exist with
-- this exact name in db/types.ts — guard with conditional via DO block.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'valuation_inquiries'
  ) then
    execute 'alter table public.valuation_inquiries
              add column if not exists nurture_day7_at  timestamptz,
              add column if not exists nurture_day30_at timestamptz';
  end if;
end$$;
