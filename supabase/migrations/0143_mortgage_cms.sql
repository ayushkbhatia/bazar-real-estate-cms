-- ───────────────────────────────────────────────────────────────
-- 0143 · Mortgage requests — the team's CMS (docs/mortgage PLAN Phase 4)
--
-- What C1, C2 and C6 need from the database, and the 24-hour promise's alarms:
--
--   · Every CMS action is a function the signed-in adviser calls through
--     their own session: claim, reassign, edit applicant, log a contact
--     attempt, book a consultation, mark it held, create a pre-approval
--     invite link. Each checks the caller's mortgage role in the database
--     (an adviser acts only on requests they own; the Head of mortgages on
--     any; an admin without a mortgage role on none — D10), takes the
--     optimistic-concurrency check, changes status only through
--     mortgage_transition(), and writes its event, all in one transaction.
--   · The notification outbox (0141) learns recipients and team kinds. A new
--     request alerts its owner and the Head of mortgages from a trigger, so
--     it rides the submit's transaction; the SLA tick raises at-risk and
--     breached alerts through mortgage_flag_sla(), once per promise.
--   · The mortgage settings (flag, assignment mode, LTV figures, holidays)
--     get functions the Head of mortgages can call, since signed-in users
--     have no write grants on the module's tables.
--   · Three `notification_kind` values for the bell.
-- ───────────────────────────────────────────────────────────────

-- ── The bell ────────────────────────────────────────────────────

alter type public.notification_kind add value if not exists 'mortgage_request';
alter type public.notification_kind add value if not exists 'mortgage_at_risk';
alter type public.notification_kind add value if not exists 'mortgage_breached';

-- ── The outbox learns recipients ────────────────────────────────

alter table public.mortgage_notifications
  -- Who a team message is for; null for the applicant's own messages.
  add column recipient_staff_id uuid references public.staff(user_id) on delete cascade,
  -- What makes one message distinct from an earlier one of the same kind: the
  -- promise it warns about, the consultation it confirms. '' when there is
  -- only ever one.
  add column dedupe text not null default '' check (char_length(dedupe) <= 100);

alter table public.mortgage_notifications
  drop constraint if exists mortgage_notifications_request_id_kind_channel_key;
create unique index mortgage_notifications_once
  on public.mortgage_notifications (
    request_id, kind, channel,
    coalesce(recipient_staff_id, '00000000-0000-0000-0000-000000000000'::uuid),
    dedupe
  );

alter table public.mortgage_notifications drop constraint mortgage_notifications_kind_check;
alter table public.mortgage_notifications add constraint mortgage_notifications_kind_check check (
  kind in (
    'applicant_received',
    'team_new_request',
    'team_at_risk',
    'team_breached',
    'consultation_booked',
    'preapproval_invite'
  )
);

-- ── Who is on the team ──────────────────────────────────────────

-- The people a team alert goes to: the owner, and every active Head of
-- mortgages. No one else, whatever their site role.
create function public.mortgage_team_recipients(p_owner uuid)
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select distinct s.user_id
    from public.staff s
   where s.status = 'active'
     and s.mortgage_role is not null
     and (s.user_id = p_owner or s.mortgage_role = 'head');
$$;

-- The caller's right to act on a request: a signed-in member of the mortgage
-- team, and — for an adviser, when `p_owner_only` — its owner. Returns the
-- caller's id. Internal: called by the functions below, not by the API.
create function public.mortgage_authorise(p_request public.mortgage_requests, p_owner_only boolean default true)
returns uuid
language plpgsql stable security definer set search_path = public
as $$
declare
  v_role public.mortgage_team_role := public.mortgage_role();
begin
  if public.mortgage_caller() <> 'authenticated' or v_role is null then
    raise exception 'not allowed' using errcode = 'MR403';
  end if;
  if p_owner_only and v_role = 'adviser' and p_request.owner_staff_id is distinct from auth.uid() then
    raise exception 'only the owner or the Head of mortgages can do this' using errcode = 'MR403';
  end if;
  return auth.uid();
end;
$$;

create function public.mortgage_lock(p_request_id uuid, p_expected_updated_at timestamptz)
returns public.mortgage_requests
language plpgsql security definer set search_path = public
as $$
declare
  r public.mortgage_requests;
