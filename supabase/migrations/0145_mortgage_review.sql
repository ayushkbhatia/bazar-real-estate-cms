-- ───────────────────────────────────────────────────────────────
-- 0145 · Mortgage requests — document review and the re-upload loop
--        (docs/mortgage PLAN Phase 5: C3, C4, W8 and the invite landing)
--
--   · Review (C3/C4): ticking checks, recording the pricing figures, setting
--     each statement file's period and accepting a document — one function
--     each, called through the reviewer's own session, owner or Head only.
--   · Request re-upload (C4) and cancel it (C2): the request, its secure link
--     and the pause of the 24-hour promise in one transaction, through
--     mortgage_transition(). The clock's figures come from sla.ts.
--   · The secure link (W8, SPEC §8): a code (6 digits, 10 minutes, five tries
--     per link) and then a short session whose hash is stored on the link.
--     Uploads go to a draft of the link's own, attached only when the
--     applicant sends them.
--   · Sending the re-upload: the files join the document (or replace its
--     files), the document goes back to review with its checks cleared, the
--     request leaves awaiting_applicant and the promise resumes, and the
--     owner and Head are told.
--   · The pre-approval invite (C6 → W8): the applicant's own application,
--     created with the consultancy's details and linked to it.
-- ───────────────────────────────────────────────────────────────

-- ── The link learns sessions and drafts ─────────────────────────

alter table public.mortgage_access_links
  -- The link's own upload draft, made at the first upload.
  add column draft_id           uuid references public.mortgage_upload_drafts(id) on delete set null,
  -- After the code: the session cookie's hash and when it ends.
  add column session_hash       text,
  add column session_expires_at timestamptz,
  -- Where the last code went, for W8's "verified with a code sent to …".
  add column otp_channel        text check (otp_channel is null or otp_channel in ('email', 'whatsapp'));

-- One open re-upload request per document (C4: "one link per document").
create unique index mortgage_reupload_requests_one_open
  on public.mortgage_reupload_requests (document_id)
  where fulfilled_at is null and cancelled_at is null;

-- ── The outbox and the bell ─────────────────────────────────────

alter table public.mortgage_notifications drop constraint mortgage_notifications_kind_check;
alter table public.mortgage_notifications add constraint mortgage_notifications_kind_check check (
  kind in (
    'applicant_received',
    'team_new_request',
    'team_at_risk',
    'team_breached',
    'consultation_booked',
    'preapproval_invite',
    -- Phase 5. The first two are sent by the action that makes their link or
    -- code, and recorded here; the team's alert is queued and delivered.
    'reupload_request',
    'otp_code',
    'team_reupload_received'
  )
);

alter type public.notification_kind add value if not exists 'mortgage_reupload';

-- ── Review (C3, C4) ─────────────────────────────────────────────

-- The document and its request, the request locked, the caller authorised
-- (owner or Head). Internal.
create function public.mortgage_review_target(p_document_id uuid, p_expected_updated_at timestamptz default null)
returns table (doc public.mortgage_documents, req public.mortgage_requests, actor uuid)
language plpgsql security definer set search_path = public
as $$
declare
  d public.mortgage_documents;
  r public.mortgage_requests;
begin
  select * into d from public.mortgage_documents where id = p_document_id;
  if not found then
    raise exception 'document not found' using errcode = 'MR404';
  end if;
  r := public.mortgage_lock(d.request_id, p_expected_updated_at);
  -- Re-read under the request's lock.
  select * into d from public.mortgage_documents where id = p_document_id for update;
  return query select d, r, public.mortgage_authorise(r, true);
end;
$$;

-- Checks and figures change only while the document is being reviewed.
create function public.mortgage_assert_reviewable(d public.mortgage_documents, r public.mortgage_requests)
returns void
language plpgsql stable set search_path = public
as $$
begin
  if r.status not in ('new', 'in_review', 'awaiting_applicant') then
    raise exception 'the request is past review' using errcode = 'MR409';
  end if;
  if d.state <> 'to_review' then
    raise exception 'document_not_in_review' using errcode = 'MR409';
  end if;
end;
$$;

-- Tick or untick one check (C3). The keys are checklists.ts's; the page sends
-- only those.
create function public.mortgage_set_check(p_document_id uuid, p_key text, p_value boolean)
returns public.mortgage_documents
language plpgsql security definer set search_path = public
as $$
declare
  t record;
  d public.mortgage_documents;
