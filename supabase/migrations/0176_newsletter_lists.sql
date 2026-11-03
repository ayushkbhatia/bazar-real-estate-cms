-- 0176 · Custom recipient lists for the newsletter (docs/NEWSLETTER.md,
-- "Custom lists").
--
-- The client asked (3 Nov 2026) to upload a list of names and addresses — an
-- event's guests, a developer's registrants — save it, and send a campaign to
-- that list alone, or to it and the subscribers together.
--
-- A list is personal data the way the subscriber list is, so it gets the same
-- guarantees:
--
-- 1. `newsletter_lists` and `newsletter_list_contacts` — one row per address
--    per list (unique), with its own permanent unsubscribe token, language and
--    status (active / unsubscribed / bounced).
--
-- 2. `newsletter_suppressions` — one row per address that must not be mailed
--    again, keyed by the SHA-256 of the lower-cased address, never the address
--    itself. Triggers keep it: an unsubscribe or a hard bounce anywhere — the
--    subscriber list or any list — suppresses the address everywhere, and
--    marks every other row for it the same way. Confirming a subscription
--    again (a fresh, explicit opt-in) lifts it. Kept through a data-subject
--    erasure on purpose: it is what honours the objection, and a hash cannot
--    be read back into an address without already knowing it.
--
-- 3. `newsletter_deliveries` takes a list contact (`contact_id`) as well as a
--    subscriber: exactly one of the two. It cascades on the contact's
--    deletion, as it does on the subscriber's.
--
-- 4. Campaigns gain `list_ids` and an `audience` of 'none' (lists only).
--    `newsletter_start_campaign` snapshots subscribers, then list contacts,
--    once per address — someone on the list and subscribed gets one copy — and
--    leaves out every suppressed address.
--
-- 5. `newsletter_record_email_event` (Resend's webhook) handles list contacts:
--    a permanent bounce marks them bounced, a spam complaint unsubscribes them,
--    and either suppresses the address.
--
-- 6. `anonymise_by_email` (the DSR erasure) deletes the subject's list rows.
--
-- Additive for the deployed code: it reads none of the new tables, and the
-- start function behaves exactly as before for a campaign with no lists.

-- ── Hash ────────────────────────────────────────────────────────

create or replace function public.newsletter_email_hash(p_email text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(lower(trim(coalesce(p_email, ''))), 'sha256'), 'hex');
$$;

-- ── 1. Lists and contacts ───────────────────────────────────────

create table if not exists public.newsletter_lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 120),
  description text not null default '',
  created_by  uuid references auth.users(id) on delete set null,
  updated_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.newsletter_list_contacts (
  id                uuid primary key default gen_random_uuid(),
  list_id           uuid not null references public.newsletter_lists(id) on delete cascade,
  email             text not null check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name              text not null default '',
  locale            text not null default 'en' check (locale in ('en', 'ar')),
  status            text not null default 'active' check (status in ('active', 'unsubscribed', 'bounced')),
  unsubscribe_token text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  source            text not null default 'upload' check (source in ('upload', 'manual')),
  added_by          uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  unsubscribed_at   timestamptz,
  unique (list_id, email)
);

create unique index if not exists newsletter_list_contacts_token_key
  on public.newsletter_list_contacts (unsubscribe_token);
create index if not exists newsletter_list_contacts_email_idx
  on public.newsletter_list_contacts (email);
create index if not exists newsletter_list_contacts_list_status_idx
  on public.newsletter_list_contacts (list_id, status);

drop trigger if exists newsletter_lists_set_updated_at on public.newsletter_lists;
create trigger newsletter_lists_set_updated_at
  before update on public.newsletter_lists
  for each row execute function public.set_updated_at();

comment on table public.newsletter_list_contacts is
  'Addresses an editor uploaded or added to a newsletter list. Personal data: covered by anonymise_by_email; unsubscribes and hard bounces suppress the address everywhere (newsletter_suppressions).';

-- ── 2. Suppressions ─────────────────────────────────────────────

create table if not exists public.newsletter_suppressions (
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$'),
  reason     text not null check (reason in ('unsubscribed', 'bounced', 'complained')),
  created_at timestamptz not null default now()
);

comment on table public.newsletter_suppressions is
  'SHA-256 of lower(email) for every address that unsubscribed, hard-bounced or complained, from the subscriber list or any custom list. Never mailed by a campaign. No address stored.';