begin
  select * into r from public.mortgage_requests where id = p_request_id for update;
  if not found then
    raise exception 'mortgage request not found' using errcode = 'MR404';
  end if;
  if p_expected_updated_at is not null and r.updated_at is distinct from p_expected_updated_at then
    raise exception 'the request changed since it was loaded' using errcode = 'MR409';
  end if;
  return r;
end;
$$;

revoke all on function public.mortgage_team_recipients(uuid) from public, anon, authenticated;
revoke all on function public.mortgage_authorise(public.mortgage_requests, boolean) from public, anon, authenticated;
revoke all on function public.mortgage_lock(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.mortgage_team_recipients(uuid) to service_role;

-- ── A new request tells the team ────────────────────────────────

-- In the submit's own transaction (SPEC §2.4: "team notified"): the bell and
-- an email for the owner and the Head of mortgages.
create function public.mortgage_requests_notify_team()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.mortgage_notifications
    (request_id, kind, channel, recipient_staff_id, created_at, next_attempt_at)
  select new.id, 'team_new_request', channel, recipient, new.created_at, new.created_at
    from public.mortgage_team_recipients(new.owner_staff_id) as recipient
   cross join unnest(array['in_app', 'email']) as channel
  on conflict do nothing;
  return new;
end;
$$;

create trigger mortgage_requests_notify_team
  after insert on public.mortgage_requests
  for each row execute function public.mortgage_requests_notify_team();

-- ── Owner ───────────────────────────────────────────────────────

-- An adviser takes an unassigned request (SPEC §2.7, claim mode).
create function public.mortgage_claim(
  p_request_id          uuid,
  p_expected_updated_at timestamptz default null
)
returns public.mortgage_requests
language plpgsql security definer set search_path = public
as $$
declare
  r       public.mortgage_requests := public.mortgage_lock(p_request_id, p_expected_updated_at);
  v_actor uuid := public.mortgage_authorise(r, false);
begin
  if r.owner_staff_id = v_actor then
    return r;
  end if;
  if r.owner_staff_id is not null then
    raise exception 'someone else owns this request' using errcode = 'MR409';
  end if;
  update public.mortgage_requests set owner_staff_id = v_actor, assigned_at = now()
   where id = r.id returning * into r;
  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (r.id, 'staff', v_actor, 'owner.assigned', jsonb_build_object('owner_staff_id', v_actor, 'via', 'claim'));
  return r;
end;
$$;

-- The Head of mortgages gives a request to someone on the team.
create function public.mortgage_reassign(
  p_request_id          uuid,
  p_owner               uuid,
  p_expected_updated_at timestamptz default null
)
returns public.mortgage_requests
language plpgsql security definer set search_path = public
as $$
declare
  r       public.mortgage_requests := public.mortgage_lock(p_request_id, p_expected_updated_at);
  v_actor uuid := public.mortgage_authorise(r, false);
  v_from  uuid := r.owner_staff_id;
begin
  if public.mortgage_role() <> 'head' then
    raise exception 'only the Head of mortgages can reassign' using errcode = 'MR403';
  end if;
  if not exists (
    select 1 from public.staff where user_id = p_owner and status = 'active' and mortgage_role is not null
  ) then
    raise exception 'the new owner is not on the mortgage team' using errcode = 'MR422';
  end if;
  if v_from = p_owner then
    return r;
  end if;
  update public.mortgage_requests set owner_staff_id = p_owner, assigned_at = now()
   where id = r.id returning * into r;
  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (
    r.id, 'staff', v_actor, 'owner.assigned',
    jsonb_build_object('owner_staff_id', p_owner, 'from', v_from, 'via', 'reassign')
  );
  return r;
end;
$$;

-- ── Applicant ───────────────────────────────────────────────────

-- Correct what the applicant typed. Employment type stays as submitted: it
-- decided the document set (SPEC §3). The event names the fields, not values.
create function public.mortgage_edit_applicant(
  p_request_id          uuid,
  p_full_name           text,
  p_date_of_birth       date,
  p_mobile_e164         text,
  p_email               text,
  p_residency           public.mortgage_residency,
  p_expected_updated_at timestamptz default null
)
returns public.mortgage_requests
language plpgsql security definer set search_path = public
as $$
declare
  r        public.mortgage_requests := public.mortgage_lock(p_request_id, p_expected_updated_at);
  v_actor  uuid := public.mortgage_authorise(r, true);
  v_fields text[] := array[]::text[];
begin
  -- array_append, not `||`: `text[] || 'literal'` reads the literal as an array.
  if btrim(p_full_name) is distinct from r.full_name then v_fields := array_append(v_fields, 'full_name'); end if;
  if p_date_of_birth is distinct from r.date_of_birth then v_fields := array_append(v_fields, 'date_of_birth'); end if;
  if p_mobile_e164 is distinct from r.mobile_e164 then v_fields := array_append(v_fields, 'mobile'); end if;
  if lower(btrim(p_email)) is distinct from r.email then v_fields := array_append(v_fields, 'email'); end if;
  if p_residency is distinct from r.residency then v_fields := array_append(v_fields, 'residency'); end if;
  if cardinality(v_fields) = 0 then
    return r;
  end if;
  if p_date_of_birth >= current_date then
    raise exception 'date of birth must be in the past' using errcode = 'MR422';
  end if;
  update public.mortgage_requests set
    full_name     = btrim(p_full_name),
    date_of_birth = p_date_of_birth,
    mobile_e164   = p_mobile_e164,
    email         = lower(btrim(p_email)),
    residency     = p_residency
   where id = r.id returning * into r;
  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (r.id, 'staff', v_actor, 'applicant.edited', jsonb_build_object('fields', to_jsonb(v_fields)));
  return r;
end;
$$;

-- ── Contact ─────────────────────────────────────────────────────

-- A call, WhatsApp or email to the applicant, and how it went (C6 "Log an
-- attempt"). On a consultancy request the first one moves New → Contacted and
-- sets the first-contact time, through mortgage_transition().
create function public.mortgage_log_contact(
  p_request_id          uuid,
  p_channel             public.mortgage_contact_channel,
  p_outcome             public.mortgage_contact_outcome,
  p_body                text default null,
  p_duration_seconds    integer default null,
  p_expected_updated_at timestamptz default null
)
returns public.mortgage_contact_attempts
language plpgsql security definer set search_path = public
as $$
declare
  r       public.mortgage_requests := public.mortgage_lock(p_request_id, p_expected_updated_at);
  v_actor uuid := public.mortgage_authorise(r, true);
  a       public.mortgage_contact_attempts;
begin
  if p_outcome = 'received' then
    raise exception 'inbound messages are recorded by the WhatsApp webhook' using errcode = 'MR422';
  end if;
  if char_length(coalesce(p_body, '')) > 2000 then
    raise exception 'the note is too long' using errcode = 'MR422';
  end if;
  insert into public.mortgage_contact_attempts (request_id, staff_id, channel, outcome, body, duration_seconds)
  values (r.id, v_actor, p_channel, p_outcome, nullif(btrim(coalesce(p_body, '')), ''), p_duration_seconds)
  returning * into a;

  if r.service = 'consultancy' then
    perform public.mortgage_transition(r.id, 'contact_logged', 'staff', v_actor, '{}'::jsonb,
                                       jsonb_build_object('attempt_id', a.id));
  end if;

  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (
    r.id, 'staff', v_actor, 'contact.logged',
    jsonb_build_object('attempt_id', a.id, 'channel', p_channel, 'outcome', p_outcome)
  );
  return a;
end;
$$;

-- ── Consultations ───────────────────────────────────────────────

-- Book the consultation (C6): the slot is held by the exclusion constraint
-- (0138), so two advisers booking the same one get a clean 409; the request
-- moves Contacted → Consultation booked; the invite is queued.
create function public.mortgage_book_consultation(
  p_request_id          uuid,
  p_adviser             uuid,
  p_format              public.mortgage_consult_format,
  p_starts_at           timestamptz,
  p_send_invite         boolean default true,
  p_expected_updated_at timestamptz default null
)
returns public.mortgage_consultations
language plpgsql security definer set search_path = public
as $$
declare
  r          public.mortgage_requests := public.mortgage_lock(p_request_id, p_expected_updated_at);
  v_actor    uuid := public.mortgage_authorise(r, true);
  v_minutes  integer;
  c          public.mortgage_consultations;
begin
  if r.service <> 'consultancy' then
    raise exception 'only a consultancy request is booked' using errcode = 'MR422';
  end if;
  if not exists (
    select 1 from public.staff where user_id = p_adviser and status = 'active' and mortgage_role is not null
  ) then
    raise exception 'the adviser is not on the mortgage team' using errcode = 'MR422';
  end if;
  if p_starts_at <= now() then
    raise exception 'the slot has passed' using errcode = 'MR422';
  end if;
  select consultation_minutes into v_minutes from public.mortgage_settings where id = 1;

  begin
    insert into public.mortgage_consultations
      (request_id, adviser_staff_id, format, starts_at, duration_minutes, ends_at, invite_channels, created_by)
    values (
      r.id, p_adviser, p_format, p_starts_at, v_minutes, p_starts_at + make_interval(mins => v_minutes),
      case when p_send_invite then array['email', 'whatsapp'] else array[]::text[] end,
      v_actor
    )
    returning * into c;
  exception when exclusion_violation then
    raise exception 'slot_taken' using errcode = 'MR409';
  end;

  perform public.mortgage_transition(r.id, 'consultation_booked', 'staff', v_actor, '{}'::jsonb,
                                     jsonb_build_object('consultation_id', c.id));

  if p_send_invite then
    insert into public.mortgage_notifications (request_id, kind, channel, dedupe)
    values (r.id, 'consultation_booked', 'email', c.id::text),
           (r.id, 'consultation_booked', 'whatsapp', c.id::text);
  end if;

  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (
    r.id, 'staff', v_actor, 'consultation.booked',
    jsonb_build_object(
      'consultation_id', c.id, 'adviser_staff_id', p_adviser, 'format', p_format,
      'starts_at', p_starts_at, 'invite', p_send_invite
    )
  );
  return c;
end;
$$;

-- The consultation happened: Consultation booked → Completed (PLAN Phase 4
-- "mark completed"; no-show and cancel are not designed, CMS-2).
create function public.mortgage_consultation_held(
  p_request_id          uuid,
  p_expected_updated_at timestamptz default null
)
returns public.mortgage_requests
language plpgsql security definer set search_path = public
as $$
declare
  r       public.mortgage_requests := public.mortgage_lock(p_request_id, p_expected_updated_at);
  v_actor uuid := public.mortgage_authorise(r, true);
  v_id    uuid;
begin
  update public.mortgage_consultations set status = 'held'
   where id = (
     select id from public.mortgage_consultations
      where request_id = r.id and status = 'booked'
      order by starts_at desc limit 1
   )
  returning id into v_id;
  r := public.mortgage_transition(r.id, 'consultation_held', 'staff', v_actor, '{}'::jsonb,
                                  jsonb_build_object('consultation_id', v_id));
  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (r.id, 'staff', v_actor, 'consultation.held', jsonb_build_object('consultation_id', v_id));
  return r;
end;
$$;

-- ── Pre-approval invite ─────────────────────────────────────────

-- "Send pre-approval link" (C6): one live invite per request — an earlier
-- unused one is revoked. The token is made and hashed by the caller; only
-- its hash is stored, and the link itself only ever goes to the applicant.
-- The landing page is Phase 5's.
create function public.mortgage_create_invite(
  p_request_id          uuid,
  p_token_hash          text,
  p_expires_at          timestamptz,
  p_expected_updated_at timestamptz default null
)
returns public.mortgage_access_links
language plpgsql security definer set search_path = public
as $$
declare
  r       public.mortgage_requests := public.mortgage_lock(p_request_id, p_expected_updated_at);
  v_actor uuid := public.mortgage_authorise(r, true);
  l       public.mortgage_access_links;
begin
  if r.service <> 'consultancy' then
    raise exception 'invites go from a consultancy request' using errcode = 'MR422';
  end if;
  if r.status = 'completed' then
    raise exception 'the request is closed' using errcode = 'MR422';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_expires_at <= now() then
    raise exception 'bad link' using errcode = 'MR422';
  end if;

  update public.mortgage_access_links set revoked_at = now()
   where request_id = r.id and purpose = 'preapproval_invite'
     and revoked_at is null and used_at is null;

  insert into public.mortgage_access_links (request_id, purpose, token_hash, expires_at, created_by)
  values (r.id, 'preapproval_invite', p_token_hash, p_expires_at, v_actor)
  returning * into l;

  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (r.id, 'staff', v_actor, 'invite.sent', jsonb_build_object('link_id', l.id, 'expires_at', p_expires_at));
  return l;
end;
$$;

-- ── The promise's alarms ────────────────────────────────────────

-- Called by the SLA tick (service role) when sla.ts says a running promise
-- is at risk or breached. Flags it once — `sla_*_notified_at`, which a
-- resume clears (0139) — and queues the alert for the owner and the Head of
-- mortgages. Returns whether this call raised it.
create function public.mortgage_flag_sla(
  p_request_id uuid,
  p_state      text,
  p_at         timestamptz default now()
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  r      public.mortgage_requests;
  v_kind text;
begin
  if public.mortgage_caller() not in ('service_role', 'direct') then
    raise exception 'not allowed' using errcode = 'MR403';
  end if;
  if p_state not in ('at_risk', 'breached') then
    raise exception 'unknown state %', p_state using errcode = 'MR422';
  end if;

  select * into r from public.mortgage_requests where id = p_request_id for update;
  if not found then
    raise exception 'mortgage request not found' using errcode = 'MR404';
  end if;
  if r.sla_started_at is null or r.sla_stopped_at is not null or r.sla_paused_at is not null then
    return false;
  end if;

  if p_state = 'at_risk' then
    if r.sla_risk_notified_at is not null then return false; end if;
    update public.mortgage_requests set sla_risk_notified_at = p_at where id = r.id;
    v_kind := 'team_at_risk';
  else
    if r.sla_breach_notified_at is not null then return false; end if;
    update public.mortgage_requests set sla_breach_notified_at = p_at where id = r.id;
    v_kind := 'team_breached';
  end if;

  insert into public.mortgage_notifications
    (request_id, kind, channel, recipient_staff_id, dedupe, created_at, next_attempt_at)
  select r.id, v_kind, channel, recipient, coalesce(r.sla_due_at::text, ''), p_at, p_at
    from public.mortgage_team_recipients(r.owner_staff_id) as recipient
   cross join unnest(array['in_app', 'email']) as channel
  on conflict do nothing;

  insert into public.mortgage_events (request_id, actor_kind, type, data, created_at)
  values (r.id, 'system', 'sla.' || p_state, jsonb_build_object('due_at', r.sla_due_at), p_at);
  return true;
end;
$$;

-- ── Settings ────────────────────────────────────────────────────

-- The module's settings page (not designed; IMPLEMENTATION §1.10). The Head
-- of mortgages only: an admin without a mortgage role can't open the module
-- (D10), and break-glass is granting a role, which is itself on the record.
create function public.mortgage_update_settings(
  p_flag            public.mortgage_flag,
  p_assignment_mode public.mortgage_assignment_mode,
  p_ltv_national    smallint,
  p_ltv_expat       smallint
)
returns public.mortgage_settings
language plpgsql security definer set search_path = public
as $$
declare
  s public.mortgage_settings;
begin
  if public.mortgage_caller() <> 'authenticated' or public.mortgage_role() is distinct from 'head' then
    raise exception 'only the Head of mortgages can change these' using errcode = 'MR403';
  end if;
  update public.mortgage_settings set
    flag             = p_flag,
    assignment_mode  = p_assignment_mode,
    ltv_national_pct = p_ltv_national,
    ltv_expat_pct    = p_ltv_expat,
    updated_by       = auth.uid()
   where id = 1
  returning * into s;
  return s;
end;
$$;

create function public.mortgage_set_holiday(p_day date, p_name text, p_remove boolean default false)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if public.mortgage_caller() <> 'authenticated' or public.mortgage_role() is distinct from 'head' then
    raise exception 'only the Head of mortgages can change these' using errcode = 'MR403';
  end if;
  if p_remove then
    delete from public.mortgage_holidays where day = p_day;
  else
    if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
      raise exception 'name the holiday' using errcode = 'MR422';
    end if;
    insert into public.mortgage_holidays (day, name) values (p_day, btrim(p_name))
    on conflict (day) do update set name = excluded.name;
  end if;
end;
$$;

-- ── Grants ──────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.mortgage_claim(uuid, timestamptz)',
    'public.mortgage_reassign(uuid, uuid, timestamptz)',
    'public.mortgage_edit_applicant(uuid, text, date, text, text, public.mortgage_residency, timestamptz)',
    'public.mortgage_log_contact(uuid, public.mortgage_contact_channel, public.mortgage_contact_outcome, text, integer, timestamptz)',
    'public.mortgage_book_consultation(uuid, uuid, public.mortgage_consult_format, timestamptz, boolean, timestamptz)',
    'public.mortgage_consultation_held(uuid, timestamptz)',
    'public.mortgage_create_invite(uuid, text, timestamptz, timestamptz)',
    'public.mortgage_update_settings(public.mortgage_flag, public.mortgage_assignment_mode, smallint, smallint)',
    'public.mortgage_set_holiday(date, text, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

revoke all on function public.mortgage_flag_sla(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.mortgage_flag_sla(uuid, text, timestamptz) to service_role;
