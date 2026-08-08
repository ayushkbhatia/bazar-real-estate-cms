-- ═══════════════════════════════════════════════════════════════════════
-- 0079 · Unit types — the missing middle of developments > units > plans
-- ═══════════════════════════════════════════════════════════════════════
--
-- A project page needs to say "we sell 1-, 2- and 3-bedroom apartments, and
-- here are the layouts each comes in". Neither existing table says that:
--
--   • `development_units` is *inventory* — one row per sellable unit, with a
--     plot number, a price and a sold/held/available status. It backs the
--     "What's left" availability table. Grouping marketing copy onto rows that
--     disappear as they sell is the wrong lifetime.
--   • `floor_plans` is flat: every layout hangs directly off the development,
--     with no notion of which bedroom count it belongs to.
--
-- So: a new parent for floor plans, and a nullable link from floor plans up to
-- it. Nullable rather than NOT NULL because three floor-plan rows already exist
-- unparented; they keep rendering in the legacy "Floor plans" section until
-- someone files them under a unit type.

create table public.development_unit_types (
  id             uuid primary key default gen_random_uuid(),
  development_id uuid not null references public.developments(id) on delete cascade,
  -- What the button on the page reads: "Studio", "2 Bedroom", "Penthouse".
  label          text not null,
  -- 0 = studio, null = doesn't map to a bedroom count (penthouse, duplex).
  -- Capped at 7 because that is what the brief provisions for.
  beds           int,
  -- One or two sentences under the buttons when this type is selected.
  blurb          text,
  size_from_ft2  int,
  size_to_ft2    int,
  price_from_aed numeric(15, 2),
  -- Switched off keeps the record (and its layouts) but drops the button.
  enabled        boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint development_unit_types_beds_range
    check (beds is null or (beds >= 0 and beds <= 7)),
  constraint development_unit_types_label_not_blank
    check (length(btrim(label)) > 0)
);

-- Two "2 Bedroom" buttons on one page is always a mistake, not a choice.
create unique index development_unit_types_label_idx
  on public.development_unit_types (development_id, lower(btrim(label)));
create index development_unit_types_development_idx
  on public.development_unit_types (development_id, sort_order);

create trigger development_unit_types_set_updated_at before update
  on public.development_unit_types
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- floor_plans grows a parent and the fields a layout card shows
-- ───────────────────────────────────────────────────────────────
-- ON DELETE CASCADE: a layout is a layout *of* a unit type. Deleting "2
-- Bedroom" and leaving its four plans orphaned in the legacy section would be
-- a worse surprise than losing them, and the admin card says so before it asks.
alter table public.floor_plans
  add column unit_type_id uuid
    references public.development_unit_types(id) on delete cascade,
  add column baths        int,
  add column description  text,
  add column enabled      boolean not null default true;

create index floor_plans_unit_type_idx
  on public.floor_plans (unit_type_id, sort_order);

-- ───────────────────────────────────────────────────────────────
-- RLS — public reads for published developments; staff writes.
-- Copied from `floor_plans` deliberately: a unit type is exactly as public as
-- the plans hanging off it, and the development's publish state is the one
-- gate either should answer to.
-- ───────────────────────────────────────────────────────────────
alter table public.development_unit_types enable row level security;

create policy development_unit_types_public_read on public.development_unit_types
  for select using (
    exists (
      select 1 from public.developments d
        where d.id = development_unit_types.development_id
          and d.published_at is not null
    )
  );

create policy development_unit_types_staff_write on public.development_unit_types
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

comment on table public.development_unit_types is
  'Marketing unit types (1 Bedroom, 2 Bedroom…) a development is sold in. Parent of floor_plans. Distinct from development_units, which is per-unit sales inventory.';
