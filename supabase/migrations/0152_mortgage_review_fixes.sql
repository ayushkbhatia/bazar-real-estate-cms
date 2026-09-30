-- 0152 · Fixes from the security review (Phase 7, step 2 of the mortgage
-- module; docs/mortgage/SECURITY-REVIEW.md, approved 30 Sep 2026).
--
--   · SR-10: signed-in staff can no longer call `mortgage_transition()`
--     directly. Every staff action already goes through its own function
--     (decline, pre-approve, send to banks, log a contact…), which checks the
--     action's own rules and calls the transition as its owner. Called raw,
--     the transition let an owner or the Head pre-approve without a lead offer
--     or decline without a reason.
--   · SR-11: signed-in staff may log only what the file route logs — an open
--     or a download of one of that request's files — through
--     `mortgage_log_event()`. Any other event, or a file of another request,
--     is refused.
--   · SR-14: every change to `staff.mortgage_role` writes an audit row, from
--     the app or from SQL. Break-glass grants are SQL (no screen), so the SQL
--     can name its actor and reason with `mortgage.audit_actor` and
--     `mortgage.audit_note` (the runbook shows how); without them the row
--     still records the change, as the system's.
--   · SR-17, SR-22: `mortgage_withdraw_consent()` records an applicant's
--     withdrawal of consent from the CMS (owner or Head). Banks still deciding
--     are withdrawn and every package link on the file stops at once, since
--     the consent was what let them see it. `mortgage_bank_reminder()` refuses
--     a file without consent, and the package page and its downloads check it
--     too (lib/mortgage-requests/server/banks.ts).

-- ── SR-10 ────────────────────────────────────────────────────────

revoke execute on function public.mortgage_transition(
  uuid, text, public.mortgage_actor, uuid, jsonb, jsonb, timestamptz, timestamptz
) from authenticated;

-- ── SR-11 ────────────────────────────────────────────────────────

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
    -- open or a download of one of this request's files (documents or a
    -- bank's letter). Nothing else may be written in someone's name.
    if p_type not in ('document.viewed', 'document.downloaded')
    or v_file is null or v_file !~ '^[0-9a-fA-F-]{36}$'
    or not exists (
      select 1
        from public.mortgage_files f
        left join public.mortgage_documents d on d.id = f.document_id
        left join public.mortgage_bank_submissions s on s.id = f.bank_submission_id
       where f.id = v_file::uuid
         and coalesce(d.request_id, s.request_id) = p_request_id
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

-- ── SR-14 ────────────────────────────────────────────────────────

create function public.staff_mortgage_role_audit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := coalesce(auth.uid(), nullif(current_setting('mortgage.audit_actor', true), '')::uuid);
  v_note  text := nullif(current_setting('mortgage.audit_note', true), '');
begin
  if tg_op = 'INSERT' and new.mortgage_role is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.mortgage_role is not distinct from old.mortgage_role then
    return new;
  end if;
  insert into public.audit_log (actor_id, actor_kind, action, target_kind, target_id, before, after)
  values (
    v_actor,
    (case when v_actor is null then 'system' else 'user' end)::public.audit_actor_kind,
    'staff.mortgage_role_change',
    'staff',
    new.user_id,
    jsonb_build_object('mortgage_role', case when tg_op = 'UPDATE' then old.mortgage_role::text end),
    jsonb_strip_nulls(jsonb_build_object(
      'mortgage_role', new.mortgage_role::text,
      'via', case when auth.uid() is null then 'sql' else 'app' end,
      'note', v_note
    ))
  );
  return new;
end;
$$;

revoke all on function public.staff_mortgage_role_audit() from public, anon, authenticated;

create trigger staff_mortgage_role_audit
  after insert or update of mortgage_role on public.staff
  for each row execute function public.staff_mortgage_role_audit();

-- ── SR-17, SR-22 ─────────────────────────────────────────────────

-- The applicant withdrew their consent to share with partner banks. Recorded
-- by the owner or the Head; it can't be undone here (a new consent would be a
-- new application). Nothing else about the file changes: what happens next is
-- the Head's call (D20).
create function public.mortgage_withdraw_consent(
  p_request_id          uuid,
  p_expected_updated_at timestamptz default null
)
returns public.mortgage_requests
language plpgsql security definer set search_path = public
as $$
declare
  r           public.mortgage_requests := public.mortgage_lock(p_request_id, p_expected_updated_at);
  v_actor     uuid := public.mortgage_authorise(r, true);
  v_consents  integer;
  v_withdrawn integer;
  v_stopped   integer;
