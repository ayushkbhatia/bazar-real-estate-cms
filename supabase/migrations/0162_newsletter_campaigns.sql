-- 0162 · The site's own newsletter: campaigns, deliveries, a stable unsubscribe
-- token (Bazar, 15 Oct 2026: "Let's not use Mailchimp … build our own
-- newsletter build feature", ADR-0009, docs/NEWSLETTER.md).
--
-- Three things, all additive — the deployed code reads none of them, so this
-- is safe to apply before the code that uses it ships.
--
-- 1. `newsletter_subscribers.unsubscribe_token` — permanent, one per
--    subscriber. Unsubscribe links used to carry the CONFIRMATION token, which
--    confirming sets to null: every confirmed subscriber's link was dead. A
--    bulk sender needs a per-recipient link that works for the life of the
--    subscription (in the footer and in List-Unsubscribe). Plus
--    `confirmation_sent_at`, so "re-send confirmation" can skip anyone mailed
--    in the last day.
--
-- 2. `newsletter_campaigns` — one row per newsletter: subject, body (the
--    sanitised HTML the Content assets editor writes), the Arabic edition,
--    the audience, and where it is in draft → scheduled → sending → sent.
--
-- 3. `newsletter_deliveries` — the audience snapshot taken when a campaign
--    starts, one row per recipient, drained by the sender in batches. It
--    holds the subscriber's id and never their address, and cascades on the
--    subscriber's deletion, so a data-subject erasure (anonymise_by_email
--    deletes the subscriber row) takes the delivery history with it.
--
-- Two SECURITY DEFINER functions do the set-wise work for the sender, which
-- runs as the service role: starting a campaign (the snapshot, atomically, with
-- no PostgREST row cap) and claiming a batch (FOR UPDATE SKIP LOCKED, so the
-- send action and the minute cron never take the same rows).

-- ── 1. Subscribers ──────────────────────────────────────────────

alter table public.newsletter_subscribers
  add column if not exists unsubscribe_token text,
  add column if not exists confirmation_sent_at timestamptz;

update public.newsletter_subscribers
   set unsubscribe_token = encode(extensions.gen_random_bytes(24), 'hex')
 where unsubscribe_token is null;

update public.newsletter_subscribers
   set confirmation_sent_at = subscribed_at
 where confirmation_sent_at is null and status = 'pending';

alter table public.newsletter_subscribers
  alter column unsubscribe_token set default encode(extensions.gen_random_bytes(24), 'hex'),
  alter column unsubscribe_token set not null;

create unique index if not exists newsletter_unsubscribe_token_key
  on public.newsletter_subscribers (unsubscribe_token);

comment on column public.newsletter_subscribers.unsubscribe_token is
  'Permanent per-subscriber token for unsubscribe links (footer, List-Unsubscribe, welcome email). Never cleared.';
comment on column public.newsletter_subscribers.confirmation_sent_at is
  'When the last confirmation email went out; re-sends skip anyone mailed in the last 24 hours.';

-- ── 2. Campaigns ────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'newsletter_campaign_status') then
    create type public.newsletter_campaign_status as enum
      ('draft', 'scheduled', 'sending', 'sent', 'cancelled');
  end if;
end $$;

create table if not exists public.newsletter_campaigns (
  id             uuid primary key default gen_random_uuid(),
  subject        text not null default '',
  preheader      text not null default '',
  body           text not null default '',
  subject_ar     text,
  preheader_ar   text,
  body_ar        text,
  audience       text not null default 'all'
                 check (audience in ('all', 'en', 'ar')),
  status         public.newsletter_campaign_status not null default 'draft',
  scheduled_at   timestamptz,
  started_at     timestamptz,
  sent_at        timestamptz,
  recipient_count integer not null default 0,
  created_by     uuid references auth.users(id) on delete set null,
  updated_by     uuid references auth.users(id) on delete set null,
  sent_by        uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint newsletter_campaign_scheduled_has_time
    check (status <> 'scheduled' or scheduled_at is not null)
);

create index if not exists newsletter_campaigns_status_idx
  on public.newsletter_campaigns (status, scheduled_at);
create index if not exists newsletter_campaigns_created_idx
  on public.newsletter_campaigns (created_at desc);

drop trigger if exists newsletter_campaigns_set_updated_at on public.newsletter_campaigns;
create trigger newsletter_campaigns_set_updated_at
  before update on public.newsletter_campaigns
  for each row execute function public.set_updated_at();

-- ── 3. Deliveries ───────────────────────────────────────────────

