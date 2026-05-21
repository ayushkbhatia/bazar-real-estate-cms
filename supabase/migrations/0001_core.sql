-- 0001_core.sql
-- Bazar Real Estate — Phase 0/1 core schema.
-- Tables: staff, accounts, media_assets, areas, developers, developments,
-- properties, property_media, audit_log.
-- Includes enums, indexes, updated_at triggers, RLS policies, and the
-- new-user trigger that creates accounts rows on signup.

set local search_path = public, auth, extensions;

-- ───────────────────────────────────────────────────────────────
-- Helper: updated_at trigger function
-- ───────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- Enums
-- ───────────────────────────────────────────────────────────────
create type public.account_residency_status as enum
  ('uae_resident', 'non_resident', 'gcc_national');

create type public.account_language as enum ('en', 'ar');

create type public.account_kyc_status as enum
  ('unverified', 'pending', 'verified', 'rejected');

create type public.staff_role as enum
  ('admin', 'editor', 'agent', 'marketing', 'support');

create type public.staff_status as enum
  ('active', 'on_leave', 'onboarding', 'suspended');

create type public.area_kind as enum
  ('emirate', 'area', 'sub_community', 'building');

create type public.development_status as enum
  ('pre_launch', 'on_sale', 'sold_out', 'handed_over');

create type public.property_mode as enum
  ('buy', 'rent', 'off_plan', 'commercial');

create type public.property_status as enum
  ('draft', 'in_review', 'published', 'off_market', 'archived');

create type public.property_type as enum
  ('apartment', 'villa', 'penthouse', 'townhouse', 'commercial', 'land', 'hotel_apartment');

create type public.property_tenure as enum
  ('freehold', 'leasehold', 'usufruct');

create type public.property_furnishing as enum
  ('unfurnished', 'semi', 'fully');

create type public.media_folder as enum
  ('listings', 'brand', 'blog', 'team', 'documents');

create type public.property_media_role as enum
  ('hero', 'gallery', 'floor_plan', 'brochure', 'video', 'virtual_tour');

create type public.audit_actor_kind as enum ('user', 'system', 'integration');

