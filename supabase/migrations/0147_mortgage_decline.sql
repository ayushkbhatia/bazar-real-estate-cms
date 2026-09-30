-- 0147 · Declining a Fast Pre-Approval (decision D19).
--
-- Phase 6 of the mortgage module (docs/mortgage/PLAN.md) builds the decision,
-- and D19 asked three things of it, now decided (DECISIONS.md):
--
--   · Reasons. Eight, kept on the request (`decline_reason`) so the team can
--     see why files fail: income below the banks' minimum, monthly debts too
--     high (the Central Bank's 50% debt-burden cap), the credit report
--     (AECB), too short a time in the job or the business, age at the end of
--     the term, documents incomplete, no partner bank made an offer, other.
--   · The message. The adviser's own words, prefilled from a template for the
--     reason (lib/mortgage-requests/decline.ts) and edited before sending; it
--     goes to the applicant by email, from the outbox, with WhatsApp recorded
--     as due (D1).
--   · Before the banks? Yes: from New, In review, Awaiting applicant and With
--     banks. Some files are plainly not bankable, and telling the applicant
--     within the 24 hours is the promise, so a decline stops the clock as a
--     pre-approval does. Declining while a re-upload is out cancels it and
--     revokes its link; declining with the banks withdraws their open
--     submissions.
--
-- `mortgage_transition()` is redefined here from 0139 with the decline moves
-- and the reason; a file declined while paused keeps its frozen time left,
-- which is what slaStatus() reads. `mortgage_requests_guard()` now also keeps
-- the decision's message and reason to the function.
-- lib/mortgage-requests/state.ts mirrors the table:
--
--   declined   new, in_review, awaiting_applicant, with_banks → declined   staff   clock stops

-- ── The reasons ──────────────────────────────────────────────────

create type public.mortgage_decline_reason as enum (
  'income_below_minimum',
  'debt_burden',
  'credit_report',
  'employment_history',
  'age_at_term_end',
  'documents_incomplete',
  'no_bank_offer',
  'other'
);

alter table public.mortgage_requests
  add column decline_reason public.mortgage_decline_reason,
  add constraint mortgage_requests_decline_reason_fits
    check (decline_reason is null or decision = 'declined');

-- The applicant hears from the outbox, email first; WhatsApp is recorded (D1).
alter table public.mortgage_notifications drop constraint mortgage_notifications_kind_check;
alter table public.mortgage_notifications add constraint mortgage_notifications_kind_check check (
  kind in (
    'applicant_received',
    'team_new_request',
    'team_at_risk',
    'team_breached',
    'consultation_booked',
    'preapproval_invite',
    'reupload_request',
    'otp_code',
    'team_reupload_received',
    'decision_declined'
  )
);

-- ── The guard and the transition, from 0139 ──────────────────────

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
  or new.decision_message      is distinct from old.decision_message
  or new.decline_reason        is distinct from old.decline_reason
  then
    raise exception 'status, clock and decision columns change only through mortgage_transition()'
      using errcode = 'MR403';
  end if;

  return new;
end;
$$;

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
      -- D19: a file can be declined before it goes to the banks, as well as
      -- after. A decline is an answer, so it stops the clock like one.
      when r.status in ('new', 'in_review', 'awaiting_applicant', 'with_banks') and p_event = 'declined' then
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
      -- Declined while waiting on the applicant, the pause stays as it was:
      -- slaStatus() reads a stopped clock without a due time from the working
      -- time frozen at the pause (and mortgage_requests_pause_shape holds).
      decision                = v_to::text::public.mortgage_decision,
      decided_at              = v_at,
      decided_by              = v_actor,
      closed_at               = v_at,
      decision_message        = coalesce(p_data ->> 'message', decision_message),
      decline_reason          = case
                                  when v_to = 'declined'
                                    then coalesce((p_data ->> 'decline_reason')::public.mortgage_decline_reason, decline_reason)
                                end,
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

-- ── Decline (C2 now, C5's Decline tab in Phase 6) ───────────────

-- Through the adviser's own session: the owner or the Head of mortgages, on
-- an open Fast Pre-Approval. The message is the applicant's to read, so it is
-- required; email always goes, WhatsApp when chosen (recorded until D1).
create function public.mortgage_decline(
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
  v_withdrawn integer := 0;
begin
  if r.service <> 'pre_approval' then
    raise exception 'only a Fast Pre-Approval is declined' using errcode = 'MR422';
  end if;
  if r.status not in ('new', 'in_review', 'awaiting_applicant', 'with_banks') then
    raise exception 'the request is closed' using errcode = 'MR409';
  end if;
  if p_reason is null or v_message = '' or char_length(v_message) > 4000 then
    raise exception 'a reason and a message are needed' using errcode = 'MR422';
  end if;
  -- The message for it says the banks were asked; only true once they were.
  if p_reason = 'no_bank_offer' and r.status <> 'with_banks' then
    raise exception 'no_bank_offer is only for a file that went to the banks' using errcode = 'MR422';
  end if;
  if p_channels is null
  or not ('email' = any(p_channels))
  or not (p_channels <@ array['email', 'whatsapp']) then
    raise exception 'email always goes; whatsapp is the only other channel' using errcode = 'MR422';
  end if;

  -- Whatever the applicant was asked to send again, they aren't any more:
  -- the request is cancelled, its link stops working, and anything uploaded
  -- through it and never sent goes at the worker's next sweep.
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

  -- Banks still considering the file are told it's withdrawn (Phase 6 writes to them).
  update public.mortgage_bank_submissions set status = 'withdrawn'
   where request_id = r.id and status = 'sent';
  get diagnostics v_withdrawn = row_count;

  r := public.mortgage_transition(
    r.id, 'declined', 'staff', v_actor, '{}'::jsonb,
    jsonb_build_object('message', v_message, 'decline_reason', p_reason)
  );

  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (r.id, 'staff', v_actor, 'decision.declined',
          jsonb_build_object('reason', p_reason, 'channels', to_jsonb(p_channels),
                             'reuploads_cancelled', v_cancelled, 'banks_withdrawn', v_withdrawn));

  insert into public.mortgage_notifications (request_id, kind, channel, created_at, next_attempt_at)
  select r.id, 'decision_declined', c, now(), now()
    from unnest(p_channels) as c;

  return r;
end;
$$;

revoke all on function public.mortgage_decline(uuid, public.mortgage_decline_reason, text, text[], timestamptz)
  from public, anon;
grant execute on function public.mortgage_decline(uuid, public.mortgage_decline_reason, text, text[], timestamptz)
  to authenticated;
