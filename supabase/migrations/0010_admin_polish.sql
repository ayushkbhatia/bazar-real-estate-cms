-- 0010_admin_polish.sql
-- Phase 6 — admin polish.
--
-- Adds three tables shared across the Phase 6 sub-PRs:
--   • staff_invitations — pending invite rows; converted to a staff row by a
--     trigger when the invited user signs in for the first time.
--   • site_settings    — singleton config row (hero variant, accent token,
--     lead-routing rules, email-template overrides, integration flags).
--   • notifications    — per-user in-app notifications; read by the topbar
--     bell + a Supabase Realtime subscription.
--
-- Each phase PR adds only the surface it needs; the schema is created up
-- front so 6a → 6f can ship without per-PR migration churn.

set local search_path = public, auth, extensions;

-- ───────────────────────────────────────────────────────────────
-- staff_invitations (6a)
-- ───────────────────────────────────────────────────────────────
create table public.staff_invitations (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  display_name  text not null,
  role          public.staff_role not null default 'agent',
  token         text not null unique,
  invited_by    uuid references public.staff(user_id) on delete set null,
  expires_at    timestamptz not null default now() + interval '14 days',
  accepted_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- Only one outstanding invitation per email at a time.
create unique index staff_invitations_email_pending_idx
  on public.staff_invitations (lower(email))
  where accepted_at is null;
create index staff_invitations_token_idx on public.staff_invitations (token);
create index staff_invitations_invited_by_idx
  on public.staff_invitations (invited_by);
create trigger staff_invitations_set_updated_at
  before update on public.staff_invitations
  for each row execute function public.set_updated_at();

-- On first sign-in, if there's a matching pending invitation, materialise
-- a staff row and mark the invitation accepted. Runs as security definer so
-- it can write to staff regardless of who's signing in.
create or replace function public.handle_staff_invitation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  inv public.staff_invitations%rowtype;
  proposed_slug text;
  final_slug text;
  counter int := 0;
begin
  select * into inv
    from public.staff_invitations
    where lower(email) = lower(new.email)
      and accepted_at is null
      and expires_at > now()
    order by created_at desc
    limit 1;
  if not found then
    return new;
  end if;

  -- Pick a unique slug from display_name, retrying with -2, -3, ... if taken.
  proposed_slug := regexp_replace(lower(inv.display_name), '[^a-z0-9]+', '-', 'g');
  proposed_slug := regexp_replace(proposed_slug, '(^-+|-+$)', '', 'g');
  if proposed_slug = '' then
    proposed_slug := 'staff';
  end if;
  final_slug := proposed_slug;
  while exists (select 1 from public.staff where slug = final_slug) loop
    counter := counter + 1;
    final_slug := proposed_slug || '-' || counter::text;
  end loop;

  insert into public.staff (user_id, display_name, slug, role, status, joined_at)
    values (new.id, inv.display_name, final_slug, inv.role, 'active', current_date)
    on conflict (user_id) do nothing;

  update public.staff_invitations
    set accepted_at = now()
    where id = inv.id;
  return new;
end;
$$;

-- Runs AFTER the existing handle_new_user trigger (which creates the
-- accounts row). The two operate on different tables and don't conflict.
drop trigger if exists on_auth_user_accept_invitation on auth.users;
create trigger on_auth_user_accept_invitation
  after insert on auth.users
  for each row execute function public.handle_staff_invitation();

-- ───────────────────────────────────────────────────────────────
-- site_settings (6b) — singleton
-- ───────────────────────────────────────────────────────────────
create table public.site_settings (
  id              int primary key default 1 check (id = 1),
  hero_variant    text not null default 'fullbleed'
    check (hero_variant in ('fullbleed', 'editorial', 'map', 'concierge')),
  accent_token    text not null default 'moss',
  brand_name      text not null default 'Bazar Real Estate',
  brand_tagline   text default 'Abu Dhabi, properly understood.',
  orn             text,
  contact_email   text,
  contact_phone   text,
  lead_routing    jsonb not null default '{"rules": [], "fallback_agent_id": null}'::jsonb,
  email_templates jsonb not null default '{}'::jsonb,
  integrations    jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.staff(user_id) on delete set null
);
create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

-- Seed the singleton row.
insert into public.site_settings (id) values (1) on conflict (id) do nothing;

-- ───────────────────────────────────────────────────────────────
-- notifications (6e)
-- ───────────────────────────────────────────────────────────────
create type public.notification_kind as enum (
  'new_enquiry',
  'viewing_reminder',
  'lead_reassigned',
  'system'
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        public.notification_kind not null,
  title       text not null,
  body        text,
  link        text,
  payload     jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_id_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;
create index notifications_user_id_created_idx
  on public.notifications (user_id, created_at desc);

-- ───────────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────────
alter table public.staff_invitations enable row level security;
alter table public.site_settings     enable row level security;
alter table public.notifications     enable row level security;

-- staff_invitations — admins only. Service-role bypass still works for the
-- inviteUserByEmail flow.
create policy staff_invitations_admin_all on public.staff_invitations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- site_settings — any staff can read; admins write.
create policy site_settings_staff_read on public.site_settings
  for select to authenticated using (public.is_staff());
create policy site_settings_admin_write on public.site_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- notifications — owner-scoped, plus staff can read their own row.
create policy notifications_select_own on public.notifications
  for select using (auth.uid() = user_id);
create policy notifications_update_own on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Done.