-- ───────────────────────────────────────────────────────────────
-- Tables — staff (extends auth.users 1:1)
-- ───────────────────────────────────────────────────────────────
create table public.staff (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  display_name   text not null,
  slug           text unique not null,
  title          text,
  brn            text,
  photo_url      text,
  bio            text,
  specialties    text[] not null default '{}',
  languages      jsonb  not null default '[]'::jsonb,
  credentials    text[] not null default '{}',
  role           public.staff_role   not null default 'agent',
  status         public.staff_status not null default 'active',
  joined_at      date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index staff_role_idx   on public.staff (role);
create index staff_status_idx on public.staff (status);
create trigger staff_set_updated_at before update on public.staff
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- Tables — accounts (extends auth.users 1:1, for marketplace users)
-- ───────────────────────────────────────────────────────────────
create table public.accounts (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  first_name         text,
  last_name          text,
  nationality        text, -- ISO 3166-1 alpha-2
  residency_status   public.account_residency_status,
  preferred_language public.account_language not null default 'en',
  marketing_opt_in   boolean not null default false,
  kyc_status         public.account_kyc_status not null default 'unverified',
  kyc_verified_at    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- Tables — media_assets (depends on staff)
-- ───────────────────────────────────────────────────────────────
create table public.media_assets (
  id            uuid primary key default gen_random_uuid(),
  filename      text not null,
  mime_type     text not null,
  size_bytes    bigint,
  storage_key   text not null unique,
  width         int,
  height        int,
  alt_text      text,
  folder        public.media_folder not null default 'listings',
  uploaded_by   uuid references public.staff(user_id) on delete set null,
  usage_count   int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index media_assets_folder_idx     on public.media_assets (folder);
create index media_assets_uploaded_by_idx on public.media_assets (uploaded_by);
create index media_assets_deleted_at_idx on public.media_assets (deleted_at)
  where deleted_at is null;
create trigger media_assets_set_updated_at before update on public.media_assets
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- Tables — areas (self-referencing tree)
-- ───────────────────────────────────────────────────────────────
create table public.areas (
  id             uuid primary key default gen_random_uuid(),
  parent_id      uuid references public.areas(id) on delete set null,
  kind           public.area_kind not null,
  name           text not null,
  slug           text not null,
  description    text,
  hero_image_id  uuid references public.media_assets(id) on delete set null,
  geo            jsonb,
  seo_meta       jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (parent_id, slug)
);
create index areas_parent_idx on public.areas (parent_id);
create index areas_kind_idx   on public.areas (kind);
create trigger areas_set_updated_at before update on public.areas
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- Tables — developers
-- ───────────────────────────────────────────────────────────────
create table public.developers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  founded_year  int,
  description   text,
  logo_id       uuid references public.media_assets(id) on delete set null,
  stats         jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger developers_set_updated_at before update on public.developers
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- Tables — developments
-- ───────────────────────────────────────────────────────────────
create table public.developments (
  id               uuid primary key default gen_random_uuid(),
  developer_id     uuid not null references public.developers(id) on delete restrict,
  area_id          uuid references public.areas(id) on delete set null,
  name             text not null,
  slug             text not null unique,
  status           public.development_status not null default 'pre_launch',
  handover_date    date,
  total_units      int,
  starting_price   numeric(15, 2),
  description      text,
  amenities        text[] not null default '{}',
  payment_plan     jsonb,
  masterplan_id    uuid references public.media_assets(id) on delete set null,
  brochure_id      uuid references public.media_assets(id) on delete set null,
  lead_advisor_id  uuid references public.staff(user_id) on delete set null,
  escrow_account   text,
  meta             jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index developments_status_idx       on public.developments (status);
create index developments_developer_idx    on public.developments (developer_id);
create index developments_area_idx         on public.developments (area_id);
create trigger developments_set_updated_at before update on public.developments
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- Tables — properties (THE central listing entity)
-- ───────────────────────────────────────────────────────────────
create table public.properties (
  id                            uuid primary key default gen_random_uuid(),
  reference                     text not null unique,    -- BAZ-AD-04891
  slug                          text not null,
  title                         text not null,
  short_description             text,
  description                   text,
  mode                          public.property_mode   not null,
  status                        public.property_status not null default 'draft',
  type                          public.property_type   not null,
  development_id                uuid references public.developments(id) on delete set null,
  area_id                       uuid references public.areas(id) on delete set null,
  sub_community_id              uuid references public.areas(id) on delete set null,
  building_id                   uuid references public.areas(id) on delete set null,
  unit_number                   text,
  floor                         int,
  address_line                  text,
  geo                           jsonb,
  beds                          int not null default 0,
  baths                         int not null default 0,
  built_up_ft2                  int,
  plot_ft2                      int,
  year_built                    int,
  tenure                        public.property_tenure,
  furnishing                    public.property_furnishing,
  view                          text,
  orientation                   text,
  parking_bays                  int,
  price_aed                     numeric(15, 2) not null,
  service_charge_per_ft2        numeric(7, 2),
  amenities                     text[] not null default '{}',
  flags                         jsonb  not null default '{}'::jsonb,
  dld_plot_number               text,
  listing_permit_no             text,
  listing_permit_expires_at     date,
  seo                           jsonb,
  published_at                  timestamptz,
  created_by                    uuid references public.staff(user_id) on delete set null,
  assigned_agent_id             uuid references public.staff(user_id) on delete set null,
  view_count                    int not null default 0,
  enquiry_count                 int not null default 0,
  price_history                 jsonb not null default '[]'::jsonb,
  compliance                    jsonb not null default '{}'::jsonb,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  deleted_at                    timestamptz
);
create index properties_slug_idx              on public.properties (slug);
create index properties_status_idx            on public.properties (status);
create index properties_assigned_agent_idx    on public.properties (assigned_agent_id);
create index properties_area_idx              on public.properties (area_id);
create index properties_created_at_idx        on public.properties (created_at desc);
create index properties_published_at_idx      on public.properties (published_at desc)
  where status = 'published' and deleted_at is null;
create index properties_mode_idx              on public.properties (mode);
create trigger properties_set_updated_at before update on public.properties
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- Tables — property_media (join with role + order)
-- ───────────────────────────────────────────────────────────────
create table public.property_media (
  property_id  uuid not null references public.properties(id) on delete cascade,
  media_id     uuid not null references public.media_assets(id) on delete cascade,
  role         public.property_media_role not null default 'gallery',
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  primary key (property_id, media_id)
);
create index property_media_property_idx on public.property_media (property_id);

-- ───────────────────────────────────────────────────────────────
-- Tables — audit_log (append-only)
-- ───────────────────────────────────────────────────────────────
create table public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references auth.users(id) on delete set null,
  actor_kind   public.audit_actor_kind not null default 'user',
  action       text not null,
  target_kind  text,
  target_id    uuid,
  before       jsonb,
  after        jsonb,
  ip           inet,
  user_agent   text,
  at           timestamptz not null default now()
);
create index audit_log_actor_idx  on public.audit_log (actor_id);
create index audit_log_target_idx on public.audit_log (target_kind, target_id);
create index audit_log_action_idx on public.audit_log (action);
create index audit_log_at_idx     on public.audit_log (at desc);

-- ───────────────────────────────────────────────────────────────
-- Helpers — is_staff(), staff_role()
-- ───────────────────────────────────────────────────────────────
create or replace function public.current_staff_role()
returns public.staff_role
language sql stable security definer set search_path = public
as $$
  select role from public.staff
    where user_id = auth.uid() and status = 'active' limit 1;
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.staff
      where user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.staff
      where user_id = auth.uid() and status = 'active' and role = 'admin'
  );
$$;

-- ───────────────────────────────────────────────────────────────
-- New-user trigger — auto-create accounts row on signup
-- ───────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.accounts (user_id, first_name, last_name)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'first_name', ''),
      coalesce(new.raw_user_meta_data->>'last_name',  '')
    )
    on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────────
