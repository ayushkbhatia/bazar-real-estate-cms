-- 0158 · Mortgage stages: the pipeline a Fast Pre-Approval moves through is
-- data the client keeps (Bazar, 13 Oct 2026).
--
-- "We need these fields … that the user can move the various mortgage
-- enquiries between: New, In Review, Accepted, Pre-Approved, Valuation,
-- Final Offer Letter, Registration, Disbursed … editable in the pages and
-- blocks section." Decided with the owner the same day:
--
--   · Stages are rows (`mortgage_stages`): named, ordered, added and removed
--     in Pages & blocks → Mortgage stages. A request points at its stage.
--   · A file moves freely: any stage to any stage, forwards or back, with no
--     checks (`mortgage_move_stage()`, the owner or the Head).
--   · Declined stays, beside the stages: `status` is `open` or `declined` for
--     a Fast Pre-Approval. A declined file moved onto a stage is reopened.
--   · Awaiting applicant goes. A re-upload request no longer moves the file;
--     it still pauses the 24-hour clock while it is open, as before.
--   · Two switches per stage replace the old fixed rules: `stops_clock` (the
--     team has answered the applicant: the first move onto such a stage stops
--     the 24-hour clock for good) and `closes_file` (a file on it counts as
--     closed — Disbursed). New requests land on the first stage.
--   · Accept application and Mark pre-approved (0156) are gone: they are
--     moves now. The owner's first open no longer moves the file.
--
-- Mortgage Consultancy keeps its statuses (new, contacted, consultation
-- booked, completed) and has no stage.

-- ── Who may keep the stages ─────────────────────────────────────

-- Pages & blocks' editors (app/[locale]/(admin)/admin/pages: admin, editor,
-- marketing), and the Head of mortgages, whose team works the pipeline.
create function public.mortgage_can_edit_stages()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.current_staff_role()::text in ('admin', 'editor', 'marketing'), false)
      or public.mortgage_role() = 'head';
$$;
revoke all on function public.mortgage_can_edit_stages() from public, anon;
grant execute on function public.mortgage_can_edit_stages() to authenticated, service_role;

-- ── The stages ──────────────────────────────────────────────────

create table public.mortgage_stages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  position    integer not null check (position > 0),
  stops_clock boolean not null default false,
  closes_file boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint mortgage_stages_position_key unique (position) deferrable initially deferred
);

alter table public.mortgage_stages enable row level security;
revoke all on public.mortgage_stages from anon, authenticated;
grant select on public.mortgage_stages to authenticated;
grant select, insert, update, delete on public.mortgage_stages to service_role;
create policy mortgage_stages_select on public.mortgage_stages
  for select to authenticated
  using ((select public.mortgage_role()) is not null or (select public.mortgage_can_edit_stages()));

insert into public.mortgage_stages (name, position, stops_clock, closes_file) values
  ('New',                1, false, false),
  ('In Review',          2, false, false),
  ('Accepted',           3, true,  false),
  ('Pre-Approved',       4, true,  false),
  ('Valuation',          5, true,  false),
  ('Final Offer Letter', 6, true,  false),
  ('Registration',       7, true,  false),
  ('Disbursed',          8, true,  true);

-- ── Requests on their stage ─────────────────────────────────────

alter table public.mortgage_requests
  add column stage_id uuid references public.mortgage_stages(id) on delete restrict;
create index mortgage_requests_stage_idx on public.mortgage_requests (stage_id) where stage_id is not null;

alter table public.mortgage_requests drop constraint mortgage_requests_status_fits_service;

-- Every Fast Pre-Approval goes onto the stage its status meant. A declined one
-- keeps the stage it was declined from, so reopening it puts it back there.
do $$
declare
  v_stage uuid;
