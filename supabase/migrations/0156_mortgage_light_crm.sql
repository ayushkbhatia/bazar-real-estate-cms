-- 0156 · The mortgage CMS becomes a light CRM (Bazar, 13 Oct 2026).
--
-- The client shares applications with its partner banks by hand. The banks'
-- side of the module goes: the partner-bank list, the bank packages and their
-- links, the reminders, the banks' letters and the C5 decision page that
-- recorded their offers (0149, 0150). A Fast Pre-Approval now ends like this:
--
--     in_review ─ application_accepted ─▶ accepted ─ pre_approved ─▶ pre_approved
--                                             └──── declined ─────▶ declined
--
--   · `with_banks` is renamed `accepted`. Accepting needs what sending to the
--     banks needed (every document accepted, consent on file) except a bank.
--     It is the team's answer, so it stops the 24-hour clock, but the file
--     stays open: closed_at and the decision are written when the outcome is
--     recorded.
--   · The outcome is one click (`mortgage_record_pre_approval()`) or the
--     existing decline. Neither touches the stopped clock, so the promise is
--     measured to the acceptance.
--   · Files already with the banks are accepted, their clock stopped at the
--     moment they were sent.
--   · The banks' tables, functions, emails and outbox kinds are dropped. The
--     activity log keeps its old bank lines (it is append-only); the CMS no
--     longer shows them.
--
-- The banks' letters were files in the private bucket. SQL can't delete a
-- storage object, so the object keys are deleted from the bucket by the
-- service role before this migration runs (the PR says how); here the rows
-- go.

-- ── Status ───────────────────────────────────────────────────────

alter type public.mortgage_status rename value 'with_banks' to 'accepted';

-- ── The banks' letters and the request's lead offer ─────────────

delete from public.mortgage_files where bank_submission_id is not null;

alter table public.mortgage_files drop constraint mortgage_files_owner;
alter table public.mortgage_files drop column bank_submission_id;
alter table public.mortgage_files add constraint mortgage_files_owner check (
  num_nonnulls(draft_id, document_id) >= 1
);

alter table public.mortgage_requests drop column lead_bank_submission_id;

-- ── Bank functions and tables ───────────────────────────────────

drop function public.mortgage_pre_approve(uuid, uuid, text, text[], timestamptz);
drop function public.mortgage_record_bank_response(
  uuid, public.mortgage_bank_sub_status, numeric, numeric, public.mortgage_rate_type, integer, date, uuid, text
);
drop function public.mortgage_letter_presign(uuid, text, bigint);
drop function public.mortgage_bank_reminder(uuid, text, timestamptz);
drop function public.mortgage_send_to_banks(uuid, jsonb, jsonb, timestamptz);
drop function public.mortgage_save_bank(uuid, text, text, text, boolean, text[], integer);

-- The retention and erasure functions read the bank tables; they are
-- redefined below without them.
drop function public.mortgage_retention_files(integer, integer);
drop function public.mortgage_retire_files(uuid[]);
drop function public.mortgage_erasure_files(uuid[]);
drop function public.mortgage_erase_requests(uuid[]);

drop function public.mortgage_bank_label(public.mortgage_partner_banks);

drop table public.mortgage_bank_submissions;
drop table public.mortgage_partner_banks;

drop type public.mortgage_bank_sub_status;
drop type public.mortgage_rate_type;

-- ── Outbox and emails ───────────────────────────────────────────

delete from public.mortgage_notifications
 where kind in ('bank_package', 'bank_reminder', 'decision_pre_approved');

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

-- System emails refuse deletion (content_assets_protect_system); 0132 set
-- the precedent for retiring one with the feature it belonged to.
alter table public.content_assets disable trigger content_assets_protect_system;
delete from public.content_assets
 where system_key in ('mortgage_bank_package', 'mortgage_bank_reminder', 'mortgage_decision_pre_approved');
alter table public.content_assets enable trigger content_assets_protect_system;

-- The whole allow-list, as 0150's: a later rewrite must carry these.
alter table public.content_assets
  drop constraint if exists content_assets_system_key_known;

