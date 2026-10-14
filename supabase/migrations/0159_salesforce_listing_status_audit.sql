-- 0159 · A Salesforce listing hidden or allowed by a status change is audited.
--
-- 0136's trigger turns an editor's status change on a Salesforce listing into
-- an instruction to the sync: archived / off_market hides it, published allows
-- and approves it. The Salesforce screen's own Hide / Allow / Approve buttons
-- write an audit row (`salesforce.listing_hidden` / `_allowed` / `_approved`);
-- this path wrote none. On 8 Oct 2026 a bulk archive of four Salesforce drafts
-- hid all four, and the only trace of the hide was `hidden_at` / `hidden_by`
-- on the mirror — the property's own `property.bulk_archive` row said nothing
-- about Salesforce.
--
-- Same function, same effect on the mirror. It now reads the listing's state
-- first and, when the change actually flips it, writes the row the buttons
-- would have written, naming the property and status that caused it:
--
--   · hidden → allowed (published)              salesforce.listing_allowed
--   · not hidden, not yet approved (published)  salesforce.listing_approved
--   · not hidden → hidden (archived/off_market) salesforce.listing_hidden
--
-- A status change that leaves the listing as it was (archiving one already
-- hidden, publishing one already allowed and approved) writes nothing.

create or replace function public.salesforce_listing_editor_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_hidden   boolean;
  v_was_approved boolean;
  v_action       text;
begin
  if new.salesforce_listing_id is null
     or new.status is not distinct from old.status
     or coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;

  select hidden_at is not null, approved_at is not null
    into v_was_hidden, v_was_approved
    from public.salesforce_listings
   where sf_listing_id = new.salesforce_listing_id
   for update;
  if not found then
    return new;
  end if;

  if new.status = 'published' then
    update public.salesforce_listings
       set hidden_at   = null,
           hidden_by   = null,
           approved_at = coalesce(approved_at, now()),
           approved_by = coalesce(approved_by, auth.uid())
     where sf_listing_id = new.salesforce_listing_id;
    v_action := case
      when v_was_hidden then 'salesforce.listing_allowed'
      when not v_was_approved then 'salesforce.listing_approved'
    end;
  elsif new.status in ('off_market', 'archived') then
    update public.salesforce_listings
       set hidden_at = now(),
           hidden_by = auth.uid()
     where sf_listing_id = new.salesforce_listing_id;
    if not v_was_hidden then
      v_action := 'salesforce.listing_hidden';
    end if;
  end if;

  if v_action is not null then
    insert into public.audit_log (actor_id, actor_kind, action, target_kind, target_id, before, after)
    values (
      auth.uid(),
      'user',
      v_action,
      'salesforce_listing',
      new.salesforce_listing_id,
      jsonb_build_object('hidden', v_was_hidden, 'approved', v_was_approved),
      jsonb_build_object(
        'hidden', new.status <> 'published',
        'approved', v_was_approved or new.status = 'published',
        'via', 'property_status',
        'property_id', new.id,
        'reference', new.reference,
        'status', new.status
      )
    );
  end if;

  return new;
end;
$$;
