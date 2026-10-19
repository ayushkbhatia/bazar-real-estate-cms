-- 0164 · What happened to a newsletter after Resend accepted it: delivered,
-- bounced, marked as spam (docs/NEWSLETTER.md, "Delivery events").
--
-- Resend reports each of those to a webhook (/api/webhooks/resend). Until now
-- nothing listened, so a campaign's report stopped at "Delivered to Resend",
-- and an address that hard-bounced stayed `confirmed` and was mailed again by
-- every campaign after it — which is what gets a sending domain throttled.
--
-- Additive only; the deployed code reads none of it.
--
-- 1. Four columns on `newsletter_deliveries`: when it was delivered, bounced
--    or complained about, and whether a bounce was permanent. Timestamps, not
--    a status: a delivered email can still be reported as spam later, and the
--    send status (`sent`) stays what the sender wrote.
--
-- 2. `newsletter_record_email_event()`, service role only, which the webhook
--    calls once per event. Resend retries a webhook until it gets a 2xx, so it
--    must be safe to run twice: every write is a coalesce or a guarded status
--    change.
--    - The delivery is found by `resend_id`, the id Resend returned for that
--      message at send time.
--    - A PERMANENT bounce marks the subscriber `bounced` — whichever email it
--      was. A hard bounce says the address does not exist, and the
--      confirmation email is the one most likely to find that out. Transient
--      bounces (full mailbox, greylisting) change nothing.
--    - A complaint about a newsletter unsubscribes its recipient. Someone who
--      presses "Report spam" has asked to stop as clearly as the link does,
--      and mailing them again is what mailbox providers penalise.
--    Only `pending` and `confirmed` subscribers change: an `unsubscribed` one
--    stays unsubscribed rather than turning `bounced`.

-- ── 1. Delivery columns ─────────────────────────────────────────

alter table public.newsletter_deliveries
  add column if not exists delivered_at  timestamptz,
  add column if not exists bounced_at    timestamptz,
  add column if not exists bounce_type   text
    check (bounce_type is null or bounce_type in ('permanent', 'transient')),
  add column if not exists complained_at timestamptz;

create index if not exists newsletter_deliveries_resend_id_idx
  on public.newsletter_deliveries (resend_id)
  where resend_id is not null;

-- ── 2. Recording an event ───────────────────────────────────────

-- p_type is Resend's event name without the `email.` prefix. Returns what it
-- matched — 'delivery', 'subscriber', 'both' or 'none' — for the route's log
-- line; an event about some other email the site sent is 'none' and fine.
create or replace function public.newsletter_record_email_event(
  p_email_id   text,
  p_type       text,
  p_recipients text[],
  p_permanent  boolean,
  p_at         timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscriber uuid;
  v_delivery   boolean := false;
  v_changed    integer := 0;
begin
  if p_type not in ('delivered', 'bounced', 'complained') then
    return 'none';
  end if;

  update public.newsletter_deliveries d
     set delivered_at  = case when p_type = 'delivered'
                              then coalesce(d.delivered_at, p_at) else d.delivered_at end,
         bounced_at    = case when p_type = 'bounced'
                              then coalesce(d.bounced_at, p_at) else d.bounced_at end,
         bounce_type   = case when p_type = 'bounced'
                              then case when d.bounce_type = 'permanent' or p_permanent
                                        then 'permanent' else 'transient' end
                              else d.bounce_type end,
         complained_at = case when p_type = 'complained'
                              then coalesce(d.complained_at, p_at) else d.complained_at end
   where p_email_id is not null
     and d.resend_id = p_email_id
  returning d.subscriber_id into v_subscriber;
  v_delivery := found;

  if p_type = 'bounced' and p_permanent then
    update public.newsletter_subscribers s
       set status = 'bounced'
     where s.status in ('pending', 'confirmed')
       and (
         s.id = v_subscriber
         or lower(s.email) = any (
           select lower(r) from unnest(coalesce(p_recipients, '{}'::text[])) r
         )
       );
    get diagnostics v_changed = row_count;
  elsif p_type = 'complained' and v_subscriber is not null then
    update public.newsletter_subscribers s
       set status = 'unsubscribed',
           unsubscribed_at = coalesce(s.unsubscribed_at, p_at)
     where s.id = v_subscriber
       and s.status in ('pending', 'confirmed');
    get diagnostics v_changed = row_count;
  end if;

  return case
    when v_delivery and v_changed > 0 then 'both'
    when v_delivery then 'delivery'
    when v_changed > 0 then 'subscriber'
    else 'none'
  end;
end;
$$;

revoke all on function public.newsletter_record_email_event(text, text, text[], boolean, timestamptz)
  from public, anon, authenticated;
grant execute on function public.newsletter_record_email_event(text, text, text[], boolean, timestamptz)
  to service_role;