begin
  perform set_config('mortgage.transition', 'on', true);

  update public.mortgage_requests r
     set stage_id = s.id
    from public.mortgage_stages s
   where r.service = 'pre_approval'
     and s.name = case r.status::text
                    when 'new' then 'New'
                    when 'in_review' then 'In Review'
                    when 'awaiting_applicant' then 'In Review'
                    when 'accepted' then 'Accepted'
                    when 'pre_approved' then 'Pre-Approved'
                    else case coalesce((
                           select e.data ->> 'from' from public.mortgage_events e
                            where e.request_id = r.id and e.type = 'status.changed' and e.data ->> 'to' = 'declined'
                            order by e.created_at desc limit 1), 'new')
                           when 'accepted' then 'Accepted'
                           when 'with_banks' then 'Accepted'
                           when 'new' then 'New'
                           else 'In Review'
                         end
                  end;

  -- Pre-approved closed the file; it is a stage of an open one now.
  update public.mortgage_requests
     set closed_at = null, decision = null, decided_at = null, decided_by = null
   where service = 'pre_approval' and status = 'pre_approved';

  update public.mortgage_requests
     set status = 'open'
   where service = 'pre_approval' and status in ('new', 'in_review', 'awaiting_applicant', 'accepted', 'pre_approved');

  perform set_config('mortgage.transition', 'off', true);
end;
$$;

alter table public.mortgage_requests add constraint mortgage_requests_status_fits_service check (
  (service = 'pre_approval' and status in ('open', 'declined'))
  or (service = 'consultancy' and status in ('new', 'contacted', 'consultation_booked', 'completed'))
);
alter table public.mortgage_requests add constraint mortgage_requests_stage_fits_service check (
  (service = 'pre_approval') = (stage_id is not null)
);

-- A new Fast Pre-Approval is open, on the first stage. mortgage_create_request()
-- (0141) still writes 'new'; this sets what it means.
create function public.mortgage_requests_place_on_stage()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.service = 'pre_approval' then
    new.status := 'open';
    if new.stage_id is null then
      select id into new.stage_id from public.mortgage_stages order by position limit 1;
      if new.stage_id is null then
        raise exception 'no mortgage stage to place the request on' using errcode = 'MR409';
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger mortgage_requests_place_on_stage
  before insert on public.mortgage_requests
  for each row execute function public.mortgage_requests_place_on_stage();

