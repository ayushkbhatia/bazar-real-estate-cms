-- 0172 · Website area deletes reach Salesforce.
--
-- Levarus's "Website Locations Delete" document (v1.0, 25 Oct 2026) adds a
-- DELETE action to the Website Locations endpoint 0169 already sends to:
--
--   POST /services/apexrest/properties/website-locations
--     DELETE { emirate, area }             the area, and its sub-areas
--     DELETE { emirate, area, subAreas }   only those sub-areas
--
-- Salesforce deactivates the values rather than erasing them: existing
-- listings keep theirs, and an UPSERT of the same name reactivates it. A
-- name it doesn't hold answers `not_found` and changes nothing. A sub-area
-- that also sits under another area stays active there.
--
-- Until now 0169's trigger stored a website delete as a `held` event the
-- sender never read. This redefines the trigger so that:
--
--   · an `area` or `sub_community` deleted   → DELETE, pending (sent)
--   · a `sub_community` renamed or moved     → DELETE of where it was, then
--                                              UPSERT of where it is
--     (the API still has no sub-area rename; delete-then-add is one)
--   · an `area` moved to another emirate, or renamed and moved at once
--                                            → DELETE of where it was, then
--                                              UPSERT of where it is with its
--                                              sub-areas, which the DELETE
--                                              deactivated alongside it
--   · either kind turned into a kind Salesforce doesn't hold (an emirate, a
--     building)                              → DELETE of where it was
--   · an `area` renamed in the same emirate  → REPLACE, as before
--   · an add                                 → UPSERT, as before
--
-- DELETE goes first: an UPSERT reactivates whatever the DELETE retired, so in
-- that order nothing the website still has can be left inactive. The two
-- rows are written in one statement's trigger, and `created_at` is
-- clock_timestamp(), so the sender sees them in that order.
--
-- A retirement is skipped when where it was is incomplete — no emirate above
-- an area, a sub-area not under an area — because Salesforce cannot hold a
-- value there. A delete's own event is still written, as 0169 did, and the
-- sender fails it with the reason.
--
-- Rows already `held` stay held: they are real website deletes from before
-- the API could take them, and releasing them sends eleven deletes to the
-- production org at once. That is done by hand, once Levarus have confirmed
-- the run-as user can write to the picklists (docs/SALESFORCE.md):
--   update salesforce_location_events
--      set state = 'pending', next_attempt_at = now()
--    where state = 'held';
--
-- ORDER: apply after the code that maps DELETE (lib/salesforce/locations.ts)
-- is deployed. The code before it refuses a DELETE and would mark every delete
-- made in between `failed` (recoverable — set them back to pending — but
-- noise on the health page).
--
-- Replaces a function only; no table changes. `held` stays a valid state for
-- the rows that have it.

create or replace function public.areas_queue_salesforce_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emirate     text;
  v_old_emirate text;
  v_parent      public.areas%rowtype;
  v_old_parent  public.areas%rowtype;
  v_old         jsonb;  -- where the row was, as a DELETE
  v_payload     jsonb;  -- where it is now
  v_subs        jsonb;
begin
  -- Where Salesforce holds the row today, if it holds it at all.
  if tg_op in ('UPDATE', 'DELETE') and old.kind in ('area', 'sub_community') then
    -- 0170 refuses to delete an area with anything under it, so on a delete
    -- the parent is still there to name.
    v_old_emirate := case
      when old.parent_id is null then null
      else public.area_emirate_name(old.parent_id)
    end;
    if old.kind = 'area' then
      v_old := jsonb_build_object('action', 'DELETE', 'emirate', v_old_emirate, 'area', btrim(old.name));
    else
      select * into v_old_parent from public.areas where id = old.parent_id;
      v_old := jsonb_build_object(
        'action', 'DELETE',
        'emirate', v_old_emirate,
        'area', case when v_old_parent.kind = 'area' then btrim(v_old_parent.name) end,
        'subAreas', jsonb_build_array(btrim(old.name))
      );
    end if;
  end if;

  if tg_op = 'DELETE' then
    if v_old is not null then
      insert into public.salesforce_location_events (area_id, payload)
      values (null, v_old);
    end if;
    return null;
  end if;

  -- A description, a photo, a slug: nothing Salesforce holds.
  if tg_op = 'UPDATE'
     and btrim(new.name) = btrim(old.name)
     and new.kind = old.kind
     and new.parent_id is not distinct from old.parent_id then
    return null;
  end if;

  -- Only an incomplete old place is skipped; Salesforce has nothing there.
  if v_old is not null and (v_old->>'emirate' is null or v_old->>'area' is null) then
    v_old := null;
  end if;

  if new.kind not in ('area', 'sub_community') then
    if v_old is not null then
      insert into public.salesforce_location_events (area_id, payload)
      values (new.id, v_old);
    end if;
    return null;
  end if;

  v_emirate := public.area_emirate_name(new.id);

  if new.kind = 'area' then
    if tg_op = 'UPDATE' and old.kind = 'area' and btrim(new.name) <> btrim(old.name)
       and v_old_emirate is not null and v_old_emirate = v_emirate then
      insert into public.salesforce_location_events (area_id, payload)
      values (new.id, jsonb_build_object(
        'action', 'REPLACE',
        'emirate', v_emirate,
        'area', btrim(old.name),
        'newArea', btrim(new.name)
      ));
      return null;
    end if;
    v_payload := jsonb_build_object('action', 'UPSERT', 'emirate', v_emirate, 'area', btrim(new.name));
  else
    select * into v_parent from public.areas where id = new.parent_id;
    v_payload := jsonb_build_object(
      'action', 'UPSERT',
      'emirate', v_emirate,
      'area', case when v_parent.kind = 'area' then btrim(v_parent.name) end,
      'subAreas', jsonb_build_array(btrim(new.name))
    );
  end if;

  -- Still in the same place (a move within the emirate, say): nothing to retire.
  if v_old is not null and (v_old - 'action') = (v_payload - 'action') then
    v_old := null;
  end if;

  if v_old is not null then
    insert into public.salesforce_location_events (area_id, payload)
    values (new.id, v_old);
    -- Deleting an area deactivates its sub-areas too; name them so the
    -- UPSERT brings them back under the area's new place.
    if new.kind = 'area' then
      select jsonb_agg(btrim(name) order by btrim(name)) into v_subs
        from public.areas
       where parent_id = new.id and kind = 'sub_community';
      if v_subs is not null then
        v_payload := v_payload || jsonb_build_object('subAreas', v_subs);
      end if;
    end if;
  end if;

  insert into public.salesforce_location_events (area_id, payload)
  values (new.id, v_payload);
  return null;
end;
$$;

revoke all on function public.areas_queue_salesforce_location() from public, anon, authenticated;

comment on table public.salesforce_location_events is
  'Website area adds, renames and deletes to send to Salesforce (Website Locations API). Written by a trigger on areas (0169, 0172); drained oldest first by the lead-sync cron and by the area actions. `held` rows are deletes from before the API had a DELETE.';
