-- 0169 · Website areas pushed to Salesforce. (Merged as 0168 beside
-- 0168_property_mode_sale_or_rent; renumbered in the repo only, applied to prod
-- as it was.)
--
-- Salesforce's `Area__c` and `Sub_Area__c` picklists hold the website's own
-- area names (listing guide v1.3): a CRM user can only place a listing in an
-- area the picklist has, and the listing sync matches those names back to
-- `areas`. Until now the picklists were kept in step by hand. Levarus's
-- "Website Locations Sync" API (v1.0, 22 Oct 2026) lets the website tell
-- Salesforce itself:
--
--   POST /services/apexrest/properties/website-locations
--     UPSERT  { emirate, area, subAreas? }       add or reactivate
--     REPLACE { emirate, area, newArea, subAreas? }  rename an area
--
-- This migration is the queue half. A trigger on `areas` writes one event per
-- change that Salesforce cares about, so every path that adds or renames an
-- area — the area editor, the property wizard's "New area", a data migration
-- run by hand — enrols itself, and none can forget to. The lead-sync cron
-- (and the area actions themselves, straight after saving) drain it in order,
-- oldest first: a rename must not overtake the add it renames.
--
-- What becomes an event:
--   · an `area` added                         → UPSERT { emirate, area }
--   · a `sub_community` added under an area   → UPSERT { emirate, area, subAreas: [name] }
--   · an `area` renamed in the same emirate   → REPLACE { emirate, area: old, newArea: new }
--   · any other change of name, kind or parent of either kind
--                                             → UPSERT of where it is now
--   · either kind deleted                     → DELETE, held (see below)
-- Emirates and buildings have no Salesforce picklist and send nothing.
--
-- The API has no delete, no deactivate and no sub-area rename, so a renamed
-- sub-area, or an area moved to another emirate, leaves its old value active
-- in Salesforce. docs/SALESFORCE.md lists that as an ask of Levarus.
--
-- An area deleted on the website (0167, the CMS delete) is recorded all the
-- same, as a `held` event the sender never picks up: the exact list of values
-- Salesforce still has to retire by hand, and a backlog ready to send the day
-- Levarus add a deactivate action (`update … set state = 'pending' where
-- state = 'held'`, once the sender knows the verb).
--
-- The payload is captured when the change happens, not rebuilt when it is
-- sent, because a REPLACE needs the name the area had before — which only the
-- trigger can see.
--
-- Additive; nothing deployed before it reads the table, so it can be applied
-- ahead of the code. Applying it enqueues nothing: Salesforce already holds
-- every area the website has (checked 22 Oct 2026).

create table public.salesforce_location_events (
  id              uuid primary key default gen_random_uuid(),
  -- Kept for tracing; an event already queued still goes if the row goes.
  -- Null on a delete's own event: the row is already gone.
  area_id         uuid references public.areas(id) on delete set null,
  -- The request body minus `eventId`, which the sender adds from `id`.
  -- `emirate` or `area` may be null when the tree has no emirate above the
  -- row; the sender refuses those with a reason instead of calling.
  payload         jsonb not null,
  -- `held`: a delete, which the API cannot send. See above.
  state           text not null default 'pending'
                    check (state in ('pending', 'sent', 'failed', 'held')),
  attempts        integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error      text,
  -- What Salesforce answered, on success. The API's response body is not
  -- documented; this keeps the first ones for whoever reads them.
  response        jsonb,
  -- clock_timestamp, not now(): two changes in one transaction (a data
  -- migration renaming twice) must still sort in the order they happened.
  created_at      timestamptz not null default clock_timestamp(),
  sent_at         timestamptz
);

comment on table public.salesforce_location_events is
  'Website area adds and renames to send to Salesforce (Website Locations Sync API). Written by a trigger on areas; drained oldest first by the lead-sync cron and by the area actions.';

create index salesforce_location_events_pending_idx
  on public.salesforce_location_events (created_at)
  where state = 'pending';

-- Service role only: no policy, so staff and the public read nothing.
alter table public.salesforce_location_events enable row level security;
grant all on table public.salesforce_location_events to service_role;

-- The emirate a row sits in: itself, or its nearest emirate ancestor.
create function public.area_emirate_name(p_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  with recursive up as (
    select id, parent_id, kind, name, 0 as depth
      from public.areas
     where id = p_id
    union all
    select a.id, a.parent_id, a.kind, a.name, up.depth + 1
      from public.areas a
      join up on a.id = up.parent_id
     where up.depth < 8
  )
  select btrim(name) from up where kind = 'emirate' order by depth limit 1;
$$;

create function public.areas_queue_salesforce_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emirate     text;
  v_old_emirate text;
  v_parent      public.areas%rowtype;
  v_payload     jsonb;
begin
  if tg_op = 'DELETE' then
    if old.kind not in ('area', 'sub_community') then
      return null;
    end if;
    -- 0167 refuses to delete an area with anything under it, so the parent
    -- is still there to name.
    select * into v_parent from public.areas where id = old.parent_id;
    v_emirate := case
      when old.parent_id is null then null
      else public.area_emirate_name(old.parent_id)
    end;
    insert into public.salesforce_location_events (area_id, payload, state)
    values (
      null,
      case when old.kind = 'area' then
        jsonb_build_object('action', 'DELETE', 'emirate', v_emirate, 'area', btrim(old.name))
      else
        jsonb_build_object(
          'action', 'DELETE',
          'emirate', v_emirate,
          'area', case when v_parent.kind = 'area' then btrim(v_parent.name) end,
          'subAreas', jsonb_build_array(btrim(old.name))
        )
      end,
      'held'
    );
    return null;
  end if;

  if new.kind not in ('area', 'sub_community') then
    return null;
  end if;

  -- A description, a photo, a slug: nothing Salesforce holds.
  if tg_op = 'UPDATE'
     and btrim(new.name) = btrim(old.name)
     and new.kind = old.kind
     and new.parent_id is not distinct from old.parent_id then
    return null;
  end if;

  v_emirate := public.area_emirate_name(new.id);

  if new.kind = 'area' then
    if tg_op = 'UPDATE' and old.kind = 'area' and btrim(new.name) <> btrim(old.name) then
      v_old_emirate := case
        when old.parent_id is null then null
        else public.area_emirate_name(old.parent_id)
      end;
    end if;

    if v_old_emirate is not null and v_old_emirate = v_emirate then
      v_payload := jsonb_build_object(
        'action', 'REPLACE',
        'emirate', v_emirate,
        'area', btrim(old.name),
        'newArea', btrim(new.name)
      );
    else
      v_payload := jsonb_build_object(
        'action', 'UPSERT',
        'emirate', v_emirate,
        'area', btrim(new.name)
      );
    end if;
  else
    select * into v_parent from public.areas where id = new.parent_id;
    v_payload := jsonb_build_object(
      'action', 'UPSERT',
      'emirate', v_emirate,
      'area', case when v_parent.kind = 'area' then btrim(v_parent.name) end,
      'subAreas', jsonb_build_array(btrim(new.name))
    );
  end if;

  insert into public.salesforce_location_events (area_id, payload)
  values (new.id, v_payload);
  return null;
end;
$$;

revoke all on function public.areas_queue_salesforce_location() from public, anon, authenticated;

create trigger areas_queue_salesforce_location_tr
  after insert or update of name, kind, parent_id or delete on public.areas
  for each row execute function public.areas_queue_salesforce_location();