begin
  select * into t from public.mortgage_review_target(p_document_id);
  perform public.mortgage_assert_reviewable(t.doc, t.req);
  if p_key !~ '^[a-z][a-z_]{1,39}$' then
    raise exception 'unknown check' using errcode = 'MR422';
  end if;
  update public.mortgage_documents
     set checks = checks || jsonb_build_object(p_key, coalesce(p_value, false))
   where id = p_document_id
  returning * into d;
  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values ((t.req).id, 'staff', t.actor, 'document.check_set',
          jsonb_build_object('kind', d.kind, 'key', p_key, 'value', coalesce(p_value, false)));
  return d;
end;
$$;

-- The figures recorded for pricing (C3), merged in. Validated by the action;
-- here only their shape.
create function public.mortgage_set_recorded(p_document_id uuid, p_values jsonb)
returns public.mortgage_documents
language plpgsql security definer set search_path = public
as $$
declare
  t   record;
  d   public.mortgage_documents;
  k   text;
  v   jsonb;
begin
  select * into t from public.mortgage_review_target(p_document_id);
  perform public.mortgage_assert_reviewable(t.doc, t.req);
  if jsonb_typeof(p_values) <> 'object' or (select count(*) from jsonb_object_keys(p_values)) > 10 then
    raise exception 'bad values' using errcode = 'MR422';
  end if;
  for k, v in select * from jsonb_each(p_values) loop
    if k !~ '^[a-z][a-z_]{1,39}$'
    or jsonb_typeof(v) not in ('string', 'number', 'null')
    or char_length(v #>> '{}') > 200 then
      raise exception 'bad values' using errcode = 'MR422';
    end if;
  end loop;
  update public.mortgage_documents
     set recorded = jsonb_strip_nulls(recorded || p_values)
   where id = p_document_id
  returning * into d;
  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values ((t.req).id, 'staff', t.actor, 'document.recorded',
          jsonb_build_object('kind', d.kind, 'fields', (select jsonb_agg(key) from jsonb_object_keys(p_values) as key)));
  return d;
end;
$$;

-- The months one statement file covers (C4; SPEC §2.3). Staff enter them;
-- coverage is their union against the required months.
create function public.mortgage_set_statement_period(p_file_id uuid, p_from date, p_to date)
returns public.mortgage_files
language plpgsql security definer set search_path = public
as $$
declare
  f public.mortgage_files;
  t record;
begin
  select * into f from public.mortgage_files where id = p_file_id;
  if not found or f.document_id is null or f.state <> 'active' then
    raise exception 'file not found' using errcode = 'MR404';
  end if;
  if f.kind not in ('bank_statements_3m', 'bank_statements_12m') then
    raise exception 'only statements have a period' using errcode = 'MR422';
  end if;
  select * into t from public.mortgage_review_target(f.document_id);
  perform public.mortgage_assert_reviewable(t.doc, t.req);
  if p_from is null or p_to is null
  or p_from <> date_trunc('month', p_from)::date
  or p_to <> (date_trunc('month', p_to) + interval '1 month - 1 day')::date
  or p_to < p_from
  or p_to > p_from + interval '24 months' then
    raise exception 'bad period' using errcode = 'MR422';
  end if;
  update public.mortgage_files set period_from = p_from, period_to = p_to
   where id = p_file_id
  returning * into f;
  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values ((t.req).id, 'staff', t.actor, 'document.period_set',
          jsonb_build_object('kind', f.kind, 'file_id', f.id, 'from', p_from, 'to', p_to));
  return f;
end;
$$;

-- Accept a document (C3): every required check ticked — the action passes
-- checklists.ts's keys — and at least one clean file.
create function public.mortgage_accept_document(p_document_id uuid, p_required_checks text[])
returns public.mortgage_documents
language plpgsql security definer set search_path = public
as $$
declare
  t   record;
  d   public.mortgage_documents;
  k   text;
begin
  select * into t from public.mortgage_review_target(p_document_id);
  perform public.mortgage_assert_reviewable(t.doc, t.req);
  foreach k in array coalesce(p_required_checks, array[]::text[]) loop
    if coalesce(((t.doc).checks ->> k)::boolean, false) is not true then
      raise exception 'checks_incomplete' using errcode = 'MR422';
    end if;
  end loop;
  if not exists (
    select 1 from public.mortgage_files
     where document_id = p_document_id and state = 'active' and scan_status = 'clean'
  ) then
    raise exception 'no clean file' using errcode = 'MR422';
  end if;
  update public.mortgage_documents
     set state = 'accepted', accepted_by = t.actor, accepted_at = now()
   where id = p_document_id
  returning * into d;
  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values ((t.req).id, 'staff', t.actor, 'document.accepted', jsonb_build_object('kind', d.kind));
  return d;
end;
$$;

-- Request a re-upload (C4): the request, its secure link (only the token's
-- hash is stored; the action sends the link itself), the document flagged,
-- and the request moved to awaiting_applicant through mortgage_transition(),
-- which pauses the promise with `p_sla` from sla.ts.
create function public.mortgage_request_reupload(
  p_document_id         uuid,
  p_reason              public.mortgage_reupload_reason,
  p_message             text,
  p_channels            text[],
  p_token_hash          text,
  p_expires_at          timestamptz,
  p_sla                 jsonb default '{}'::jsonb,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  t      record;
  l      public.mortgage_access_links;
  v_id   uuid;
begin
  select * into t from public.mortgage_review_target(p_document_id, p_expected_updated_at);
  if (t.req).service <> 'pre_approval' then
    raise exception 'only a pre-approval has documents' using errcode = 'MR422';
  end if;
  perform public.mortgage_assert_reviewable(t.doc, t.req);
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_expires_at <= now() then
    raise exception 'bad link' using errcode = 'MR422';
  end if;
  if exists (
    select 1 from public.mortgage_reupload_requests
     where document_id = p_document_id and fulfilled_at is null and cancelled_at is null
  ) then
    raise exception 'a re-upload is already open for this document' using errcode = 'MR409';
  end if;

  insert into public.mortgage_access_links (request_id, purpose, document_id, token_hash, expires_at, created_by)
  values ((t.req).id, 'reupload', p_document_id, p_token_hash, p_expires_at, t.actor)
  returning * into l;

  insert into public.mortgage_reupload_requests
    (request_id, document_id, reason, message, channels, requested_by, access_link_id)
  values ((t.req).id, p_document_id, p_reason, btrim(p_message), p_channels, t.actor, l.id)
  returning id into v_id;

  update public.mortgage_documents set state = 'reupload_requested' where id = p_document_id;

  perform public.mortgage_transition((t.req).id, 'reupload_requested', 'staff', t.actor, coalesce(p_sla, '{}'::jsonb),
                                     jsonb_build_object('reupload_id', v_id));

  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values ((t.req).id, 'staff', t.actor, 'reupload.requested',
          jsonb_build_object('kind', (t.doc).kind, 'reason', p_reason, 'channels', to_jsonb(p_channels),
                             'reupload_id', v_id, 'expires_at', p_expires_at));
  return jsonb_build_object('reupload_id', v_id, 'link_id', l.id);
end;
$$;

-- Take a re-upload request back (C2): the link stops working, the document is
-- under review again, and — the last one out — the promise resumes.
create function public.mortgage_cancel_reupload(
  p_reupload_id         uuid,
  p_sla                 jsonb default '{}'::jsonb,
  p_expected_updated_at timestamptz default null
)
returns public.mortgage_requests
language plpgsql security definer set search_path = public
as $$
declare
  u public.mortgage_reupload_requests;
  t record;
  r public.mortgage_requests;
begin
  select * into u from public.mortgage_reupload_requests where id = p_reupload_id;
  if not found then
    raise exception 'not found' using errcode = 'MR404';
  end if;
  select * into t from public.mortgage_review_target(u.document_id, p_expected_updated_at);
  select * into u from public.mortgage_reupload_requests where id = p_reupload_id for update;
  if u.fulfilled_at is not null or u.cancelled_at is not null then
    raise exception 'the request is no longer open' using errcode = 'MR409';
  end if;

  update public.mortgage_reupload_requests set cancelled_at = now() where id = u.id;
  update public.mortgage_access_links set revoked_at = now(), session_hash = null
   where id = u.access_link_id and revoked_at is null;
  -- Whatever the applicant uploaded and didn't send goes at the worker's next
  -- run, not when the link would have expired.
  update public.mortgage_upload_drafts set expires_at = now()
   where id = (select draft_id from public.mortgage_access_links where id = u.access_link_id)
     and claimed_request_id is null;
  update public.mortgage_documents set state = 'to_review' where id = u.document_id;

  r := public.mortgage_transition((t.req).id, 'reupload_cancelled', 'staff', t.actor, coalesce(p_sla, '{}'::jsonb),
                                  jsonb_build_object('reupload_id', u.id));
  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values ((t.req).id, 'staff', t.actor, 'reupload.cancelled',
          jsonb_build_object('kind', (t.doc).kind, 'reupload_id', u.id));
  return r;
end;
$$;

-- ── The secure link (W8; SPEC §8) — service role only ───────────

-- Whether a link can be used at all at `p_at`.
create function public.mortgage_link_usable(l public.mortgage_access_links, p_at timestamptz)
returns boolean
language sql immutable set search_path = public
as $$
  select l.revoked_at is null and l.used_at is null and l.expires_at > p_at and l.otp_attempts < 5;
$$;

-- Store a new code's hash. At most one every `p_cooldown_seconds`; a locked,
-- used, revoked or expired link gets none.
create function public.mortgage_link_issue_code(
  p_link_id          uuid,
  p_code_hash        text,
  p_code_expires_at  timestamptz,
  p_channel          text,
  p_cooldown_seconds integer default 60,
  p_at               timestamptz default now()
)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  l public.mortgage_access_links;
begin
  if public.mortgage_caller() not in ('service_role', 'direct') then
    raise exception 'not allowed' using errcode = 'MR403';
  end if;
  select * into l from public.mortgage_access_links where id = p_link_id for update;
  if not found then
    return 'unavailable';
  end if;
  if l.otp_attempts >= 5 then
    return 'locked';
  end if;
  if not public.mortgage_link_usable(l, p_at) then
    return 'unavailable';
  end if;
  if l.otp_sent_at is not null and l.otp_sent_at > p_at - make_interval(secs => p_cooldown_seconds) then
    return 'cooldown';
  end if;
  update public.mortgage_access_links
     set otp_hash = p_code_hash, otp_expires_at = p_code_expires_at, otp_sent_at = p_at, otp_channel = p_channel
   where id = l.id;
  insert into public.mortgage_events (request_id, actor_kind, type, data, created_at)
  values (l.request_id, 'system', 'link.code_sent', jsonb_build_object('purpose', l.purpose, 'channel', p_channel), p_at);
  return 'sent';
end;
$$;

-- Check a code. Five wrong codes lock the link for good (the team sends a new
-- one); a right one starts the session.
create function public.mortgage_link_verify(
  p_link_id            uuid,
  p_code_hash          text,
  p_session_hash       text,
  p_session_expires_at timestamptz,
  p_at                 timestamptz default now()
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  l public.mortgage_access_links;
begin
  if public.mortgage_caller() not in ('service_role', 'direct') then
    raise exception 'not allowed' using errcode = 'MR403';
  end if;
  select * into l from public.mortgage_access_links where id = p_link_id for update;
  if not found then
    return jsonb_build_object('result', 'unavailable');
  end if;
  if l.otp_attempts >= 5 then
    return jsonb_build_object('result', 'locked');
  end if;
  if not public.mortgage_link_usable(l, p_at) then
    return jsonb_build_object('result', 'unavailable');
  end if;
  if l.otp_hash is null or l.otp_expires_at <= p_at then
    return jsonb_build_object('result', 'expired');
  end if;
  if l.otp_hash is distinct from p_code_hash then
    update public.mortgage_access_links set otp_attempts = otp_attempts + 1
     where id = l.id
    returning * into l;
    if l.otp_attempts >= 5 then
      update public.mortgage_access_links set otp_hash = null, session_hash = null where id = l.id;
      insert into public.mortgage_events (request_id, actor_kind, type, data, created_at)
      values (l.request_id, 'system', 'link.locked', jsonb_build_object('purpose', l.purpose), p_at);
      return jsonb_build_object('result', 'locked');
    end if;
    return jsonb_build_object('result', 'wrong', 'attempts_left', 5 - l.otp_attempts);
  end if;
  update public.mortgage_access_links
     set otp_hash = null, verified_at = p_at, session_hash = p_session_hash, session_expires_at = p_session_expires_at
   where id = l.id;
  insert into public.mortgage_events (request_id, actor_kind, type, data, created_at)
  values (l.request_id, 'applicant', 'link.verified', jsonb_build_object('purpose', l.purpose), p_at);
  return jsonb_build_object('result', 'ok');
end;
$$;

-- Send the re-upload (W8). `p_file_ids` are the files the applicant sees as
-- ready: anything else in the link's draft is retired, as at submit. For a
-- replacement (`p_replace`) the document's earlier files are retired too. The
-- storage keys of every retired file come back for the caller to delete.
create function public.mortgage_fulfil_reupload(
  p_link_id  uuid,
  p_file_ids uuid[],
  p_replace  boolean,
  p_sla      jsonb default '{}'::jsonb,
  p_at       timestamptz default now()
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  l        public.mortgage_access_links;
  u        public.mortgage_reupload_requests;
  d        public.mortgage_documents;
  r        public.mortgage_requests;
  v_ready  integer;
  v_round  integer;
  v_keys   text[] := array[]::text[];
  v_more   text[];
begin
  if public.mortgage_caller() not in ('service_role', 'direct') then
    raise exception 'not allowed' using errcode = 'MR403';
  end if;
  select * into l from public.mortgage_access_links where id = p_link_id for update;
  if not found or l.purpose <> 'reupload' or not public.mortgage_link_usable(l, p_at) or l.verified_at is null then
    raise exception 'link_unavailable' using errcode = 'MR410';
  end if;
  select * into u from public.mortgage_reupload_requests
   where access_link_id = l.id and fulfilled_at is null and cancelled_at is null
   for update;
  if not found then
    raise exception 'link_unavailable' using errcode = 'MR410';
  end if;
  select * into d from public.mortgage_documents where id = u.document_id for update;

  -- Every listed file: this link's, this document's kind, finished and clean.
  select count(*) into v_ready
    from public.mortgage_files
   where id = any(p_file_ids)
     and draft_id = l.draft_id
     and kind = d.kind
     and document_id is null
     and state = 'active'
     and scan_status = 'clean';
  if l.draft_id is null or cardinality(coalesce(p_file_ids, array[]::uuid[])) = 0
  or v_ready <> cardinality(p_file_ids) then
    raise exception 'files_not_ready' using errcode = 'MR422';
  end if;

  -- What the applicant doesn't see isn't sent.
  with retired as (
    update public.mortgage_files
       set state = 'removed'
     where draft_id = l.draft_id and document_id is null and state <> 'removed' and not (id = any(p_file_ids))
    returning storage_key
  )
  select coalesce(array_agg(storage_key), array[]::text[]) into v_more from retired;
  v_keys := v_keys || v_more;

  if p_replace then
    with superseded as (
      update public.mortgage_files
         set state = 'removed'
       where document_id = d.id and state <> 'removed'
      returning storage_key
    )
    select coalesce(array_agg(storage_key), array[]::text[]) into v_more from superseded;
    v_keys := v_keys || v_more;
  end if;

  select coalesce(max(upload_round), 0) + 1 into v_round from public.mortgage_files where document_id = d.id;
  update public.mortgage_files
     set document_id = d.id, upload_round = v_round
   where id = any(p_file_ids);

  -- Back to review, from a clean slate: the checks were about the old files.
  update public.mortgage_documents
     set state = 'to_review', checks = '{}'::jsonb, accepted_by = null, accepted_at = null
   where id = d.id;
  update public.mortgage_reupload_requests set fulfilled_at = p_at where id = u.id;
  update public.mortgage_access_links set used_at = p_at, session_hash = null where id = l.id;
  update public.mortgage_upload_drafts set claimed_request_id = l.request_id where id = l.draft_id;

  r := public.mortgage_transition(l.request_id, 'reupload_fulfilled', 'applicant', null, coalesce(p_sla, '{}'::jsonb),
                                  jsonb_build_object('reupload_id', u.id), null, p_at);

  insert into public.mortgage_events (request_id, actor_kind, type, data, created_at)
  values (l.request_id, 'applicant', 'reupload.fulfilled',
          jsonb_build_object('kind', d.kind, 'files', cardinality(p_file_ids), 'replaced', p_replace,
                             'reupload_id', u.id),
          p_at);

  insert into public.mortgage_notifications
    (request_id, kind, channel, recipient_staff_id, dedupe, created_at, next_attempt_at)
  select l.request_id, 'team_reupload_received', channel, recipient, u.id::text, p_at, p_at
    from public.mortgage_team_recipients(r.owner_staff_id) as recipient
   cross join unnest(array['in_app', 'email']) as channel
  on conflict do nothing;

  return jsonb_build_object('request_id', l.request_id, 'status', r.status, 'retired_keys', to_jsonb(v_keys));
end;
$$;

-- Apply through a pre-approval invite (C6 → W8): the applicant's own
-- application, with the consultancy's details, linked to it
-- (`parent_request_id`, SPEC §2.4), owned by the adviser who sent the link.
create function public.mortgage_submit_invite(
  p_link_id         uuid,
  p_draft_id        uuid,
  p_submission_key  uuid,
  p_consent_version text,
  p_consent_text    text,
  p_ip              inet,
  p_user_agent      text,
  p_sla_due_at      timestamptz,
  p_at              timestamptz default now()
)
returns public.mortgage_requests
language plpgsql security definer set search_path = public
as $$
declare
  l       public.mortgage_access_links;
  parent  public.mortgage_requests;
  child   public.mortgage_requests;
begin
  if public.mortgage_caller() not in ('service_role', 'direct') then
    raise exception 'not allowed' using errcode = 'MR403';
  end if;
  select * into l from public.mortgage_access_links where id = p_link_id for update;
  if not found or l.purpose <> 'preapproval_invite' or not public.mortgage_link_usable(l, p_at) or l.verified_at is null then
    raise exception 'link_unavailable' using errcode = 'MR410';
  end if;
  if l.draft_id is distinct from p_draft_id then
    raise exception 'files_not_ready' using errcode = 'MR422';
  end if;
  select * into parent from public.mortgage_requests where id = l.request_id;

  -- The adviser who sent the link keeps the applicant, when still on the
  -- team: named for this transaction, so the request is created theirs (the
  -- round robin isn't moved, and the new-request alert goes to them).
  if l.created_by is not null and exists (
    select 1 from public.staff where user_id = l.created_by and status = 'active' and mortgage_role is not null
  ) then
    perform set_config('mortgage.pinned_owner', l.created_by::text, true);
  end if;
  child := public.mortgage_create_request(
    'pre_approval', parent.full_name, parent.date_of_birth, parent.mobile_e164, parent.email,
    parent.residency, parent.employment_type, 'consult_invite', null, parent.id, p_submission_key,
    p_consent_version, p_consent_text, p_ip, p_user_agent, p_sla_due_at, p_draft_id, parent.locale, p_at
  );
  perform set_config('mortgage.pinned_owner', '', true);

  update public.mortgage_access_links set used_at = p_at, session_hash = null where id = l.id;
  insert into public.mortgage_events (request_id, actor_kind, type, data, created_at)
  values (parent.id, 'applicant', 'invite.used', jsonb_build_object('reference', child.reference), p_at);
  return child;
end;
$$;

-- ── Grants ──────────────────────────────────────────────────────

revoke all on function public.mortgage_review_target(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.mortgage_assert_reviewable(public.mortgage_documents, public.mortgage_requests) from public, anon, authenticated;
revoke all on function public.mortgage_link_usable(public.mortgage_access_links, timestamptz) from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.mortgage_set_check(uuid, text, boolean)',
    'public.mortgage_set_recorded(uuid, jsonb)',
    'public.mortgage_set_statement_period(uuid, date, date)',
    'public.mortgage_accept_document(uuid, text[])',
    'public.mortgage_request_reupload(uuid, public.mortgage_reupload_reason, text, text[], text, timestamptz, jsonb, timestamptz)',
    'public.mortgage_cancel_reupload(uuid, jsonb, timestamptz)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  foreach f in array array[
    'public.mortgage_link_issue_code(uuid, text, timestamptz, text, integer, timestamptz)',
    'public.mortgage_link_verify(uuid, text, text, timestamptz, timestamptz)',
    'public.mortgage_fulfil_reupload(uuid, uuid[], boolean, jsonb, timestamptz)',
    'public.mortgage_submit_invite(uuid, uuid, uuid, text, text, inet, text, timestamptz, timestamptz)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;
