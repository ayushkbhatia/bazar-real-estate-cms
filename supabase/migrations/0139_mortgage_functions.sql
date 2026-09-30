-- ───────────────────────────────────────────────────────────────
-- 0139 · Mortgage requests — functions and invariants
--
-- SPEC §2.4 says every status change goes through one function that validates
-- the move and writes the status and a `mortgage_events` row in one
-- transaction. supabase-js has no client-side transactions, so that function
-- lives here, as `mortgage_transition()`. lib/mortgage-requests/state.ts
-- mirrors its table for the UI, and the database tests hold the two together.
--
-- The rest of this file turns the module's rules into things the database
-- enforces rather than conventions:
--
--   · status, clock and decision columns change only inside these functions
--     (a trigger rejects any other write, the service role's included);
--   · `mortgage_events` is append-only;
--   · reference numbers are allocated once and never reused.
--
-- The 24-hour promise runs on working hours (decision D11). The working-time
-- maths lives in one place, lib/mortgage-requests/sla.ts; these functions take
-- its results (`due_at`, `remaining_seconds`) as parameters and store them.
--
-- Errors carry an SQLSTATE the app maps to a response:
--   MR403 not allowed · MR404 not found · MR409 changed by someone else ·
--   MR422 illegal transition or missing input.
-- ───────────────────────────────────────────────────────────────

-- ── Who is calling ──────────────────────────────────────────────

-- 'authenticated', 'service_role' or 'anon' through PostgREST; 'direct' for a
-- database connection with no JWT (migrations, seeds, psql).
create or replace function public.mortgage_caller()
returns text
language sql stable set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    'direct'
  );
$$;

-- ── Invariant: status and clock change only through the functions ──

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
  then
    raise exception 'status, clock and decision columns change only through mortgage_transition()'
      using errcode = 'MR403';
  end if;

  return new;
end;
$$;

create trigger mortgage_requests_guard
  before insert or update on public.mortgage_requests
  for each row execute function public.mortgage_requests_guard();

-- ── Invariant: the activity log is append-only ──────────────────

-- Only the retention purge and DSR erasure (Phase 7) may delete, by setting
-- `mortgage.purge` for their own transaction.
create or replace function public.mortgage_events_append_only()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('mortgage.purge', true), '') = 'on' then
    return old;
  end if;
  raise exception 'mortgage_events is append-only' using errcode = 'MR403';
end;
$$;

create trigger mortgage_events_append_only
  before update or delete on public.mortgage_events
  for each row execute function public.mortgage_events_append_only();

-- Row triggers don't fire on TRUNCATE.
create trigger mortgage_events_no_truncate
  before truncate on public.mortgage_events
  for each statement execute function public.mortgage_events_append_only();

revoke update, delete, truncate on public.mortgage_events from service_role;

-- ── Reference numbers ───────────────────────────────────────────

-- BZM-{YY}-{NNNN}, YY from the submission's year in Asia/Dubai. The upsert
-- takes the counter row's lock, so concurrent submits queue rather than
-- collide, and the counter only moves forward.
create or replace function public.mortgage_allocate_reference(p_at timestamptz default now())
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_yy smallint := (extract(year from (p_at at time zone 'Asia/Dubai'))::integer % 100)::smallint;
  v_n  integer;
begin
  insert into public.mortgage_reference_counters as c (yy, last_number)
  values (v_yy, 1)
  on conflict (yy) do update set last_number = c.last_number + 1
  returning c.last_number into v_n;

  return format('BZM-%s-%s', lpad(v_yy::text, 2, '0'), lpad(v_n::text, 4, '0'));
end;
$$;

-- ── Owner assignment (SPEC §2.7) ────────────────────────────────

-- Round-robin across active advisers when the setting says so; otherwise the
-- request waits in the queue to be claimed. Locks the settings row, so two
-- submits never pick from the same cursor.
create or replace function public.mortgage_next_owner()
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_mode public.mortgage_assignment_mode;
  v_last uuid;
  v_next uuid;
begin
  select assignment_mode, round_robin_last_staff_id
    into v_mode, v_last
    from public.mortgage_settings where id = 1
    for update;

  if v_mode is distinct from 'round_robin' then
    return null;
  end if;

  select user_id into v_next from public.staff
   where mortgage_role = 'adviser' and status = 'active'
     and (v_last is null or user_id > v_last)
   order by user_id
   limit 1;

  if v_next is null then
    select user_id into v_next from public.staff
     where mortgage_role = 'adviser' and status = 'active'
     order by user_id
     limit 1;
  end if;

  if v_next is not null then
    update public.mortgage_settings set round_robin_last_staff_id = v_next where id = 1;
  end if;

  return v_next;