-- The stage moves only through the transition, like the status.
create or replace function public.mortgage_requests_guard()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if coalesce(current_setting('mortgage.transition', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'mortgage requests are created by mortgage_create_request()'
      using errcode = 'MR403';
  end if;

  if new.status                is distinct from old.status
  or new.stage_id              is distinct from old.stage_id
  or new.reference             is distinct from old.reference
  or new.service               is distinct from old.service
  or new.employment_type       is distinct from old.employment_type
  or new.submitted_at          is distinct from old.submitted_at
  or new.first_contact_at      is distinct from old.first_contact_at
  or new.sla_started_at        is distinct from old.sla_started_at
  or new.sla_due_at            is distinct from old.sla_due_at
  or new.sla_paused_at         is distinct from old.sla_paused_at
  or new.sla_paused_seconds    is distinct from old.sla_paused_seconds
  or new.sla_remaining_seconds is distinct from old.sla_remaining_seconds
  or new.sla_stopped_at        is distinct from old.sla_stopped_at
  or new.decision              is distinct from old.decision
  or new.decided_at            is distinct from old.decided_at
  or new.decided_by            is distinct from old.decided_by
  or new.closed_at             is distinct from old.closed_at
  or new.decision_message      is distinct from old.decision_message
  or new.decline_reason        is distinct from old.decline_reason
  then
    raise exception 'status, stage, clock and decision columns change only through mortgage_transition()'
      using errcode = 'MR403';
  end if;

  return new;
end;
$$;

-- ── The transition ──────────────────────────────────────────────

drop function public.mortgage_accept_application(uuid, timestamptz);
drop function public.mortgage_record_pre_approval(uuid, text, timestamptz);

create or replace function public.mortgage_transition(
  p_request_id          uuid,
  p_event               text,
  p_actor_kind          public.mortgage_actor,
  p_actor_id            uuid default null,
  p_sla                 jsonb default '{}'::jsonb,
  p_data                jsonb default '{}'::jsonb,
  p_expected_updated_at timestamptz default null,
  p_at                  timestamptz default now()
)
returns public.mortgage_requests
language plpgsql security definer set search_path = public
as $$
declare
  r             public.mortgage_requests;
  v_caller      text := public.mortgage_caller();
  v_at          timestamptz := p_at;
  v_actor       uuid := p_actor_id;
  v_role        public.mortgage_team_role;
  v_from        public.mortgage_status;
  v_to          public.mortgage_status;
  v_clock       text;
  v_staff_event boolean := p_event in (
    'reupload_requested', 'reupload_cancelled', 'stage_changed',
    'declined', 'contact_logged', 'consultation_booked', 'consultation_held'
  );
  v_outstanding integer;
  v_from_stage  public.mortgage_stages;
  v_to_stage    public.mortgage_stages;
begin
  select * into r from public.mortgage_requests where id = p_request_id for update;
  if not found then
    raise exception 'mortgage request not found' using errcode = 'MR404';
  end if;

  if p_expected_updated_at is not null and r.updated_at is distinct from p_expected_updated_at then
    raise exception 'the request changed since it was loaded' using errcode = 'MR409';
  end if;

  -- Who may do this. Signed-in staff can't call this directly (0152, SR-10);
  -- the branch stays for the staff actions that call it as their owner.
  if v_caller = 'authenticated' then
    if not v_staff_event or p_actor_kind <> 'staff' then
      raise exception 'not allowed' using errcode = 'MR403';
    end if;
    v_role := public.mortgage_role();
    if v_role is null then
      raise exception 'not allowed' using errcode = 'MR403';
    end if;
    if v_role = 'adviser' and r.owner_staff_id is distinct from auth.uid() then
      raise exception 'only the owner or the Head of mortgages can do this' using errcode = 'MR403';
    end if;
    v_actor := auth.uid();
    v_at := now();
  elsif v_caller not in ('service_role', 'direct') then
    raise exception 'not allowed' using errcode = 'MR403';
  end if;

  -- The actor has to fit the event.
  if (v_staff_event and p_actor_kind <> 'staff')
  or (p_event = 'reupload_fulfilled' and p_actor_kind <> 'applicant')
  or (p_event = 'first_document_opened' and p_actor_kind <> 'system')
  then
    raise exception 'event % cannot come from a % actor', p_event, p_actor_kind using errcode = 'MR422';
  end if;

  v_from := r.status;
  v_to := r.status;

  if r.service = 'pre_approval' then
    case
      -- Since 0158 opening a document doesn't move the file; callers from
      -- before it may still send the event.
      when p_event = 'first_document_opened' then
        return r;
      -- A re-upload request pauses a running clock; the file stays on its stage.
      when r.status = 'open' and p_event = 'reupload_requested' then
        if r.sla_stopped_at is null and r.sla_paused_at is null and r.sla_due_at is not null then
          v_clock := 'pause';
        end if;
      when r.status = 'open' and p_event in ('reupload_fulfilled', 'reupload_cancelled') then
        select count(*) into v_outstanding
          from public.mortgage_reupload_requests
         where request_id = r.id and fulfilled_at is null and cancelled_at is null;
        if v_outstanding = 0 and r.sla_paused_at is not null and r.sla_stopped_at is null then
          v_clock := 'resume';
        end if;
      -- Any stage to any stage (0158). A declined file moved onto a stage is reopened.
      when r.status in ('open', 'declined') and p_event = 'stage_changed' then
        select * into v_to_stage from public.mortgage_stages where id = (p_data ->> 'stage_id')::uuid;
        if not found then
          raise exception 'no such stage' using errcode = 'MR422';
        end if;
        if r.status = 'open' and v_to_stage.id = r.stage_id then
          return r;
        end if;
        select * into v_from_stage from public.mortgage_stages where id = r.stage_id;
        v_to := 'open';
        v_clock := 'stage';
      -- D19: a file can be declined from any stage.
      when r.status = 'open' and p_event = 'declined' then
        v_to := 'declined';
        v_clock := 'stop';
      else
        raise exception 'illegal transition: % from % (Fast Pre-Approval)', p_event, r.status
          using errcode = 'MR422';
    end case;
  else
    case
      when r.status = 'new' and p_event = 'contact_logged' then
        v_to := 'contacted';
      when r.status in ('contacted', 'consultation_booked') and p_event = 'contact_logged' then
        v_to := r.status;
      when r.status = 'contacted' and p_event = 'consultation_booked' then
        v_to := 'consultation_booked';
      when r.status = 'consultation_booked' and p_event = 'consultation_held' then
        v_to := 'completed';
      else
        raise exception 'illegal transition: % from % (Mortgage Consultancy)', p_event, r.status
          using errcode = 'MR422';
    end case;
  end if;

  perform set_config('mortgage.transition', 'on', true);

  if v_clock = 'pause' then
    if (p_sla ->> 'remaining_seconds') is null then
      raise exception 'pausing the clock needs remaining_seconds from sla.ts' using errcode = 'MR422';
    end if;
    update public.mortgage_requests set
      sla_paused_at         = v_at,
      sla_remaining_seconds = (p_sla ->> 'remaining_seconds')::integer,
      sla_due_at            = null
    where id = r.id
    returning * into r;

  elsif v_clock = 'resume' then
    if (p_sla ->> 'due_at') is null then
      raise exception 'resuming the clock needs due_at from sla.ts' using errcode = 'MR422';
    end if;
    update public.mortgage_requests set
      sla_paused_seconds     = sla_paused_seconds
                               + greatest(0, floor(extract(epoch from (v_at - sla_paused_at))))::integer,
      sla_paused_at          = null,
      sla_remaining_seconds  = null,
      sla_due_at             = (p_sla ->> 'due_at')::timestamptz,
      sla_risk_notified_at   = null,
      sla_breach_notified_at = null
    where id = r.id
    returning * into r;

  elsif v_clock = 'stage' then
    -- A stage that answers the applicant stops the clock, once and for good;
    -- a closing stage closes the file, and leaving one reopens it. Reopening a
    -- declined file clears the decision (the activity log keeps it).
    update public.mortgage_requests set
      status           = v_to,
      stage_id         = v_to_stage.id,
      sla_stopped_at   = case when v_to_stage.stops_clock then coalesce(sla_stopped_at, v_at) else sla_stopped_at end,
      closed_at        = case when v_to_stage.closes_file then v_at end,
      decision         = null,
      decided_at       = null,
      decided_by       = null,
      decline_reason   = null,
      decision_message = case when v_from = 'declined' then null else decision_message end
    where id = r.id
    returning * into r;

  elsif v_clock = 'stop' then
    update public.mortgage_requests set
      status           = v_to,
      -- An answered file's clock stopped when it was answered; that stays.
      -- Declined during a re-upload, the pause stays as it was: slaStatus()
      -- reads a stopped clock without a due time from the working time
      -- frozen at the pause (and mortgage_requests_pause_shape holds).
      sla_stopped_at   = coalesce(sla_stopped_at, v_at),
      decision         = v_to::text::public.mortgage_decision,
      decided_at       = v_at,
      decided_by       = v_actor,
      closed_at        = v_at,
      decision_message = coalesce(p_data ->> 'message', decision_message),
      decline_reason   = (p_data ->> 'decline_reason')::public.mortgage_decline_reason
    where id = r.id
    returning * into r;

  elsif r.service = 'consultancy' then
    update public.mortgage_requests set
      status           = v_to,
      first_contact_at = case
                           when p_event = 'contact_logged' and first_contact_at is null then v_at
                           else first_contact_at
                         end,
      closed_at        = case when v_to = 'completed' then v_at else closed_at end
    where id = r.id
    returning * into r;
  end if;

  perform set_config('mortgage.transition', 'off', true);

  if v_clock = 'stage' then
    insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data, created_at)
    values (
      r.id, p_actor_kind, v_actor, 'stage.changed',
      jsonb_build_object(
        'from', v_from_stage.name, 'to', v_to_stage.name,
        'from_stage_id', v_from_stage.id, 'to_stage_id', v_to_stage.id,
        'reopened', v_from = 'declined'
      ),
      v_at
    );
  elsif v_to is distinct from v_from then
    insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data, created_at)
    values (
      r.id, p_actor_kind, v_actor, 'status.changed',
      jsonb_build_object('from', v_from, 'to', v_to, 'event', p_event),
      v_at
    );
  end if;

  return r;
