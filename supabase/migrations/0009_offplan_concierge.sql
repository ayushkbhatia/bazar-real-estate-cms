-- 0009_offplan_concierge.sql
-- Phase 5 — off-plan development pages + AI concierge.
--
-- 5a (off-plan):
--   • Extend `developments` with content fields (tagline, vision, facts,
--     master_plan pins, hero image, published_at, seo).
--   • New tables: `development_media`, `development_units`, `floor_plans`.
--   • Enums: development_unit_status, development_media_role.
--
-- 5b (concierge):
--   • Enable pgvector extension.
--   • `concierge_sessions` — one row per chat session, with rolling token
--     usage counters and an inferred-brief jsonb.
--   • `concierge_messages` — chat transcript rows (user + assistant turns).
--   • `property_embeddings` — vector(1024) per published property; populated
--     by a background job in the future. The semantic_search tool falls back
--     to Postgres FTS when a property has no embedding yet, so live concierge
--     traffic does not require Voyage/OpenAI calls.

set local search_path = public, auth, extensions;

-- ───────────────────────────────────────────────────────────────
-- 5a · enums
-- ───────────────────────────────────────────────────────────────
create type public.development_unit_status as enum
  ('available', 'held', 'reserved', 'sold');

create type public.development_media_role as enum
  ('hero', 'gallery', 'render', 'masterplan', 'brochure', 'video');

-- ───────────────────────────────────────────────────────────────
-- 5a · developments — content fields for the public detail page
-- ───────────────────────────────────────────────────────────────
alter table public.developments
  add column tagline      text,
  add column bedrooms_text text,
  add column vision        text,
  add column hero_image_id uuid references public.media_assets(id) on delete set null,
  add column facts         jsonb not null default '{}'::jsonb,
  add column master_plan   jsonb not null default '{}'::jsonb,
  add column seo           jsonb,
  add column published_at  timestamptz;

create index developments_published_at_idx on public.developments (published_at desc)
  where published_at is not null;

-- ───────────────────────────────────────────────────────────────
-- 5a · development_media (join)
-- ───────────────────────────────────────────────────────────────
create table public.development_media (
  development_id uuid not null references public.developments(id) on delete cascade,
  media_id       uuid not null references public.media_assets(id) on delete cascade,
  role           public.development_media_role not null default 'gallery',
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  primary key (development_id, media_id, role)
);
create index development_media_development_idx on public.development_media (development_id);

