-- 0061_content_assets.sql
-- Content Assets — the reusable outreach library behind /admin/content-assets.
--
-- Advisors answering an enquiry were retyping the same four or five messages,
-- and the only "templates" in the system were string literals in
-- lib/email-templates.ts that no one outside the repo can edit. This table is
-- the editable half of that: the copy an advisor sends by hand, kept in one
-- place so it can be reused from the enquiry composer today and from deals,
-- viewings and nurture flows later.
--
-- WHAT DOES NOT LIVE HERE. Transactional system mail — the enquiry
-- acknowledgement, escalation alerts, KYC decisions, staff invitations,
-- permit/BRN warnings — stays in code. Those fire without a human in the loop
-- and a half-saved edit would break a flow silently. Only advisor-facing
-- outreach becomes an asset.
--
-- SEQUENCING IS DOCUMENTATION, NOT AUTOMATION. `follow_up_after_days` and
-- `next_asset_id` describe what an advisor should send next and when. Nothing
-- in this migration or the app sends on a timer. If that changes, it needs a
-- cron and an explicit opt-in per lead — don't let the presence of these
-- columns imply a scheduler exists.

-- ───────────────────────────────────────────────────────────────
-- Enums
-- ───────────────────────────────────────────────────────────────
do $$ begin
  create type public.content_asset_kind as enum ('email', 'whatsapp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_asset_status as enum ('draft', 'published');
exception when duplicate_object then null; end $$;

-- ───────────────────────────────────────────────────────────────
-- Table
-- ───────────────────────────────────────────────────────────────
create table if not exists public.content_assets (
  id                   uuid primary key default gen_random_uuid(),
  -- Which composer the asset shows up in. Mirrors the message_channel enum
  -- ('web','email','whatsapp','sms') minus the channels nobody authors for.
  kind                 public.content_asset_kind not null,
  -- Stable key so code can ask for an asset by name — getContentAsset('...')
  -- — without depending on a uuid that differs per environment.
  slug                 text not null unique,
  name                 text not null,
  category             text not null default 'general',
  -- Email only. A WhatsApp message has no subject line, and storing one
  -- would render nowhere; the check below makes that a constraint rather
  -- than a convention.
  subject              text,
  body                 text not null default '',
  -- Free-text sequencing note: when to reach for this, what it follows.
  notes                text,
  follow_up_after_days int,
  next_asset_id        uuid references public.content_assets(id) on delete set null,
  status               public.content_asset_status not null default 'draft',
  position             int not null default 0,
  created_by           uuid references public.staff(user_id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Soft delete, matching articles/properties: an asset referenced by a sent
  -- message shouldn't vanish from history because someone tidied the list.
  deleted_at           timestamptz,

  constraint content_assets_whatsapp_has_no_subject
    check (kind <> 'whatsapp' or subject is null),
  constraint content_assets_next_is_not_self
    check (next_asset_id is null or next_asset_id <> id),
  constraint content_assets_follow_up_window
    check (follow_up_after_days is null
           or (follow_up_after_days > 0 and follow_up_after_days <= 365)),
  constraint content_assets_slug_shape
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create index if not exists content_assets_kind_idx     on public.content_assets (kind);
create index if not exists content_assets_status_idx   on public.content_assets (status);
create index if not exists content_assets_category_idx on public.content_assets (category);
-- The picker's query: published assets of one kind, newest ordering applied
-- in app code. Partial so trashed rows never enter the plan.
create index if not exists content_assets_live_idx
  on public.content_assets (kind, position)
  where status = 'published' and deleted_at is null;

drop trigger if exists content_assets_set_updated_at on public.content_assets;
create trigger content_assets_set_updated_at before update on public.content_assets
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────────
-- No public read policy at all. These are internal drafts — half-written copy
-- and notes about how to work a lead — and nothing on the marketplace renders
-- them. Any staff member can read (an agent needs the picker); only
-- admin/editor/marketing can write, matching how /admin/pages gates editing.
alter table public.content_assets enable row level security;

drop policy if exists content_assets_staff_read  on public.content_assets;
drop policy if exists content_assets_editor_write on public.content_assets;

create policy content_assets_staff_read on public.content_assets
  for select to authenticated
  using (public.is_staff());

create policy content_assets_editor_write on public.content_assets
  for all to authenticated
  using (public.current_staff_role() in ('admin', 'editor', 'marketing'))
  with check (public.current_staff_role() in ('admin', 'editor', 'marketing'));