-- A subscriber unsubscribing or bouncing suppresses the address and every
-- list row for it; confirming again lifts the suppression.
create or replace function public.newsletter_subscriber_status_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if new.status in ('unsubscribed', 'bounced') then
    insert into public.newsletter_suppressions (email_hash, reason)
    values (public.newsletter_email_hash(new.email), case when new.status = 'bounced' then 'bounced' else 'unsubscribed' end)
    on conflict (email_hash) do nothing;
    update public.newsletter_list_contacts c
       set status = case when new.status = 'bounced' then 'bounced' else 'unsubscribed' end,
           unsubscribed_at = coalesce(c.unsubscribed_at, now())
     where c.email = lower(trim(new.email))
       and c.status = 'active';
  elsif new.status = 'confirmed' then
    delete from public.newsletter_suppressions
     where email_hash = public.newsletter_email_hash(new.email);
  end if;
  return new;
end;
$$;

drop trigger if exists newsletter_subscriber_status_sync on public.newsletter_subscribers;
create trigger newsletter_subscriber_status_sync
  after update of status on public.newsletter_subscribers
  for each row execute function public.newsletter_subscriber_status_sync();

-- A list contact unsubscribing or bouncing does the same the other way: the
-- address is suppressed, its subscription (if any) ends, its other list rows
-- follow. Each update only touches rows still active/subscribed, so the two
-- triggers settle after one round.
create or replace function public.newsletter_contact_status_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status or new.status = 'active' then
    return new;
  end if;
  insert into public.newsletter_suppressions (email_hash, reason)
  values (public.newsletter_email_hash(new.email), case when new.status = 'bounced' then 'bounced' else 'unsubscribed' end)
  on conflict (email_hash) do nothing;
  update public.newsletter_list_contacts c
     set status = new.status,
         unsubscribed_at = coalesce(c.unsubscribed_at, now())
   where c.email = new.email
     and c.id <> new.id
     and c.status = 'active';
  update public.newsletter_subscribers s
     set status = case when new.status = 'bounced' then 'bounced'::public.newsletter_status else 'unsubscribed'::public.newsletter_status end,
         unsubscribed_at = case when new.status = 'bounced' then s.unsubscribed_at else coalesce(s.unsubscribed_at, now()) end
   where lower(s.email) = new.email
     and s.status in ('pending', 'confirmed');
  return new;
end;
$$;

drop trigger if exists newsletter_contact_status_sync on public.newsletter_list_contacts;
create trigger newsletter_contact_status_sync
  after update of status on public.newsletter_list_contacts
  for each row execute function public.newsletter_contact_status_sync();

-- Addresses that unsubscribed or bounced before this table existed.
insert into public.newsletter_suppressions (email_hash, reason)
select distinct on (public.newsletter_email_hash(email))
       public.newsletter_email_hash(email),
       case when status = 'bounced' then 'bounced' else 'unsubscribed' end
  from public.newsletter_subscribers
 where status in ('unsubscribed', 'bounced')
on conflict (email_hash) do nothing;

-- ── 3. Deliveries to list contacts ──────────────────────────────

alter table public.newsletter_deliveries
  alter column subscriber_id drop not null,
  add column if not exists contact_id uuid references public.newsletter_list_contacts(id) on delete cascade;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'newsletter_deliveries_one_recipient') then
    alter table public.newsletter_deliveries
      add constraint newsletter_deliveries_one_recipient check (num_nonnulls(subscriber_id, contact_id) = 1);
  end if;
end $$;

create unique index if not exists newsletter_deliveries_campaign_contact_key
  on public.newsletter_deliveries (campaign_id, contact_id)
  where contact_id is not null;
create index if not exists newsletter_deliveries_contact_idx
  on public.newsletter_deliveries (contact_id)
  where contact_id is not null;

-- ── 4. Campaign audience ────────────────────────────────────────

alter table public.newsletter_campaigns
  add column if not exists list_ids uuid[] not null default '{}';

do $$
declare
  v_name text;
begin
  select conname into v_name
    from pg_constraint
   where conrelid = 'public.newsletter_campaigns'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%audience%';
  if v_name is not null then
    execute format('alter table public.newsletter_campaigns drop constraint %I', v_name);
  end if;
  alter table public.newsletter_campaigns
    add constraint newsletter_campaigns_audience_check check (audience in ('all', 'en', 'ar', 'none'));
end $$;

comment on column public.newsletter_campaigns.list_ids is
  'Custom lists this campaign also goes to. audience = none sends to these lists only.';