alter table public.content_assets
  add constraint content_assets_system_key_known check (
    system_key is null
    or system_key = any (array[
      'enquiry_auto_reply',
      'mortgage_enquiry_ack',
      'mortgage_consultancy_received',
      'mortgage_preapproval_received',
      'mortgage_consultation_booked',
      'mortgage_preapproval_invite',
      'mortgage_reupload_request',
      'mortgage_code',
      'mortgage_decision_declined',
      'valuation_request_ack',
      'valuation_code',
      'valuation_report_requested',
      'valuation_report',
      'valuation_nurture_day7',
      'valuation_nurture_day30',
      'newsletter_confirmation',
      'newsletter_welcome',
      'staff_invitation',
      'staff_password_reset',
      'enquiry_escalation',
      'mortgage_team_new_request',
      'mortgage_team_at_risk',
      'mortgage_team_breached',
      'mortgage_team_reupload_received',
      'permit_expiry_warning',
      'bulk_reassign_digest',
      'health_digest',
      'form_submission_notification'
    ])
  );

-- ── The transition ──────────────────────────────────────────────

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
    'reupload_requested', 'reupload_cancelled', 'application_accepted', 'pre_approved',
    'declined', 'contact_logged', 'consultation_booked', 'consultation_held'
  );
  v_outstanding integer;
  v_accepted    integer;
  v_required    integer;
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
      when r.status = 'in_review' and p_event = 'application_accepted' then
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
        v_to := 'accepted';
        v_clock := 'answer';
      when r.status = 'accepted' and p_event = 'pre_approved' then
        v_to := 'pre_approved';
        v_clock := 'stop';
      -- D19: a file can be declined before it is accepted, as well as after.
      when r.status in ('new', 'in_review', 'awaiting_applicant', 'accepted') and p_event = 'declined' then
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

  elsif v_clock = 'answer' then
    -- Accepted: the team has answered, so the clock stops; the file stays open.
    update public.mortgage_requests set
      status         = v_to,
      sla_stopped_at = v_at
    where id = r.id
    returning * into r;

  elsif v_clock = 'stop' then
    update public.mortgage_requests set
      status           = v_to,
      -- An accepted file's clock stopped when it was accepted; that stays.
      -- Declined while waiting on the applicant, the pause stays as it was:
      -- slaStatus() reads a stopped clock without a due time from the working
      -- time frozen at the pause (and mortgage_requests_pause_shape holds).
      sla_stopped_at   = coalesce(sla_stopped_at, v_at),
      decision         = v_to::text::public.mortgage_decision,
      decided_at       = v_at,
      decided_by       = v_actor,
      closed_at        = v_at,
      decision_message = coalesce(p_data ->> 'message', decision_message),
      decline_reason   = case
                           when v_to = 'declined'
                             then coalesce((p_data ->> 'decline_reason')::public.mortgage_decline_reason, decline_reason)
                         end
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

-- ── Staff actions ───────────────────────────────────────────────

-- Accept application: the owner or the Head, once every document is accepted
-- and consent is on file. The team shares the file with the banks itself.
create function public.mortgage_accept_application(
  p_request_id          uuid,
  p_expected_updated_at timestamptz default null
)
returns public.mortgage_requests
language plpgsql security definer set search_path = public
as $$
declare
  r       public.mortgage_requests := public.mortgage_lock(p_request_id, p_expected_updated_at);
  v_actor uuid := public.mortgage_authorise(r, true);
begin
  if r.service <> 'pre_approval' or r.status <> 'in_review' then
    raise exception 'only a file in review is accepted' using errcode = 'MR409';
  end if;
  r := public.mortgage_transition(r.id, 'application_accepted', 'staff', v_actor);
  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (r.id, 'staff', v_actor, 'application.accepted', '{}'::jsonb);
  return r;
end;
$$;

-- The outcome: a bank pre-approved the applicant. Recorded, not sent — the
-- team tells the applicant itself.
create function public.mortgage_record_pre_approval(
  p_request_id          uuid,
  p_note                text default null,
  p_expected_updated_at timestamptz default null
)
returns public.mortgage_requests
language plpgsql security definer set search_path = public
as $$
declare
  r       public.mortgage_requests := public.mortgage_lock(p_request_id, p_expected_updated_at);
  v_actor uuid := public.mortgage_authorise(r, true);
  v_note  text := nullif(btrim(coalesce(p_note, ''), E' \t\r\n'), '');
begin
  if r.service <> 'pre_approval' or r.status <> 'accepted' then
    raise exception 'only an accepted file is pre-approved' using errcode = 'MR409';
  end if;
  if char_length(coalesce(v_note, '')) > 1000 then
    raise exception 'the note is too long' using errcode = 'MR422';
  end if;
  r := public.mortgage_transition(
    r.id, 'pre_approved', 'staff', v_actor, '{}'::jsonb,
    case when v_note is null then '{}'::jsonb else jsonb_build_object('message', v_note) end
  );
  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (r.id, 'staff', v_actor, 'decision.pre_approved',
          case when v_note is null then '{}'::jsonb else jsonb_build_object('note', v_note) end);
  return r;