end;
$$;

-- ── — → new: the applicant submits (SPEC §2.4, first row) ──────

-- Called by the submit endpoint with the service role, after its own checks
-- (bot check, rate limit, draft token, validation). `p_sla_due_at` comes from
-- sla.ts. A repeated `p_submission_key` returns the request it already made.
-- Attaching draft files and sending emails follow in Phases 2–3.
create or replace function public.mortgage_create_request(
  p_service           public.mortgage_service,
  p_full_name         text,
  p_date_of_birth     date,
  p_mobile_e164       text,
  p_email             text,
  p_residency         public.mortgage_residency,
  p_employment_type   public.mortgage_employment,
  p_entry_point       public.mortgage_entry_point default 'direct',
  p_property_ref      text default null,
  p_parent_request_id uuid default null,
  p_submission_key    uuid default null,
  p_consent_version   text default null,
  p_consent_text      text default null,
  p_ip                inet default null,
  p_user_agent        text default null,
  p_sla_due_at        timestamptz default null,
  p_at                timestamptz default now()
)
returns public.mortgage_requests
language plpgsql security definer set search_path = public
as $$
declare
  r          public.mortgage_requests;
  v_owner    uuid;
  v_property uuid;
  v_kinds    public.mortgage_doc_kind[];
begin
  if public.mortgage_caller() not in ('service_role', 'direct') then
    raise exception 'not allowed' using errcode = 'MR403';
  end if;

  if p_submission_key is not null then
    select * into r from public.mortgage_requests where submission_key = p_submission_key;
    if found then
      return r;
    end if;
  end if;

  if p_service = 'pre_approval' then
    if p_consent_version is null or p_consent_text is null then
      raise exception 'a pre-approval needs consent on file' using errcode = 'MR422';
    end if;
    if p_sla_due_at is null or p_sla_due_at <= p_at then
      raise exception 'a pre-approval needs its promise due time' using errcode = 'MR422';
    end if;
  elsif p_sla_due_at is not null then
    raise exception 'consultancy has no promise clock' using errcode = 'MR422';
  end if;

  if p_property_ref is not null then
    select id into v_property from public.properties where reference = p_property_ref;
  end if;

  perform set_config('mortgage.transition', 'on', true);
  begin
    v_owner := public.mortgage_next_owner();

    insert into public.mortgage_requests (
      reference, service, status,
      full_name, date_of_birth, mobile_e164, email, residency, employment_type,
      entry_point, property_id, property_ref, parent_request_id, submission_key,
      owner_staff_id, assigned_at, submitted_at,
      sla_started_at, sla_due_at, created_at
    ) values (
      public.mortgage_allocate_reference(p_at), p_service, 'new',
      btrim(p_full_name), p_date_of_birth, p_mobile_e164, lower(btrim(p_email)), p_residency, p_employment_type,
      p_entry_point, v_property, p_property_ref, p_parent_request_id, p_submission_key,
      v_owner, case when v_owner is not null then p_at end, p_at,
      case when p_service = 'pre_approval' then p_at end,
      case when p_service = 'pre_approval' then p_sla_due_at end,
      p_at
    )
    returning * into r;
  exception when unique_violation then
    -- A retry with the same key won the race. Everything in this block rolled
    -- back, the reference and the round-robin cursor included, so no number is
    -- lost and no adviser is skipped.
    perform set_config('mortgage.transition', 'off', true);
    select * into r from public.mortgage_requests where submission_key = p_submission_key;
    if not found then
      raise;
    end if;
    return r;
  end;
  perform set_config('mortgage.transition', 'off', true);

  if p_service = 'pre_approval' then
    -- Must match DOCUMENT_SETS in lib/mortgage-requests/documents.ts
    -- (the database tests compare them).
    v_kinds := case p_employment_type
      when 'salaried' then
        array['emirates_id', 'passport', 'salary_certificate', 'bank_statements_3m']::public.mortgage_doc_kind[]
      else
        array['emirates_id', 'passport', 'trade_license', 'bank_statements_12m']::public.mortgage_doc_kind[]
    end;

    insert into public.mortgage_documents (request_id, kind)
    select r.id, k from unnest(v_kinds) as k;

    insert into public.mortgage_consents (request_id, wording_version, wording_text, given_at, ip, user_agent)
    values (r.id, p_consent_version, p_consent_text, p_at, p_ip, p_user_agent);
  end if;

  insert into public.mortgage_events (request_id, actor_kind, type, data, ip, created_at)
  values (
    r.id, 'applicant', 'request.submitted',
    jsonb_build_object('service', p_service, 'entry_point', p_entry_point),
    p_ip, p_at
  );

  if v_owner is not null then
    insert into public.mortgage_events (request_id, actor_kind, type, data, created_at)
    values (
      r.id, 'system', 'owner.assigned',
      jsonb_build_object('owner_staff_id', v_owner, 'via', 'round_robin'),
      p_at
    );
  end if;

  return r;