end;
$$;

-- ── Staff actions ───────────────────────────────────────────────

-- Move a Fast Pre-Approval to any stage: the owner or the Head.
create function public.mortgage_move_stage(
  p_request_id          uuid,
  p_stage_id            uuid,
  p_expected_updated_at timestamptz default null
)
returns public.mortgage_requests
language plpgsql security definer set search_path = public
as $$
declare
  r       public.mortgage_requests := public.mortgage_lock(p_request_id, p_expected_updated_at);
  v_actor uuid := public.mortgage_authorise(r, true);
begin
  if r.service <> 'pre_approval' then
    raise exception 'only a Fast Pre-Approval has stages' using errcode = 'MR422';
  end if;
  return public.mortgage_transition(r.id, 'stage_changed', 'staff', v_actor, '{}'::jsonb,
                                    jsonb_build_object('stage_id', p_stage_id));
end;
$$;
revoke all on function public.mortgage_move_stage(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.mortgage_move_stage(uuid, uuid, timestamptz) to authenticated;

-- Decline: as 0156, from any stage. "No bank made an offer" needs a file the
-- team has answered (its clock stopped by a stage), since only then is it
-- shared with the banks.
create or replace function public.mortgage_decline(
  p_request_id          uuid,
  p_reason              public.mortgage_decline_reason,
  p_message             text,
  p_channels            text[],
  p_expected_updated_at timestamptz default null
)
returns public.mortgage_requests
language plpgsql security definer set search_path = public
as $$
declare
  r           public.mortgage_requests := public.mortgage_lock(p_request_id, p_expected_updated_at);
  v_actor     uuid := public.mortgage_authorise(r, true);
  v_message   text := btrim(coalesce(p_message, ''), E' \t\r\n');
  v_cancelled integer := 0;
  v_stage     text;
begin
  if r.service <> 'pre_approval' then
    raise exception 'only a Fast Pre-Approval is declined' using errcode = 'MR422';
  end if;
  if r.status <> 'open' then
    raise exception 'the request is closed' using errcode = 'MR409';
  end if;
  if p_reason is null or v_message = '' or char_length(v_message) > 4000 then
    raise exception 'a reason and a message are needed' using errcode = 'MR422';
  end if;
  if p_reason = 'no_bank_offer' and r.sla_stopped_at is null then
    raise exception 'no_bank_offer is only for an answered file' using errcode = 'MR422';
  end if;
  if p_channels is null
  or not ('email' = any(p_channels))
  or not (p_channels <@ array['email', 'whatsapp']) then
    raise exception 'email always goes; whatsapp is the only other channel' using errcode = 'MR422';
  end if;

  -- Whatever the applicant was asked to send again, they aren't any more.
  with cancelled as (
    update public.mortgage_reupload_requests set cancelled_at = now()
     where request_id = r.id and fulfilled_at is null and cancelled_at is null
    returning access_link_id, document_id
  ), revoked as (
    update public.mortgage_access_links set revoked_at = now(), session_hash = null
     where id in (select access_link_id from cancelled) and revoked_at is null
    returning draft_id
  ), expired as (
    update public.mortgage_upload_drafts set expires_at = now()
     where id in (select draft_id from revoked where draft_id is not null)
       and claimed_request_id is null
    returning id
  ), reviewable as (
    update public.mortgage_documents set state = 'to_review'
     where id in (select document_id from cancelled) and state = 'reupload_requested'
    returning id
  )
  select count(*) into v_cancelled from cancelled;

  select name into v_stage from public.mortgage_stages where id = r.stage_id;

  r := public.mortgage_transition(
    r.id, 'declined', 'staff', v_actor, '{}'::jsonb,
    jsonb_build_object('message', v_message, 'decline_reason', p_reason)
  );

  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (r.id, 'staff', v_actor, 'decision.declined',
          jsonb_build_object('reason', p_reason, 'channels', to_jsonb(p_channels),
                             'reuploads_cancelled', v_cancelled, 'stage', v_stage));

  insert into public.mortgage_notifications (request_id, kind, channel, created_at, next_attempt_at)
  select r.id, 'decision_declined', c, now(), now()
    from unnest(p_channels) as c;

  return r;
end;
$$;

-- Documents are reviewed while the file is open and not on a closing stage.
create or replace function public.mortgage_assert_reviewable(d public.mortgage_documents, r public.mortgage_requests)
returns void
language plpgsql stable set search_path = public
as $$
begin
  if r.status <> 'open' or r.closed_at is not null then
    raise exception 'the request is closed' using errcode = 'MR409';
  end if;
  if d.state <> 'to_review' then
    raise exception 'document_not_in_review' using errcode = 'MR409';
  end if;
end;
$$;

-- ── Keeping the stages (Pages & blocks → Mortgage stages) ───────

-- Add a stage (p_id null: at the end) or change one.
create function public.mortgage_save_stage(
  p_id          uuid,
  p_name        text,
  p_stops_clock boolean,
  p_closes_file boolean
)
returns public.mortgage_stages
language plpgsql security definer set search_path = public
as $$
declare
  s      public.mortgage_stages;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if public.mortgage_caller() <> 'authenticated' or not public.mortgage_can_edit_stages() then
    raise exception 'not allowed' using errcode = 'MR403';
  end if;
  if char_length(v_name) not between 1 and 40 then
    raise exception 'a name of 1 to 40 characters is needed' using errcode = 'MR422';
  end if;
  if exists (select 1 from public.mortgage_stages where lower(name) = lower(v_name) and id is distinct from p_id) then
    raise exception 'stage_name_taken' using errcode = 'MR409';
  end if;

  if p_id is null then
    insert into public.mortgage_stages (name, position, stops_clock, closes_file)
    values (v_name, coalesce((select max(position) from public.mortgage_stages), 0) + 1,
            coalesce(p_stops_clock, false), coalesce(p_closes_file, false))
    returning * into s;
  else
    update public.mortgage_stages
       set name = v_name, stops_clock = coalesce(p_stops_clock, false),
           closes_file = coalesce(p_closes_file, false), updated_at = now()
     where id = p_id
    returning * into s;
    if not found then
      raise exception 'no such stage' using errcode = 'MR404';
    end if;
  end if;
  return s;
end;
$$;

-- The stages in a new order: every stage's id, once, first to last.
create function public.mortgage_reorder_stages(p_ids uuid[])
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if public.mortgage_caller() <> 'authenticated' or not public.mortgage_can_edit_stages() then
    raise exception 'not allowed' using errcode = 'MR403';
  end if;
  if p_ids is null
  or cardinality(p_ids) <> (select count(*) from public.mortgage_stages)
  or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x)
  or exists (select 1 from unnest(p_ids) x where x not in (select id from public.mortgage_stages)) then
    raise exception 'every stage, once' using errcode = 'MR422';
  end if;
  update public.mortgage_stages s
     set position = o.ord, updated_at = now()
    from unnest(p_ids) with ordinality as o(id, ord)
   where s.id = o.id and s.position is distinct from o.ord;