create or replace function public.newsletter_start_campaign(p_campaign uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audience text;
  v_lists    uuid[];
  v_count    integer;
begin
  select audience, list_ids into v_audience, v_lists
    from public.newsletter_campaigns
   where id = p_campaign and status in ('draft', 'scheduled')
   for update;
  if not found then
    return null;
  end if;

  if v_audience <> 'none' then
    insert into public.newsletter_deliveries (campaign_id, subscriber_id, locale)
    select p_campaign, s.id, coalesce(s.locale, 'en')
      from public.newsletter_subscribers s
     where s.status = 'confirmed'
       and (v_audience = 'all' or s.locale = v_audience)
       and not exists (
         select 1 from public.newsletter_suppressions x
          where x.email_hash = public.newsletter_email_hash(s.email)
       )
    on conflict do nothing;
  end if;

  -- One copy per address: the first list row for it, and none when the
  -- address already has a subscriber copy of this campaign.
  insert into public.newsletter_deliveries (campaign_id, contact_id, locale)
  select p_campaign, c.id, c.locale
    from (
      select distinct on (c.email) c.id, c.email, c.locale
        from public.newsletter_list_contacts c
       where c.list_id = any(coalesce(v_lists, '{}'))
         and c.status = 'active'
       order by c.email, c.created_at
    ) c
   where not exists (
           select 1 from public.newsletter_suppressions x
            where x.email_hash = public.newsletter_email_hash(c.email)
         )
     and not exists (
           select 1
             from public.newsletter_deliveries d
             join public.newsletter_subscribers s on s.id = d.subscriber_id
            where d.campaign_id = p_campaign
              and lower(s.email) = c.email
         )
  on conflict do nothing;

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

revoke all on function public.newsletter_start_campaign(uuid) from public, anon, authenticated;
grant execute on function public.newsletter_start_campaign(uuid) to service_role;

-- How many people a campaign would reach right now, once each — what the
-- composer shows beside "Send now". Same rules as the snapshot above.
create or replace function public.newsletter_audience_size(p_audience text, p_lists uuid[])
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with people as (
    select lower(s.email) as email
      from public.newsletter_subscribers s
     where p_audience <> 'none'
       and s.status = 'confirmed'
       and (p_audience = 'all' or s.locale = p_audience)
    union
    select c.email
      from public.newsletter_list_contacts c
     where c.list_id = any(coalesce(p_lists, '{}'))
       and c.status = 'active'
  )
  select case
           when (select public.current_staff_role()) in ('admin', 'editor', 'marketing') then
             (select count(*)::integer from people p
               where not exists (
                 select 1 from public.newsletter_suppressions x
                  where x.email_hash = public.newsletter_email_hash(p.email)))
           else 0
         end;
$$;

revoke all on function public.newsletter_audience_size(text, uuid[]) from public, anon;
grant execute on function public.newsletter_audience_size(text, uuid[]) to authenticated, service_role;

-- ── 5. Delivery events for list contacts ────────────────────────

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
  v_contact    uuid;
  v_delivery   boolean := false;
  v_changed    integer := 0;
  v_more       integer := 0;
  v_emails     text[] := array(select lower(trim(r)) from unnest(coalesce(p_recipients, '{}'::text[])) r);
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
  returning d.subscriber_id, d.contact_id into v_subscriber, v_contact;
  v_delivery := found;

  if p_type = 'bounced' and p_permanent then
    update public.newsletter_subscribers s
       set status = 'bounced'
     where s.status in ('pending', 'confirmed')
       and (s.id = v_subscriber or lower(s.email) = any (v_emails));
    get diagnostics v_changed = row_count;
    update public.newsletter_list_contacts c
       set status = 'bounced'
     where c.status = 'active'
       and (c.id = v_contact or c.email = any (v_emails));
    get diagnostics v_more = row_count;
    v_changed := v_changed + v_more;
    -- The address doesn't exist: suppressed whether or not a row matched.
    insert into public.newsletter_suppressions (email_hash, reason)
    select public.newsletter_email_hash(e), 'bounced' from unnest(v_emails) e where e <> ''
    on conflict (email_hash) do nothing;
  elsif p_type = 'complained' and (v_subscriber is not null or v_contact is not null) then
    update public.newsletter_subscribers s
       set status = 'unsubscribed',
           unsubscribed_at = coalesce(s.unsubscribed_at, p_at)
     where s.id = v_subscriber
       and s.status in ('pending', 'confirmed');
    get diagnostics v_changed = row_count;
    update public.newsletter_list_contacts c
       set status = 'unsubscribed',
           unsubscribed_at = coalesce(c.unsubscribed_at, p_at)
     where c.id = v_contact
       and c.status = 'active';
    get diagnostics v_more = row_count;
    v_changed := v_changed + v_more;
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

-- ── 6. Erasure ──────────────────────────────────────────────────
-- As 0154, plus the subject's rows on custom lists (deleted outright, like
-- the subscription: a list entry with no identifiable person mails nobody).

