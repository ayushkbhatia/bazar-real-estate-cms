-- 0006_lead_engine.sql
-- enquiries / conversations / messages / viewings — the lead engine.
-- v1 is web-only; WhatsApp + email channels arrive in later migrations
-- but the schema is shaped to absorb them without further changes.

create type public.enquiry_source as enum (
  'property_page',
  'contact_page',
  'concierge',
  'valuation',
  'mortgage',
  'blog_cta',
  'agent_page',
  'share_with_advisor',
  'whatsapp_inbound'
);

create type public.enquiry_status as enum (
  'new',
  'qualified',
  'viewing_scheduled',
  'offer',
  'closed_won',
  'closed_lost'
);

create type public.enquiry_temperature as enum ('cold', 'warm', 'hot');

create type public.enquiry_timeline as enum (
  'now',
  'three_months',
  'six_months',
  'twelve_months',
  'browsing'
);

create type public.message_direction as enum ('inbound', 'outbound');
create type public.message_author_kind as enum ('lead', 'staff', 'system', 'ai');
create type public.message_channel as enum ('web', 'email', 'whatsapp', 'sms');

create type public.viewing_status as enum (
  'tentative',
  'confirmed',
  'completed',
  'cancelled',
  'no_show'
);

-- ───────────────────────────────────────────────────────────────
-- enquiries (the lead row)
-- ───────────────────────────────────────────────────────────────
create table public.enquiries (
  id                    uuid primary key default gen_random_uuid(),
  account_id            uuid references public.accounts(user_id) on delete set null,
  name                  text not null,
  email                 text,
  phone                 text,
  property_id           uuid references public.properties(id) on delete set null,
  development_id        uuid references public.developments(id) on delete set null,
  source                public.enquiry_source not null,
  status                public.enquiry_status not null default 'new',
  temperature           public.enquiry_temperature not null default 'warm',
  budget_min            numeric(15, 2),
  budget_max            numeric(15, 2),
  timeline              public.enquiry_timeline,
  pre_approved          boolean not null default false,
  brief_raw             text,
  inferred_constraints  jsonb,
  assigned_agent_id     uuid references public.staff(user_id) on delete set null,
  internal_notes        text,
  first_response_at     timestamptz,
  closed_at             timestamptz,
  close_reason          text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index enquiries_assigned_agent_idx on public.enquiries (assigned_agent_id);
create index enquiries_status_idx on public.enquiries (status);
create index enquiries_created_at_idx on public.enquiries (created_at desc);
create index enquiries_temperature_idx on public.enquiries (temperature);
create index enquiries_email_idx on public.enquiries (lower(email));
create index enquiries_property_idx on public.enquiries (property_id) where property_id is not null;
create trigger enquiries_set_updated_at before update on public.enquiries
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- conversations — 1:1 with enquiries for v1 (will go many:many later)
-- ───────────────────────────────────────────────────────────────
create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  enquiry_id  uuid not null unique references public.enquiries(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index conversations_enquiry_idx on public.conversations (enquiry_id);

-- ───────────────────────────────────────────────────────────────
-- messages
-- ───────────────────────────────────────────────────────────────
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction       public.message_direction not null,
  author_kind     public.message_author_kind not null,
  author_id       uuid references auth.users(id) on delete set null,
  body            text not null,
  attachments     jsonb,
  channel         public.message_channel not null default 'web',
  external_id     text,
  read_at         timestamptz,
  sent_at         timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, sent_at);
create index messages_author_idx on public.messages (author_id);
create index messages_unread_idx on public.messages (conversation_id) where read_at is null;
create unique index messages_external_idx on public.messages (channel, external_id)
  where external_id is not null;

-- ───────────────────────────────────────────────────────────────
-- viewings
-- ───────────────────────────────────────────────────────────────
create table public.viewings (
  id              uuid primary key default gen_random_uuid(),
  enquiry_id      uuid references public.enquiries(id) on delete set null,
  property_id     uuid references public.properties(id) on delete set null,
  account_id      uuid references public.accounts(user_id) on delete set null,
  agent_id        uuid references public.staff(user_id) on delete set null,
  starts_at       timestamptz not null,
  duration_minutes int not null default 45,
  location        text,
  status          public.viewing_status not null default 'tentative',
  notes           text,
  feedback        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index viewings_agent_starts_idx on public.viewings (agent_id, starts_at);
create index viewings_property_idx on public.viewings (property_id);
create index viewings_status_idx on public.viewings (status);
create trigger viewings_set_updated_at before update on public.viewings
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- Trigger — auto-create a conversation row + a system "received" message
-- whenever an enquiry is inserted. Keeps the inbox shape consistent.
-- ───────────────────────────────────────────────────────────────
create or replace function public.handle_new_enquiry()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  conv_id uuid;
begin
  insert into public.conversations (enquiry_id)
    values (new.id)
    returning id into conv_id;
  insert into public.messages (
    conversation_id, direction, author_kind, body, channel
  ) values (
    conv_id, 'inbound', 'lead', coalesce(new.brief_raw, '(no message)'), 'web'
  );
  return new;
end;
$$;

drop trigger if exists on_enquiry_created on public.enquiries;
create trigger on_enquiry_created
  after insert on public.enquiries
  for each row execute function public.handle_new_enquiry();

-- ───────────────────────────────────────────────────────────────
-- RLS — enquiries / conversations / messages / viewings
-- ───────────────────────────────────────────────────────────────
alter table public.enquiries     enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.viewings      enable row level security;

-- ENQUIRIES
--  · staff can do everything (RLS-friendly catch-all)
--  · the lead can SELECT their own row (account_id = auth.uid())
--  · INSERT is open to anonymous (anyone can submit a lead);
--    no UPDATE/DELETE for non-staff.
drop policy if exists enquiries_staff_all on public.enquiries;
drop policy if exists enquiries_own_select on public.enquiries;
drop policy if exists enquiries_anon_insert on public.enquiries;

create policy enquiries_staff_all on public.enquiries
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy enquiries_own_select on public.enquiries
  for select to authenticated using (account_id = auth.uid());
create policy enquiries_anon_insert on public.enquiries
  for insert with check (true);

-- CONVERSATIONS — staff or the linked-enquiry's own account
drop policy if exists conversations_staff_all on public.conversations;
drop policy if exists conversations_own_select on public.conversations;

create policy conversations_staff_all on public.conversations
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy conversations_own_select on public.conversations
  for select to authenticated using (
    exists (
      select 1 from public.enquiries e
      where e.id = conversations.enquiry_id and e.account_id = auth.uid()
    )
  );

-- MESSAGES — same rule as conversations.
drop policy if exists messages_staff_all on public.messages;
drop policy if exists messages_own_select on public.messages;

create policy messages_staff_all on public.messages
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy messages_own_select on public.messages
  for select to authenticated using (
    exists (
      select 1
      from public.conversations c
      join public.enquiries e on e.id = c.enquiry_id
      where c.id = messages.conversation_id and e.account_id = auth.uid()
    )
  );

-- VIEWINGS — staff full; account sees their own.
drop policy if exists viewings_staff_all on public.viewings;
drop policy if exists viewings_own_select on public.viewings;

create policy viewings_staff_all on public.viewings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy viewings_own_select on public.viewings
  for select to authenticated using (account_id = auth.uid());