begin
  update public.mortgage_consents set withdrawn_at = now()
   where request_id = r.id and withdrawn_at is null;
  get diagnostics v_consents = row_count;
  if v_consents = 0 then
    raise exception 'no consent on file to withdraw' using errcode = 'MR409';
  end if;

  -- The banks: those still deciding are withdrawn, and every package link on
  -- the file stops now, whatever the bank answered.
  update public.mortgage_bank_submissions set status = 'withdrawn'
   where request_id = r.id and status = 'sent';
  get diagnostics v_withdrawn = row_count;
  update public.mortgage_bank_submissions set package_expires_at = now()
   where request_id = r.id and package_expires_at > now();
  get diagnostics v_stopped = row_count;

  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (r.id, 'staff', v_actor, 'consent.withdrawn',
          jsonb_build_object('banks_withdrawn', v_withdrawn, 'links_stopped', v_stopped));

  -- A new version, so a page still showing the old one is told to reload.
  update public.mortgage_requests set updated_at = now() where id = r.id returning * into r;
  return r;
end;
$$;

revoke all on function public.mortgage_withdraw_consent(uuid, timestamptz) from public, anon;
grant execute on function public.mortgage_withdraw_consent(uuid, timestamptz) to authenticated, service_role;

-- 0149's reminder, now refusing a file whose consent was withdrawn: a reminder
-- issues a fresh link, and consent is what lets a bank have one.
create or replace function public.mortgage_bank_reminder(
  p_submission_id uuid,
  p_token_hash    text,
  p_expires_at    timestamptz
)
returns public.mortgage_bank_submissions
language plpgsql security definer set search_path = public
as $$
declare
  s       public.mortgage_bank_submissions;
  r       public.mortgage_requests;
  v_actor uuid;
  v_code  text;
  v_label text;
begin
  select * into s from public.mortgage_bank_submissions where id = p_submission_id;
  if not found then
    raise exception 'submission not found' using errcode = 'MR404';
  end if;
  r := public.mortgage_lock(s.request_id, null);
  v_actor := public.mortgage_authorise(r, true);
  if r.status <> 'with_banks' then
    raise exception 'the file is no longer with the banks' using errcode = 'MR409';
  end if;
  if not exists (
    select 1 from public.mortgage_consents where request_id = r.id and withdrawn_at is null
  ) then
    raise exception 'no_consent' using errcode = 'MR422';
  end if;
  select * into s from public.mortgage_bank_submissions where id = p_submission_id for update;
  if s.status <> 'sent' then
    raise exception 'the bank has answered' using errcode = 'MR409';
  end if;
  -- One reminder at a time: a double click shouldn't send two.
  if s.reminder_sent_at is not null and s.reminder_sent_at > now() - interval '10 minutes' then
    raise exception 'reminded_recently' using errcode = 'MR409';
  end if;
  if coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' or p_expires_at <= now() then
    raise exception 'bad package link' using errcode = 'MR422';
  end if;

  update public.mortgage_bank_submissions set
    package_token_hash = p_token_hash,
    package_expires_at = p_expires_at,
    reminder_sent_at   = now()
  where id = s.id
  returning * into s;

  select b.code, public.mortgage_bank_label(b) into v_code, v_label from public.mortgage_partner_banks b where b.id = s.bank_id;
  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (r.id, 'staff', v_actor, 'bank.reminder_sent', jsonb_build_object('bank', v_code, 'label', v_label));
  return s;
end;
$$;
