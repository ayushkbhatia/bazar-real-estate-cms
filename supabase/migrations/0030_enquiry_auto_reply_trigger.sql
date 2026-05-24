-- 0030_enquiry_auto_reply_trigger.sql
-- BF-6 — Postgres webhook on `enquiries` INSERT that fires the
-- enquiry-auto-reply Edge Function for sub-minute SLA.
--
-- pg_net is Supabase's extension for outbound HTTP from Postgres. The
-- trigger fires AFTER INSERT (so the row id + timestamps are stable)
-- and posts the standard Supabase webhook payload shape that the
-- Edge Function in supabase/functions/enquiry-auto-reply expects.
--
-- The Edge Function URL is read from `app_settings.functions_base_url`
-- (a one-row config table) so the migration is environment-agnostic —
-- staging + production set their respective values via the dashboard.
--
-- The Sprint 10 /api/cron/enquiry-auto-reply Vercel cron remains as a
-- 1-minute fallback sweep; ack_sent_at idempotency in both code paths
-- makes dual-firing a no-op.

set local search_path = public, auth, extensions;

create extension if not exists pg_net;

-- Idempotent one-row config table — set the values via:
--   insert into app_settings (key, value) values
--     ('functions_base_url',
--      'https://<project-ref>.functions.supabase.co')
--   on conflict (key) do update set value = excluded.value;
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_staff_read on public.app_settings;
create policy app_settings_staff_read on public.app_settings
  for select to authenticated using (public.is_staff());

drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Helper that returns the configured functions base url (or NULL).
create or replace function public.functions_base_url()
returns text
language sql stable security definer set search_path = public
as $$
  select value from public.app_settings where key = 'functions_base_url' limit 1;
$$;

-- Trigger function: POSTs the new enquiry row to the Edge Function.
create or replace function public.fire_enquiry_auto_reply()
returns trigger
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_url text;
  v_payload jsonb;
begin
  v_url := public.functions_base_url();
  if v_url is null then
    -- Edge Function not yet wired in this environment — silently noop
    -- so the Sprint 10 cron fallback owns the SLA.
    return new;
  end if;

  v_payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'enquiries',
    'schema', 'public',
    'record', to_jsonb(new),
    'old_record', null
  );

  -- Fire-and-forget. pg_net handles the HTTP off the trigger thread,
  -- so the insert never blocks on the Edge Function response.
  perform net.http_post(
    url := v_url || '/functions/v1/enquiry-auto-reply',
    body := v_payload,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

drop trigger if exists enquiries_auto_reply on public.enquiries;
create trigger enquiries_auto_reply
  after insert on public.enquiries
  for each row execute function public.fire_enquiry_auto_reply();
