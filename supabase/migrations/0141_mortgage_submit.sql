-- ───────────────────────────────────────────────────────────────
-- 0141 · Mortgage requests — the website's submit (docs/mortgage PLAN Phase 3)
--
-- What the applicant flow (W1–W7) needs from the database:
--
--   · mortgage_files.replaces, so W5/W6's Replace can keep the old file until
--     the new one has passed its checks.
--   · mortgage_create_request() takes the upload draft and attaches its files
--     in the same transaction that creates the request. An application never
--     exists without its documents, and a refused attach (a file still being
--     scanned, a document with no file) leaves no request, no reference, no
--     consent and no email behind: the applicant fixes the row and submits
--     again with the same Idempotency-Key.
--   · A notification outbox. The applicant's confirmation email is queued in
--     that same transaction, sent right after the response, and retried by
--     the mortgage-worker cron if it didn't go. A failed email is a row the
--     team can see, not a line in a log. Phase 4 adds the team's
--     notifications (new request, at risk, breached) as more kinds.
--   · The loan-to-value figures W2 shows ("Up to 85% LTV"), as settings
--     (decision D23), so the copy and the figure can't drift apart.
--   · mortgage_flow_public(), which the public pages ask before they show an
--     entry point. Visitors can't read mortgage_settings; this answers one bit.
-- ───────────────────────────────────────────────────────────────

-- ── Loan-to-value figures shown on W2 (D23) ─────────────────────

alter table public.mortgage_settings
  add column ltv_national_pct smallint not null default 85
    check (ltv_national_pct between 1 and 100),
  add column ltv_expat_pct smallint not null default 80
    check (ltv_expat_pct between 1 and 100);

-- ── Replace, on W5/W6 ───────────────────────────────────────────

-- "Replace" keeps the old file until the new one is ready (frontend
-- foundations §7.2). The new file names the ones it replaces at presign, so
-- the kind's limits don't count them, and the server retires them once the
-- new file comes out of its scan clean. A failed replace leaves them alone.
alter table public.mortgage_files
  add column replaces uuid[]
    check (replaces is null or cardinality(replaces) between 1 and 2);

-- ── Notification outbox ─────────────────────────────────────────

-- One row per message per channel. No personal data here: the address is
-- read from the request when the message is sent, so erasing a request
-- (cascade) leaves nothing behind, and an address corrected in the CMS
-- before a retry is the one used.
create table public.mortgage_notifications (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references public.mortgage_requests(id) on delete cascade,
  kind            text not null check (kind in ('applicant_received')),
  channel         text not null default 'email' check (channel in ('email', 'whatsapp', 'in_app')),
  status          text not null default 'queued'
                    check (status in ('queued', 'sending', 'sent', 'skipped', 'failed')),
  attempts        integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  claimed_at      timestamptz,
  -- A reason or provider error, never an address or a name.
  last_error      text check (last_error is null or char_length(last_error) <= 500),
  provider_id     text,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz,
  unique (request_id, kind, channel)
);
create index mortgage_notifications_pending_idx on public.mortgage_notifications (next_attempt_at)
  where status in ('queued', 'sending', 'failed');