end;
$$;

-- ── Every later status change (SPEC §2.4) ───────────────────────

-- Events and what they do. Must match TRANSITIONS in
-- lib/mortgage-requests/state.ts.
--
--   Fast Pre-Approval
--     first_document_opened  new → in_review                      system
--     reupload_requested     in_review → awaiting_applicant       staff    clock pauses
--                            awaiting_applicant → itself          staff    (a second document)
--     reupload_fulfilled     awaiting_applicant → in_review       applicant clock resumes
--     reupload_cancelled     awaiting_applicant → in_review       staff    clock resumes
--                            (both stay awaiting while another re-upload is outstanding)
--     sent_to_banks          in_review → with_banks               staff    every document accepted,
--                                                                          consent on file, ≥ 1 bank
--     pre_approved           with_banks → pre_approved            staff    clock stops
--     declined               with_banks → declined                staff    clock stops
--   Mortgage Consultancy
--     contact_logged         new → contacted                      staff    first contact time
--                            contacted, consultation_booked → itself
--     consultation_booked    contacted → consultation_booked      staff
--     consultation_held      consultation_booked → completed      staff
--
-- Signed-in staff may fire only the staff events, and an adviser only on
-- requests they own; the Head of mortgages on any. Applicant and system
-- events come from the service role (the website's endpoints, the file route,
-- crons). A signed-in caller's `p_at` is ignored: the log records the real
-- time. `p_expected_updated_at` is the optimistic-concurrency check (409).
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
    'reupload_requested', 'reupload_cancelled', 'sent_to_banks', 'pre_approved',
    'declined', 'contact_logged', 'consultation_booked', 'consultation_held'
  );
  v_outstanding integer;
  v_accepted    integer;
  v_required    integer;
  v_banks       integer;
begin
  select * into r from public.mortgage_requests where id = p_request_id for update;
  if not found then
    raise exception 'mortgage request not found' using errcode = 'MR404';
  end if;

  if p_expected_updated_at is not null and r.updated_at is distinct from p_expected_updated_at then
    raise exception 'the request changed since it was loaded' using errcode = 'MR409';
  end if;

  -- Who may do this.
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

  if r.service = 'pre_approval' then
    case
      when r.status = 'new' and p_event = 'first_document_opened' then
        v_to := 'in_review';
      when r.status = 'in_review' and p_event = 'reupload_requested' then
        v_to := 'awaiting_applicant';
        v_clock := 'pause';
      when r.status = 'awaiting_applicant' and p_event = 'reupload_requested' then
        v_to := 'awaiting_applicant';
      when r.status = 'awaiting_applicant' and p_event in ('reupload_fulfilled', 'reupload_cancelled') then
        select count(*) into v_outstanding
          from public.mortgage_reupload_requests
         where request_id = r.id and fulfilled_at is null and cancelled_at is null;
        if v_outstanding = 0 then
          v_to := 'in_review';
          v_clock := 'resume';
        else
          v_to := 'awaiting_applicant';
        end if;
      when r.status = 'in_review' and p_event = 'sent_to_banks' then
        select count(*) filter (where state = 'accepted'), count(*)
          into v_accepted, v_required
          from public.mortgage_documents where request_id = r.id;
        if v_required = 0 or v_accepted < v_required then
          raise exception 'every document must be accepted first' using errcode = 'MR422';
        end if;
        if not exists (
          select 1 from public.mortgage_consents where request_id = r.id and withdrawn_at is null
        ) then
          raise exception 'consent is not on file' using errcode = 'MR422';
        end if;
        select count(*) into v_banks from public.mortgage_bank_submissions where request_id = r.id;
        if v_banks = 0 then
          raise exception 'send the package to at least one bank' using errcode = 'MR422';
        end if;
        v_to := 'with_banks';
      when r.status = 'with_banks' and p_event = 'pre_approved' then
        v_to := 'pre_approved';
        v_clock := 'stop';
      when r.status = 'with_banks' and p_event = 'declined' then
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
      status                = v_to,
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
      status                 = v_to,
      sla_paused_seconds     = sla_paused_seconds
                               + greatest(0, floor(extract(epoch from (v_at - sla_paused_at))))::integer,
      sla_paused_at          = null,
      sla_remaining_seconds  = null,
      sla_due_at             = (p_sla ->> 'due_at')::timestamptz,
      sla_risk_notified_at   = null,
      sla_breach_notified_at = null
    where id = r.id
    returning * into r;

  elsif v_clock = 'stop' then
    update public.mortgage_requests set
      status                  = v_to,
      sla_stopped_at          = v_at,
      decision                = v_to::text::public.mortgage_decision,
      decided_at              = v_at,
      decided_by              = v_actor,
      closed_at               = v_at,
      decision_message        = coalesce(p_data ->> 'message', decision_message),
      lead_bank_submission_id = coalesce((p_data ->> 'lead_bank_submission_id')::uuid, lead_bank_submission_id)
    where id = r.id
    returning * into r;

  else
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

  if v_to is distinct from v_from then
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