create table if not exists public.newsletter_deliveries (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.newsletter_campaigns(id) on delete cascade,
  subscriber_id  uuid not null references public.newsletter_subscribers(id) on delete cascade,
  locale         text not null default 'en' check (locale in ('en', 'ar')),
  status         text not null default 'queued'
                 check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts       integer not null default 0,
  resend_id      text,
  error          text,
  claimed_at     timestamptz,
  sent_at        timestamptz,
  created_at     timestamptz not null default now(),
  unique (campaign_id, subscriber_id)
);

create index if not exists newsletter_deliveries_pending_idx
  on public.newsletter_deliveries (created_at)
  where status in ('queued', 'sending');
create index if not exists newsletter_deliveries_campaign_status_idx
  on public.newsletter_deliveries (campaign_id, status);
create index if not exists newsletter_deliveries_subscriber_idx
  on public.newsletter_deliveries (subscriber_id);

-- ── RLS ─────────────────────────────────────────────────────────
-- Staff read both. Campaign rows are written by the composer's roles; every
-- state change past `draft` and every delivery write goes through the service
-- role (the sender), so authenticated users get no write policy on deliveries.

alter table public.newsletter_campaigns enable row level security;
alter table public.newsletter_deliveries enable row level security;

drop policy if exists newsletter_campaigns_staff_read on public.newsletter_campaigns;
create policy newsletter_campaigns_staff_read on public.newsletter_campaigns
  for select to authenticated
  using ((select public.is_staff()));

drop policy if exists newsletter_campaigns_composer_write on public.newsletter_campaigns;
create policy newsletter_campaigns_composer_write on public.newsletter_campaigns
  for all to authenticated
  using ((select public.current_staff_role()) in ('admin', 'editor', 'marketing'))
  with check ((select public.current_staff_role()) in ('admin', 'editor', 'marketing'));

drop policy if exists newsletter_deliveries_staff_read on public.newsletter_deliveries;
create policy newsletter_deliveries_staff_read on public.newsletter_deliveries
  for select to authenticated
  using ((select public.is_staff()));

-- ── Sender functions (service role only) ────────────────────────

-- Snapshot a campaign's audience and mark it sending. Returns the number of
-- recipients queued. Only from draft or scheduled; anything else is a no-op
-- returning null, so a double click cannot queue a campaign twice.
create or replace function public.newsletter_start_campaign(p_campaign uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audience text;
  v_count integer;
begin
  select audience into v_audience
    from public.newsletter_campaigns
   where id = p_campaign and status in ('draft', 'scheduled')
   for update;
  if not found then
    return null;
  end if;

  insert into public.newsletter_deliveries (campaign_id, subscriber_id, locale)
  select p_campaign, s.id, coalesce(s.locale, 'en')
    from public.newsletter_subscribers s
   where s.status = 'confirmed'
     and (v_audience = 'all' or s.locale = v_audience)
  on conflict (campaign_id, subscriber_id) do nothing;

  select count(*) into v_count
    from public.newsletter_deliveries where campaign_id = p_campaign;

  update public.newsletter_campaigns
     set status = 'sending',
         started_at = now(),
         recipient_count = v_count
   where id = p_campaign;

  return v_count;
end;
$$;

-- Claim up to p_limit deliveries of campaigns that are sending: queued ones,
-- and any left "sending" for ten minutes by a run that died mid-batch.
create or replace function public.newsletter_claim_deliveries(p_limit integer)
returns setof public.newsletter_deliveries
language sql
security definer
set search_path = public
as $$
  update public.newsletter_deliveries d
     set status = 'sending',
         claimed_at = now(),
         attempts = d.attempts + 1
   where d.id in (
     select x.id
       from public.newsletter_deliveries x
       join public.newsletter_campaigns c on c.id = x.campaign_id
      where c.status = 'sending'
        and (x.status = 'queued'
             or (x.status = 'sending' and x.claimed_at < now() - interval '10 minutes'))
      order by x.created_at
      limit greatest(p_limit, 0)
      for update of x skip locked
   )
  returning d.*;
$$;

revoke all on function public.newsletter_start_campaign(uuid) from public, anon, authenticated;
revoke all on function public.newsletter_claim_deliveries(integer) from public, anon, authenticated;
grant execute on function public.newsletter_start_campaign(uuid) to service_role;
grant execute on function public.newsletter_claim_deliveries(integer) to service_role;

-- ── Grants ──────────────────────────────────────────────────────
-- Explicit, rather than leaning on the project's default privileges: a newer
-- Supabase project grants the API roles nothing on a new table, so a fresh
-- environment (the client's, at handover) would lose access silently. RLS
-- above still decides which rows anyone sees.
grant select, insert, update, delete on public.newsletter_campaigns to authenticated;
grant select on public.newsletter_deliveries to authenticated;
grant all on public.newsletter_campaigns, public.newsletter_deliveries to service_role;