end;
$$;

revoke all on function public.mortgage_accept_application(uuid, timestamptz) from public, anon;
grant execute on function public.mortgage_accept_application(uuid, timestamptz) to authenticated;
revoke all on function public.mortgage_record_pre_approval(uuid, text, timestamptz) from public, anon;
grant execute on function public.mortgage_record_pre_approval(uuid, text, timestamptz) to authenticated;

-- Decline: as 0147, without the banks to withdraw. `no_bank_offer` still
-- needs the file to have been accepted, since the team only then shares it.
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
begin
  if r.service <> 'pre_approval' then
    raise exception 'only a Fast Pre-Approval is declined' using errcode = 'MR422';
  end if;
  if r.status not in ('new', 'in_review', 'awaiting_applicant', 'accepted') then
    raise exception 'the request is closed' using errcode = 'MR409';
  end if;
  if p_reason is null or v_message = '' or char_length(v_message) > 4000 then
    raise exception 'a reason and a message are needed' using errcode = 'MR422';
  end if;
  -- The message for it says the banks were asked; only true once the file was accepted.
  if p_reason = 'no_bank_offer' and r.status <> 'accepted' then
    raise exception 'no_bank_offer is only for an accepted file' using errcode = 'MR422';
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

  r := public.mortgage_transition(
    r.id, 'declined', 'staff', v_actor, '{}'::jsonb,
    jsonb_build_object('message', v_message, 'decline_reason', p_reason)
  );

  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (r.id, 'staff', v_actor, 'decision.declined',
          jsonb_build_object('reason', p_reason, 'channels', to_jsonb(p_channels),
                             'reuploads_cancelled', v_cancelled));

  insert into public.mortgage_notifications (request_id, kind, channel, created_at, next_attempt_at)
  select r.id, 'decision_declined', c, now(), now()
    from unnest(p_channels) as c;

  return r;
end;
$$;

-- Withdrawal of consent: as 0152, without the banks' links to stop.
create or replace function public.mortgage_withdraw_consent(
  p_request_id          uuid,
  p_expected_updated_at timestamptz default null
)
returns public.mortgage_requests
language plpgsql security definer set search_path = public
as $$
declare
  r          public.mortgage_requests := public.mortgage_lock(p_request_id, p_expected_updated_at);
  v_actor    uuid := public.mortgage_authorise(r, true);
  v_consents integer;
begin
  update public.mortgage_consents set withdrawn_at = now()
   where request_id = r.id and withdrawn_at is null;
  get diagnostics v_consents = row_count;
  if v_consents = 0 then
    raise exception 'no consent on file to withdraw' using errcode = 'MR409';
  end if;

  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (r.id, 'staff', v_actor, 'consent.withdrawn', '{}'::jsonb);

  -- A new version, so a page still showing the old one is told to reload.
  update public.mortgage_requests set updated_at = now() where id = r.id returning * into r;
  return r;
end;
$$;

-- The file route's log: as 0152, documents only.
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
  v_file   text := p_data ->> 'file_id';
  v_id     uuid;
begin
  if v_caller = 'authenticated' then
    if public.mortgage_role() is null or p_actor_kind <> 'staff' then
      raise exception 'not allowed' using errcode = 'MR403';
    end if;
    -- The file route is the only thing that logs through a staff session: an
    -- open or a download of one of this request's documents. Nothing else
    -- may be written in someone's name.
    if p_type not in ('document.viewed', 'document.downloaded')
    or v_file is null or v_file !~ '^[0-9a-fA-F-]{36}$'
    or not exists (
      select 1
        from public.mortgage_files f
        join public.mortgage_documents d on d.id = f.document_id
       where f.id = v_file::uuid
         and d.request_id = p_request_id
    ) then
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

-- ── Retention and erasure (0151, without the banks) ─────────────

create function public.mortgage_retention_files(p_months integer, p_limit integer default 200)
returns table (file_id uuid, storage_key text, request_id uuid)
language sql stable security definer set search_path = public
as $$
  select f.id, f.storage_key, r.id
    from public.mortgage_files f
    join public.mortgage_documents d on d.id = f.document_id
    join public.mortgage_requests r on r.id = d.request_id
   where p_months is not null and p_months > 0
     and r.closed_at is not null
     and r.closed_at < now() - make_interval(months => p_months)
     and f.state <> 'removed'
   order by r.closed_at, f.id
   limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

