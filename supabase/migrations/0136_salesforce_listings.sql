-- 0136 · Salesforce → website listings: the mirror, and what it may change.
--
-- The CRM team publishes listings in Salesforce (`Property_Listing__c`, with
-- its property details on `Listing__c` — the names are the wrong way round,
-- and that is Salesforce's naming, not ours). The website reads every listing
-- marked `Website_Status__c = 'Published'` on a schedule and turns it into a
-- row in `properties`. See docs/SALESFORCE.md, "Listings".
--
-- ── Why a mirror table and not just columns on `properties` ─────────────
-- Most CRM listings will not be publishable the first time we see them: the
-- sandbox's only published listing has no title, no price on the listing, no
-- location and no downloadable photos. A listing we cannot publish still has
-- to be visible somewhere, with the reason, or the CRM team publishes into a
-- void. The mirror holds every listing we have seen — the normalised snapshot,
-- why it is held, what it could not map — whether or not a property exists
-- for it yet. `properties` only ever sees listings complete enough to be one.
--
-- ── What the sync may never do ──────────────────────────────────────────
-- Withdraw a listing without positive evidence. A listing missing from the
-- published sweep is only withdrawn when Salesforce, asked about that record
-- directly, says it is unpublished or deleted. A record the integration user
-- can no longer see at all is a permissions problem, not a withdrawal — so a
-- sharing-rule change in the CRM cannot empty the website.

create type public.salesforce_listing_state as enum (
  'live',               -- published on the website
  'awaiting_approval',  -- passes every check; waiting for an admin's first yes
  'held',               -- something is missing or unmapped; see `holds`
  'hidden',             -- an editor took it off the website
  'withdrawn',          -- unpublished or deleted in Salesforce
  'mirror_only'         -- a sandbox org: evaluated, never written to properties
);

create table public.salesforce_listings (
  -- Property_Listing__c.Id, the 18-character form Salesforce returns.
  sf_listing_id        text primary key
                         check (sf_listing_id ~ '^[a-zA-Z0-9]{18}$'),
  -- The instance the row came from. A sandbox and production share no ids, and
  -- rows left behind by a sandbox are purged when the org changes.
  org_host             text not null,
  sf_listing_name      text,          -- LST-00003 — what the CRM team calls it
  sf_property_id       text,          -- Listing__c.Id
  sf_reference         text,          -- Listing__c.Reference__c
  sf_last_modified_at  timestamptz,   -- the later of the two records' stamps
  state                public.salesforce_listing_state not null,
  -- [{code, message, fix}] — fix is 'salesforce', 'website' or 'wait', so the
  -- admin screen can say who has to act.
  holds                jsonb not null default '[]'::jsonb,
  -- [{code, message}] — true but not blocking: an amenity with no website
  -- equivalent, an agent nobody has mapped yet.
  notes                jsonb not null default '[]'::jsonb,
  -- The raw values the website could not resolve, for the mapping screen:
  -- {location?, developer?, agent?: {email, name}}.
  unresolved           jsonb not null default '{}'::jsonb,
  -- Allowlisted, normalised fields only. The owner's name and phone number are
  -- never selected from Salesforce, so they cannot land here.
  snapshot             jsonb not null,
  snapshot_hash        text not null,
  images_total         integer not null default 0,
  images_ready         integer not null default 0,
  -- {<source_key>: {reason, at}} for photos that could not be copied: a
  -- placeholder URL that 404s, a file that is not an image. Retried after a
  -- day rather than on every run, so one dead link does not cost an API call
  -- every fifteen minutes forever.
  image_failures       jsonb not null default '{}'::jsonb,
  -- Sticky. Once a listing has been approved — by an admin, or by going live
  -- while auto-publish was on — turning auto-publish off never takes it down.
  approved_at          timestamptz,
  approved_by          uuid references auth.users(id) on delete set null,
  hidden_at            timestamptz,
  hidden_by            uuid references auth.users(id) on delete set null,
  withdrawn_at         timestamptz,
  withdrawn_reason     text,
  first_seen_at        timestamptz not null default now(),
  -- Last time the listing was in the published sweep.
  last_seen_at         timestamptz not null default now(),
  last_synced_at       timestamptz,
  last_error           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index salesforce_listings_state_idx on public.salesforce_listings (state);
create index salesforce_listings_org_idx on public.salesforce_listings (org_host);

create trigger salesforce_listings_set_updated_at
  before update on public.salesforce_listings
  for each row execute function public.set_updated_at();

comment on table public.salesforce_listings is
  'One row per Salesforce Property_Listing__c the website has seen published. The listing sync owns it; see docs/SALESFORCE.md.';

-- The link from a website listing to the CRM record it is published from.
-- NULL for every listing created in the CMS. Unique: one CRM listing is one
-- website listing, and the unique index is what makes two overlapping sync
-- runs unable to create it twice.
alter table public.properties
  add column salesforce_listing_id text unique
    references public.salesforce_listings(sf_listing_id) on delete set null;

comment on column public.properties.salesforce_listing_id is
  'Set when this listing is published from Salesforce (Property_Listing__c.Id). The sync owns its CRM fields and its status; the portal feeds skip it, because Salesforce publishes to Property Finder and Bayut itself.';

-- Photos copied out of Salesforce, keyed by where they came from, so a photo
-- is downloaded once however many runs see it. A ContentVersion id names one
-- immutable version of a file — a re-upload is a new version and a new key.
create table public.salesforce_media (
  -- 'cv:<ContentVersion Id>', 'rta:<record>:<field>:<refid>' or 'url:<sha256>'.
  source_key   text primary key,
  source_url   text,
  media_id     uuid not null references public.media_assets(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index salesforce_media_media_idx on public.salesforce_media (media_id);

-- An admin's answer to "which of ours is this?", given once and remembered.
-- The CRM's location, developer and agent are free text or CRM users; the
-- website needs a row id. Automatic matching covers the exact cases; this
-- covers the rest without a deploy.
create type public.salesforce_mapping_kind as enum ('location', 'developer', 'agent');

create table public.salesforce_mappings (
  kind         public.salesforce_mapping_kind not null,
  -- Normalised source value: lower-cased, trimmed. An email for agents.
  source_key   text not null,
  -- areas.id / developers.id / staff.user_id. No FK because the target table
  -- depends on `kind`; a mapping whose target has gone is ignored on read.
  target_id    uuid not null,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (kind, source_key)
);

-- Settings and the run lease, in one row.
create table public.salesforce_listing_sync (
  id            smallint primary key default 1 check (id = 1),
  -- The emergency brake: nothing is fetched from Salesforce while set. An
  -- admin's own approve / hide / mapping on the screen still applies.
  paused        boolean not null default false,
  -- Off at launch, so the first listings from a new org wait for an admin.
  -- On, a listing that passes every check goes live without one.
  auto_publish  boolean not null default false,
  lease_holder  uuid,
  lease_until   timestamptz,
  last_run_at   timestamptz,
  last_summary  jsonb not null default '{}'::jsonb,
  updated_by    uuid references auth.users(id) on delete set null,
  updated_at    timestamptz not null default now()
);

insert into public.salesforce_listing_sync (id) values (1)
on conflict (id) do nothing;

create trigger salesforce_listing_sync_set_updated_at
  before update on public.salesforce_listing_sync
  for each row execute function public.set_updated_at();

-- The lease. The cron and an admin's "Sync now" can overlap; the unique index
-- on properties.salesforce_listing_id stops a duplicate listing, but not two
-- runs downloading the same photos. One compare-and-set UPDATE is atomic, and
-- a crashed run's lease simply expires.
create or replace function public.claim_salesforce_listing_lease(
  p_holder uuid,
  p_seconds integer
) returns boolean
language sql
security definer
set search_path = public
as $$
  with claimed as (
    update public.salesforce_listing_sync
       set lease_holder = p_holder,
           lease_until  = now() + make_interval(secs => p_seconds)
     where id = 1
       and (lease_until is null or lease_until < now() or lease_holder = p_holder)
    returning 1
  )
  select exists (select 1 from claimed);
$$;

create or replace function public.release_salesforce_listing_lease(p_holder uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.salesforce_listing_sync
     set lease_holder = null, lease_until = null
   where id = 1 and lease_holder = p_holder;
$$;

revoke all on function public.claim_salesforce_listing_lease(uuid, integer) from public, anon, authenticated;
revoke all on function public.release_salesforce_listing_lease(uuid) from public, anon, authenticated;
grant execute on function public.claim_salesforce_listing_lease(uuid, integer) to service_role;
grant execute on function public.release_salesforce_listing_lease(uuid) to service_role;

-- An editor's status change on a Salesforce listing is an instruction to the
-- sync, whichever screen it came from.
--
-- The sync owns the status of these rows, so without this an editor who takes
-- one off the website — from the editor, the bulk bar, a CSV import — would see
-- it come back on the next run. Recording the intent on the mirror means every
-- one of those paths works without knowing Salesforce exists:
--
--   · off_market / archived → hidden; the sync keeps it off until allowed.
--   · published             → allowed and approved; the sync decides whether
--                             the CRM data is complete enough to stay up.
--
-- Only a person's change counts. The sync writes with the service role and
-- must not read its own writes back as an editor's decision; a migration runs
-- with no JWT at all.
create or replace function public.salesforce_listing_editor_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.salesforce_listing_id is null
     or new.status is not distinct from old.status
     or coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;

  if new.status = 'published' then
    update public.salesforce_listings
       set hidden_at   = null,
           hidden_by   = null,
           approved_at = coalesce(approved_at, now()),
           approved_by = coalesce(approved_by, auth.uid())
     where sf_listing_id = new.salesforce_listing_id;
  elsif new.status in ('off_market', 'archived') then
    update public.salesforce_listings
       set hidden_at = now(),
           hidden_by = auth.uid()
     where sf_listing_id = new.salesforce_listing_id;
  end if;

  return new;
end;
$$;

create trigger properties_salesforce_editor_status_tr
  after update of status on public.properties
  for each row
  execute function public.salesforce_listing_editor_status();

-- RLS: staff can read all four; nothing else is granted. Every write comes
-- from the service-role client — the sync, or an admin action that has
-- already checked the caller's role — which bypasses RLS.
alter table public.salesforce_listings enable row level security;
alter table public.salesforce_media enable row level security;
alter table public.salesforce_mappings enable row level security;
alter table public.salesforce_listing_sync enable row level security;

create policy salesforce_listings_staff_read on public.salesforce_listings
  for select to authenticated using (public.is_staff());
create policy salesforce_media_staff_read on public.salesforce_media
  for select to authenticated using (public.is_staff());
create policy salesforce_mappings_staff_read on public.salesforce_mappings
  for select to authenticated using (public.is_staff());
create policy salesforce_listing_sync_staff_read on public.salesforce_listing_sync
  for select to authenticated using (public.is_staff());