-- ───────────────────────────────────────────────────────────────
-- 5a · floor_plans (per development)
-- ───────────────────────────────────────────────────────────────
create table public.floor_plans (
  id             uuid primary key default gen_random_uuid(),
  development_id uuid not null references public.developments(id) on delete cascade,
  label          text not null,
  beds           int,
  area_ft2       int,
  media_id       uuid references public.media_assets(id) on delete set null,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index floor_plans_development_idx on public.floor_plans (development_id);
create trigger floor_plans_set_updated_at before update on public.floor_plans
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- 5a · development_units — the "What's left" table
-- ───────────────────────────────────────────────────────────────
create table public.development_units (
  id             uuid primary key default gen_random_uuid(),
  development_id uuid not null references public.developments(id) on delete cascade,
  floor_plan_id  uuid references public.floor_plans(id) on delete set null,
  unit_type      text not null,
  beds           int,
  built_up_ft2   int,
  plot_ft2       int,
  lagoon_access  text,
  orientation    text,
  price_aed      numeric(15, 2),
  plot_number    text,
  status         public.development_unit_status not null default 'available',
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index development_units_development_idx on public.development_units (development_id);
create index development_units_status_idx on public.development_units (development_id, status);
create trigger development_units_set_updated_at before update on public.development_units
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- 5a · RLS — public reads for published developments; staff writes
-- ───────────────────────────────────────────────────────────────
alter table public.development_media  enable row level security;
alter table public.floor_plans        enable row level security;
alter table public.development_units  enable row level security;

create policy development_media_public_read on public.development_media
  for select using (
    exists (
      select 1 from public.developments d
        where d.id = development_media.development_id
          and d.published_at is not null
    )
  );
create policy development_media_staff_write on public.development_media
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy floor_plans_public_read on public.floor_plans
  for select using (
    exists (
      select 1 from public.developments d
        where d.id = floor_plans.development_id
          and d.published_at is not null
    )
  );
create policy floor_plans_staff_write on public.floor_plans
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy development_units_public_read on public.development_units
  for select using (
    exists (
      select 1 from public.developments d
        where d.id = development_units.development_id
          and d.published_at is not null
    )
  );
create policy development_units_staff_write on public.development_units
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Tighten the developments public-read policy so unpublished rows
-- only appear to staff. (Existing `developments_public_read` is
-- replaced.)
drop policy if exists developments_public_read on public.developments;
create policy developments_public_read on public.developments
  for select using (published_at is not null);

-- ───────────────────────────────────────────────────────────────
-- 5b · pgvector
-- ───────────────────────────────────────────────────────────────
create extension if not exists vector;

-- ───────────────────────────────────────────────────────────────
-- 5b · concierge_sessions
-- ───────────────────────────────────────────────────────────────
create table public.concierge_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete set null,
  -- For anon sessions we mint a token (stored in an httpOnly cookie). Either
  -- user_id or anon_token must be set, but they can co-exist briefly when
  -- an anon user signs up mid-session.
  anon_token          text,
  brief               jsonb not null default '{}'::jsonb,
  pinned_property_ids uuid[] not null default '{}',
  input_tokens        int not null default 0,
  output_tokens       int not null default 0,
  turn_count          int not null default 0,
  handed_off_to       uuid references public.staff(user_id) on delete set null,
  handed_off_at       timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (user_id is not null or anon_token is not null)
);
create index concierge_sessions_user_idx       on public.concierge_sessions (user_id);
create index concierge_sessions_anon_token_idx on public.concierge_sessions (anon_token);
create index concierge_sessions_created_at_idx on public.concierge_sessions (created_at desc);
create trigger concierge_sessions_set_updated_at before update on public.concierge_sessions
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- 5b · concierge_messages
-- ───────────────────────────────────────────────────────────────
create type public.concierge_message_role as enum ('user', 'assistant', 'system');

create table public.concierge_messages (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.concierge_sessions(id) on delete cascade,
  role           public.concierge_message_role not null,
  content        text not null,
  tool_use       jsonb,
  results        jsonb,
  input_tokens   int,
  output_tokens  int,
  created_at     timestamptz not null default now()
);
create index concierge_messages_session_idx on public.concierge_messages (session_id, created_at);

-- ───────────────────────────────────────────────────────────────
-- 5b · property_embeddings — 1024-dim vector (Voyage-2 sizing)
-- ───────────────────────────────────────────────────────────────
create table public.property_embeddings (
  property_id  uuid primary key references public.properties(id) on delete cascade,
  embedding    vector(1024),
  source_text  text,
  embedded_at  timestamptz
);
-- ivfflat for cosine similarity. lists=100 is fine for the seed catalogue;
-- bump as the corpus grows. Index only when populated, so the build cost
-- doesn't gate this migration.
create index property_embeddings_cosine_idx
  on public.property_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ───────────────────────────────────────────────────────────────
-- 5b · RLS — concierge is owner-scoped; embeddings public read
-- ───────────────────────────────────────────────────────────────
alter table public.concierge_sessions   enable row level security;
alter table public.concierge_messages   enable row level security;
alter table public.property_embeddings  enable row level security;

-- A user can read their own sessions; staff can read all. Anon sessions
-- are accessible only via service-role (the API route uses the service
-- role to fetch by id+anon_token).
create policy concierge_sessions_select_own on public.concierge_sessions
  for select using (auth.uid() = user_id);
create policy concierge_sessions_update_own on public.concierge_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy concierge_sessions_insert_own on public.concierge_sessions
  for insert with check (auth.uid() = user_id);
create policy concierge_sessions_staff_select on public.concierge_sessions
  for select to authenticated using (public.is_staff());

create policy concierge_messages_select_own on public.concierge_messages
  for select using (
    exists (
      select 1 from public.concierge_sessions s
        where s.id = concierge_messages.session_id
          and s.user_id = auth.uid()
    )
  );
create policy concierge_messages_staff_select on public.concierge_messages
  for select to authenticated using (public.is_staff());

-- Embeddings — fully public read (they are derived from the public
-- property text). Writes service-role only.
create policy property_embeddings_public_read on public.property_embeddings
  for select using (true);

-- Done.