-- ── Writing to the activity log ─────────────────────────────────

-- Every CMS action and every document open writes an event (SPEC §8: the file
-- route writes `document.viewed` or `document.downloaded` before any bytes).
-- A signed-in caller must be on the mortgage team; the event is recorded as
-- theirs, at the database's clock.
create or replace function public.mortgage_log_event(
  p_request_id uuid,
  p_type       text,
  p_data       jsonb default '{}'::jsonb,
  p_actor_kind public.mortgage_actor default 'staff',
  p_actor_id   uuid default null,
  p_ip         inet default null,
  p_at         timestamptz default now()
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_caller text := public.mortgage_caller();
  v_actor  uuid := p_actor_id;
  v_at     timestamptz := p_at;
  v_id     uuid;
begin
  if v_caller = 'authenticated' then
    if public.mortgage_role() is null or p_actor_kind <> 'staff' then
      raise exception 'not allowed' using errcode = 'MR403';
    end if;
    v_actor := auth.uid();
    v_at := now();
  elsif v_caller not in ('service_role', 'direct') then
    raise exception 'not allowed' using errcode = 'MR403';
  end if;

  if not exists (select 1 from public.mortgage_requests where id = p_request_id) then
    raise exception 'mortgage request not found' using errcode = 'MR404';
  end if;

  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data, ip, created_at)
  values (p_request_id, p_actor_kind, v_actor, p_type, coalesce(p_data, '{}'::jsonb), p_ip, v_at)
  returning id into v_id;

  return v_id;
end;
$$;

-- ── Who can call what ───────────────────────────────────────────

-- Supabase grants EXECUTE on new functions to anon and authenticated by
-- default. Take it back, then grant only what each caller needs.
revoke all on function public.mortgage_caller() from public, anon, authenticated;
revoke all on function public.mortgage_allocate_reference(timestamptz) from public, anon, authenticated;
revoke all on function public.mortgage_next_owner() from public, anon, authenticated;
revoke all on function public.mortgage_create_request(
  public.mortgage_service, text, date, text, text, public.mortgage_residency,
  public.mortgage_employment, public.mortgage_entry_point, text, uuid, uuid,
  text, text, inet, text, timestamptz, timestamptz
) from public, anon, authenticated;
revoke all on function public.mortgage_transition(
  uuid, text, public.mortgage_actor, uuid, jsonb, jsonb, timestamptz, timestamptz
) from public, anon;
revoke all on function public.mortgage_log_event(
  uuid, text, jsonb, public.mortgage_actor, uuid, inet, timestamptz
) from public, anon;

grant execute on function public.mortgage_allocate_reference(timestamptz) to service_role;
grant execute on function public.mortgage_create_request(
  public.mortgage_service, text, date, text, text, public.mortgage_residency,
  public.mortgage_employment, public.mortgage_entry_point, text, uuid, uuid,
  text, text, inet, text, timestamptz, timestamptz
) to service_role;
grant execute on function public.mortgage_transition(
  uuid, text, public.mortgage_actor, uuid, jsonb, jsonb, timestamptz, timestamptz
) to authenticated, service_role;
grant execute on function public.mortgage_log_event(
  uuid, text, jsonb, public.mortgage_actor, uuid, inet, timestamptz
) to authenticated, service_role;