create function public.mortgage_retire_files(p_file_ids uuid[])
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with retired as (
    update public.mortgage_files f
       set state = 'removed', original_name = 'deleted', sha256 = null
     where f.id = any(coalesce(p_file_ids, '{}'))
       and f.state <> 'removed'
    returning f.document_id
  ), per_request as (
    select d.request_id, count(*) as files
      from retired x
      join public.mortgage_documents d on d.id = x.document_id
     group by 1
  ), logged as (
    insert into public.mortgage_events (request_id, actor_kind, type, data)
    select request_id, 'system', 'files.purged', jsonb_build_object('files', files, 'reason', 'retention')
      from per_request
    returning 1
  )
  select coalesce(sum(files), 0) into v_count from per_request;
  return v_count;
end;
$$;

create function public.mortgage_erasure_files(p_request_ids uuid[])
returns table (file_id uuid, storage_key text)
language sql stable security definer set search_path = public
as $$
  with drafts as (
    select id from public.mortgage_upload_drafts where claimed_request_id = any(coalesce(p_request_ids, '{}'))
    union
    select draft_id from public.mortgage_access_links
     where request_id = any(coalesce(p_request_ids, '{}')) and draft_id is not null
  )
  select f.id, f.storage_key
    from public.mortgage_files f
   where f.document_id in (select id from public.mortgage_documents where request_id = any(coalesce(p_request_ids, '{}')))
      or f.draft_id in (select id from drafts);
$$;

create function public.mortgage_erase_requests(p_request_ids uuid[])
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ids    uuid[];
  v_refs   text[];
  v_drafts uuid[];
  v_files  integer;
  v_events integer;
begin
  select array_agg(id order by id), array_agg(reference order by reference)
    into v_ids, v_refs
    from public.mortgage_requests
   where id = any(coalesce(p_request_ids, '{}'));
  if v_ids is null then
    return jsonb_build_object('requests', '[]'::jsonb, 'files', 0, 'events', 0);
  end if;

  select array_agg(distinct id) into v_drafts from (
    select id from public.mortgage_upload_drafts where claimed_request_id = any(v_ids)
    union
    select draft_id from public.mortgage_access_links where request_id = any(v_ids) and draft_id is not null
  ) d;

  select count(*) into v_files from public.mortgage_erasure_files(v_ids);
  select count(*) into v_events from public.mortgage_events where request_id = any(v_ids);

  -- The activity log's append-only trigger (0139) lets this transaction delete.
  perform set_config('mortgage.purge', 'on', true);

  delete from public.mortgage_files where draft_id = any(coalesce(v_drafts, '{}')) and document_id is null;
  delete from public.mortgage_requests where id = any(v_ids);
  delete from public.mortgage_upload_drafts where id = any(coalesce(v_drafts, '{}'));

  perform set_config('mortgage.purge', '', true);

  return jsonb_build_object('requests', to_jsonb(v_refs), 'files', v_files, 'events', v_events);
end;
$$;

revoke all on function public.mortgage_retention_files(integer, integer) from public, anon, authenticated;
revoke all on function public.mortgage_retire_files(uuid[]) from public, anon, authenticated;
revoke all on function public.mortgage_erasure_files(uuid[]) from public, anon, authenticated;
revoke all on function public.mortgage_erase_requests(uuid[]) from public, anon, authenticated;
grant execute on function public.mortgage_retention_files(integer, integer) to service_role;
grant execute on function public.mortgage_retire_files(uuid[]) to service_role;
grant execute on function public.mortgage_erasure_files(uuid[]) to service_role;
grant execute on function public.mortgage_erase_requests(uuid[]) to service_role;

-- ── Files already with the banks ────────────────────────────────

-- They were answered when they were sent: their clock stops then.
do $$
begin
  perform set_config('mortgage.transition', 'on', true);
  update public.mortgage_requests r
     set sla_stopped_at = coalesce(
           (select max(e.created_at) from public.mortgage_events e
             where e.request_id = r.id and e.type = 'status.changed' and e.data ->> 'to' = 'with_banks'),
           r.updated_at
         )
   where r.status = 'accepted' and r.sla_stopped_at is null;
  perform set_config('mortgage.transition', 'off', true);
end;
$$;