alter table public.staff           enable row level security;
alter table public.accounts        enable row level security;
alter table public.media_assets    enable row level security;
alter table public.areas           enable row level security;
alter table public.developers      enable row level security;
alter table public.developments    enable row level security;
alter table public.properties      enable row level security;
alter table public.property_media  enable row level security;
alter table public.audit_log       enable row level security;

-- staff — any signed-in user can read profiles; only admin can write
create policy staff_select_authenticated on public.staff
  for select to authenticated using (true);
create policy staff_admin_all on public.staff
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- accounts — user manages own row; staff can read all
create policy accounts_select_own on public.accounts
  for select using (auth.uid() = user_id);
create policy accounts_update_own on public.accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy accounts_insert_own on public.accounts
  for insert with check (auth.uid() = user_id);
create policy accounts_staff_select on public.accounts
  for select to authenticated using (public.is_staff());

-- areas / developers / developments — public read; staff write
create policy areas_public_read on public.areas
  for select using (true);
create policy areas_staff_write on public.areas
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy developers_public_read on public.developers
  for select using (true);
create policy developers_staff_write on public.developers
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy developments_public_read on public.developments
  for select using (true);
create policy developments_staff_write on public.developments
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- media_assets — public read everything (Phase 0 simplification);
-- staff write. Will tighten in Phase 1 when we differentiate folders.
create policy media_assets_public_read on public.media_assets
  for select using (deleted_at is null);
create policy media_assets_staff_write on public.media_assets
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- properties — public sees only published + not-deleted; staff sees all
create policy properties_public_read on public.properties
  for select using (status = 'published' and deleted_at is null);
create policy properties_staff_select on public.properties
  for select to authenticated using (public.is_staff());
create policy properties_staff_write on public.properties
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- property_media — public for published properties; staff for all
create policy property_media_public_read on public.property_media
  for select using (
    exists (
      select 1 from public.properties p
        where p.id = property_media.property_id
          and p.status = 'published'
          and p.deleted_at is null
    )
  );
create policy property_media_staff_write on public.property_media
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- audit_log — admin read only; writes only via service role (RLS bypassed)
create policy audit_log_admin_read on public.audit_log
  for select to authenticated using (public.is_admin());

-- Done.