create or replace function public.anonymise_by_email(target_email text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'extensions'
as $function$
declare
  pseudonym   text := 'deleted-' || encode(gen_random_bytes(6), 'hex');
  norm        text := lower(trim(target_email));
  acct        uuid;
  n_enq       int := 0;
  n_msg       int := 0;
  n_val       int := 0;
  n_news      int := 0;
  n_lists     int := 0;
begin
  if norm is null or norm = '' then
    raise exception 'anonymise_by_email requires an email address';
  end if;

  select a.user_id into acct
  from public.accounts a
  join auth.users u on u.id = a.user_id
  where lower(u.email) = norm
  limit 1;

  if acct is not null then
    perform public.anonymise_account(acct);
  end if;

  with threads as (
    select c.id
    from public.conversations c
    join public.enquiries e on e.id = c.enquiry_id
    where lower(e.email) = norm
  )
  update public.messages m
     set body = '[redacted at the data subject''s request]'
   where m.conversation_id in (select id from threads)
     and m.body <> '[redacted at the data subject''s request]';
  get diagnostics n_msg = row_count;

  update public.enquiries
     set name = pseudonym,
         email = null,
         phone = null,
         brief_raw = null,
         internal_notes = null
   where lower(email) = norm;
  get diagnostics n_enq = row_count;

  update public.valuation_requests
     set owner_name = pseudonym,
         owner_email = null,
         owner_phone = null,
         marketing_opt_in = false
   where lower(owner_email) = norm;
  get diagnostics n_val = row_count;

  delete from public.newsletter_subscribers where lower(email) = norm;
  get diagnostics n_news = row_count;

  delete from public.newsletter_list_contacts where email = norm;
  get diagnostics n_lists = row_count;

  update public.dsr_requests
     set ip = null, user_agent = null
   where lower(email) = norm;

  return jsonb_build_object(
    'email', norm,
    'account_anonymised', acct is not null,
    'enquiries', n_enq,
    'messages_redacted', n_msg,
    'valuation_requests', n_val,
    'newsletter_subscriptions_deleted', n_news,
    'newsletter_list_entries_deleted', n_lists
  );
end;
$function$;

revoke all on function public.anonymise_by_email(text) from public, anon, authenticated;
grant execute on function public.anonymise_by_email(text) to service_role;

-- ── RLS ─────────────────────────────────────────────────────────
-- List names are visible to staff (the composer's audience step shows them);
-- the addresses on them only to the people who may send: admin and marketing.

alter table public.newsletter_lists enable row level security;
alter table public.newsletter_list_contacts enable row level security;
alter table public.newsletter_suppressions enable row level security;

drop policy if exists newsletter_lists_staff_read on public.newsletter_lists;
create policy newsletter_lists_staff_read on public.newsletter_lists
  for select to authenticated
  using ((select public.is_staff()));

drop policy if exists newsletter_lists_sender_write on public.newsletter_lists;
create policy newsletter_lists_sender_write on public.newsletter_lists
  for all to authenticated
  using ((select public.current_staff_role()) in ('admin', 'marketing'))
  with check ((select public.current_staff_role()) in ('admin', 'marketing'));

drop policy if exists newsletter_list_contacts_sender_all on public.newsletter_list_contacts;
create policy newsletter_list_contacts_sender_all on public.newsletter_list_contacts
  for all to authenticated
  using ((select public.current_staff_role()) in ('admin', 'marketing'))
  with check ((select public.current_staff_role()) in ('admin', 'marketing'));

drop policy if exists newsletter_suppressions_sender_read on public.newsletter_suppressions;
create policy newsletter_suppressions_sender_read on public.newsletter_suppressions
  for select to authenticated
  using ((select public.current_staff_role()) in ('admin', 'marketing'));

grant select, insert, update, delete on public.newsletter_lists, public.newsletter_list_contacts to authenticated;
grant select on public.newsletter_suppressions to authenticated;
grant all on public.newsletter_lists, public.newsletter_list_contacts, public.newsletter_suppressions to service_role;
grant execute on function public.newsletter_email_hash(text) to authenticated, service_role;
