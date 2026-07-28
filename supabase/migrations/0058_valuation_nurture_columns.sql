-- 0058_valuation_nurture_columns.sql
-- Fixes a silently-failing cron: /api/cron/post-valuation-nurture.
--
-- 0027 intended to add nurture_day7_at / nurture_day30_at, but wrapped the
-- ALTER in a DO block guarded on a table named `valuation_inquiries` --
-- which has never existed in this schema. The guard was always false, so
-- the columns were never created.
--
-- Meanwhile app/api/cron/post-valuation-nurture/route.ts selects and
-- updates those columns on `valuation_requests` (the table that does
-- exist). Its SELECT therefore returns 42703 "column does not exist",
-- supabase-js reports data as null, `data ?? []` collapses to an empty
-- loop, and the route returns {ok: true, day7: 0, day30: 0}. The cron has
-- been reporting success while sending nothing.
--
-- The s8() escape hatch hid this at the type level: casting the client to
-- `any` meant the compiler could not tell that these columns were absent.
--
-- Add the columns where the code actually uses them.

set local search_path = public, auth, extensions;

alter table public.valuation_requests
  add column if not exists nurture_day7_at  timestamptz,
  add column if not exists nurture_day30_at timestamptz;

-- The cron filters on sent_at within a day window where the matching
-- nurture stamp is still null; these partial indexes match that shape.
create index if not exists valuation_requests_nurture_day7_idx
  on public.valuation_requests (sent_at)
  where nurture_day7_at is null and sent_at is not null;

create index if not exists valuation_requests_nurture_day30_idx
  on public.valuation_requests (sent_at)
  where nurture_day30_at is null and sent_at is not null;

comment on column public.valuation_requests.nurture_day7_at is
  'Set when the day-7 nurture email was sent. Idempotency key for /api/cron/post-valuation-nurture.';
comment on column public.valuation_requests.nurture_day30_at is
  'Set when the day-30 nurture email was sent. Idempotency key for /api/cron/post-valuation-nurture.';