alter table public.mortgage_notifications enable row level security;
revoke all on public.mortgage_notifications from anon, authenticated;
grant select on public.mortgage_notifications to authenticated;
-- No DELETE: the row is the record that a message went (or didn't).
grant select, insert, update on public.mortgage_notifications to service_role;
create policy mortgage_notifications_team_select on public.mortgage_notifications
  for select to authenticated using ((select public.mortgage_role()) is not null);

-- Messages due for sending, claimed so that the send right after a submit
-- and the cron's retry can't both send one message. A claim older than ten
-- minutes is a sender that died mid-send and is taken again. After five
-- attempts a message stays `failed` and is left for a person.
create function public.mortgage_claim_notifications(
  p_limit      integer default 20,
  p_request_id uuid default null,
  p_at         timestamptz default now()
)
returns setof public.mortgage_notifications
language plpgsql security definer set search_path = public
as $$
begin
  if public.mortgage_caller() not in ('service_role', 'direct') then
    raise exception 'not allowed' using errcode = 'MR403';
  end if;

  return query
  update public.mortgage_notifications n
     set status = 'sending', attempts = n.attempts + 1, claimed_at = p_at
   where n.id in (
     select c.id
       from public.mortgage_notifications c
      where (p_request_id is null or c.request_id = p_request_id)
        and c.attempts < 5
        and (
          (c.status in ('queued', 'failed') and c.next_attempt_at <= p_at)
          or (c.status = 'sending' and c.claimed_at < p_at - interval '10 minutes')
        )
      order by c.next_attempt_at
      limit greatest(p_limit, 0)
      for update skip locked
   )
  returning n.*;
end;
$$;

revoke all on function public.mortgage_claim_notifications(integer, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.mortgage_claim_notifications(integer, uuid, timestamptz)
  to service_role;

-- ── Submit: create and attach in one transaction ────────────────

-- Replaces 0139's version, which couldn't attach files. Dropped rather than
-- overloaded: two functions with the same name and defaulted arguments make
-- PostgREST's named-argument call ambiguous.
drop function public.mortgage_create_request(
  public.mortgage_service, text, date, text, text, public.mortgage_residency,
  public.mortgage_employment, public.mortgage_entry_point, text, uuid, uuid,
  text, text, inet, text, timestamptz, timestamptz
);

-- Called by POST /api/mortgage/requests with the service role, after its own
-- checks (flag, rate limit, bot check, validation, the draft's token).
-- `p_sla_due_at` comes from sla.ts. A repeated `p_submission_key` returns
-- the request it already made, without attaching or emailing twice.
create function public.mortgage_create_request(
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
  p_draft_id          uuid default null,
  p_locale            text default 'en',
  p_at                timestamptz default now()
)
returns public.mortgage_requests
language plpgsql security definer set search_path = public
as $$
declare
  r          public.mortgage_requests;
  v_owner    uuid;
  v_pinned   uuid;
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
  else
    if p_sla_due_at is not null then
      raise exception 'consultancy has no promise clock' using errcode = 'MR422';
    end if;
    if p_draft_id is not null then
      raise exception 'consultancy takes no documents' using errcode = 'MR422';
    end if;
  end if;

  if p_property_ref is not null then
    select id into v_property from public.properties where reference = p_property_ref;
  end if;

  perform set_config('mortgage.transition', 'on', true);
  begin
    -- A pre-approval applied for through an invite stays with the adviser who
    -- sent it: mortgage_submit_invite (0145) names them for its transaction,
    -- and the round robin isn't moved.
    v_pinned := nullif(current_setting('mortgage.pinned_owner', true), '')::uuid;
    if v_pinned is not null then
      v_owner := v_pinned;
    else
      v_owner := public.mortgage_next_owner();
    end if;

    insert into public.mortgage_requests (
      reference, service, status,
      full_name, date_of_birth, mobile_e164, email, residency, employment_type,
      entry_point, property_id, property_ref, parent_request_id, submission_key, locale,
      owner_staff_id, assigned_at, submitted_at,
      sla_started_at, sla_due_at, created_at
    ) values (
      public.mortgage_allocate_reference(p_at), p_service, 'new',
      btrim(p_full_name), p_date_of_birth, p_mobile_e164, lower(btrim(p_email)), p_residency, p_employment_type,
      p_entry_point, v_property, p_property_ref, p_parent_request_id, p_submission_key, coalesce(p_locale, 'en'),
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

    -- Raises files_not_ready, documents_incomplete or draft_expired, which
    -- rolls back everything above: no half-made application.
    if p_draft_id is not null then
      perform public.mortgage_attach_draft(r.id, p_draft_id, true, p_at);
    end if;
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
      jsonb_build_object('owner_staff_id', v_owner, 'via', case when v_pinned is not null then 'invite' else 'round_robin' end),
      p_at
    );
  end if;

  -- The confirmation email (SPEC §6), sent after the response.
  insert into public.mortgage_notifications (request_id, kind, channel, created_at, next_attempt_at)
  values (r.id, 'applicant_received', 'email', p_at, p_at);

  return r;
end;
$$;

revoke all on function public.mortgage_create_request(
  public.mortgage_service, text, date, text, text, public.mortgage_residency,
  public.mortgage_employment, public.mortgage_entry_point, text, uuid, uuid,
  text, text, inet, text, timestamptz, uuid, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.mortgage_create_request(
  public.mortgage_service, text, date, text, text, public.mortgage_residency,
  public.mortgage_employment, public.mortgage_entry_point, text, uuid, uuid,
  text, text, inet, text, timestamptz, uuid, text, timestamptz
) to service_role;

-- ── Is the flow open to the public? ─────────────────────────────

-- The home page, the calculator and listing pages show their "Get
-- pre-approval" entry points only when the flag is `public` (SPEC §4.1).
-- They render with the anonymous client, which can't read
-- mortgage_settings, and shouldn't: this answers the one question they have.
create function public.mortgage_flow_public()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select flag = 'public' from public.mortgage_settings where id = 1), false);
$$;

revoke all on function public.mortgage_flow_public() from public;
grant execute on function public.mortgage_flow_public() to anon, authenticated, service_role;