end;
$$;

-- Remove a stage no file is on; the last one stays.
create function public.mortgage_delete_stage(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_files integer;
begin
  if public.mortgage_caller() <> 'authenticated' or not public.mortgage_can_edit_stages() then
    raise exception 'not allowed' using errcode = 'MR403';
  end if;
  if (select count(*) from public.mortgage_stages) <= 1 then
    raise exception 'last_stage' using errcode = 'MR409';
  end if;
  select count(*) into v_files from public.mortgage_requests where stage_id = p_id;
  if v_files > 0 then
    raise exception 'stage_in_use:%', v_files using errcode = 'MR409';
  end if;
  delete from public.mortgage_stages where id = p_id;
  if not found then
    raise exception 'no such stage' using errcode = 'MR404';
  end if;
  -- Close the gap, so positions stay 1…n.
  update public.mortgage_stages s
     set position = o.ord
    from (select id, row_number() over (order by position) as ord from public.mortgage_stages) o
   where s.id = o.id and s.position is distinct from o.ord;
end;
$$;

revoke all on function public.mortgage_save_stage(uuid, text, boolean, boolean) from public, anon;
grant execute on function public.mortgage_save_stage(uuid, text, boolean, boolean) to authenticated;
revoke all on function public.mortgage_reorder_stages(uuid[]) from public, anon;
grant execute on function public.mortgage_reorder_stages(uuid[]) to authenticated;
revoke all on function public.mortgage_delete_stage(uuid) from public, anon;
grant execute on function public.mortgage_delete_stage(uuid) to authenticated;
