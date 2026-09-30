-- 0149 · Partner banks and the decision (Phase 6 of the mortgage module;
-- docs/mortgage/PLAN.md, SPEC §2.4, §4.3, §8; CMS screen C5).
--
-- An accepted file goes to the partner banks, their answers are recorded, and
-- the applicant hears back. Every function here runs through the adviser's
-- own session, so the database decides who may act: the file's owner or the
-- Head of mortgages (the partner banks themselves: the Head or an admin).
--
--   · Partner banks (`/admin/mortgages/banks`, not designed): the list lives
--     here, not in code — `mortgage_save_bank()`. D3 is open, so the list
--     starts empty in production and the Head adds the banks Bazar works with,
--     each with the inbox its packages go to.
--   · Sending (C2's "Accept application"): `mortgage_send_to_banks()` makes one
--     submission per chosen bank, each with an expiring package link of its
--     own (its hash stored, never the token), and moves the file to With banks
--     through `mortgage_transition()`, which insists on every document
--     accepted, consent on file and at least one bank. The emails carry the
--     links, so the action sends them itself; the outbox records them.
--   · The package (SPEC §8): the bank opens a page behind its link with a
--     structured summary and the documents. Every open and download is
--     written to the activity log first, as the bank. The service role reads
--     it; nothing here is callable from a browser.
--   · A reminder rotates the link — the old token was never stored, so a
--     reminder can only carry a new one.
--   · The bank's answer: amount, rate, fixed or variable and for how long,
--     valid until, and the letter, a PDF in the private bucket
--     (`mortgage_letter_presign()` makes its row; the upload route checks and
--     scans it).
--   · The decision (C5): `mortgage_pre_approve()` needs a lead offer that is
--     pre-approved, still valid and has a clean letter, and consent on file;
--     banks still deciding are withdrawn, the clock stops, and the applicant
--     is emailed from the outbox with the letter attached. Declining is 0147.

-- ── The outbox ───────────────────────────────────────────────────

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
    'decision_declined',
    -- Phase 6. The bank emails carry their package links, so the actions send
    -- them and record them here; the decision is queued and delivered.
    'bank_package',
    'bank_reminder',
    'decision_pre_approved'
  )
);

-- ── Partner banks ────────────────────────────────────────────────

-- How the activity log names a bank, as the designs do: a one-word name as
-- itself ("Mashreq"), a longer one by its code ("FAB"). Written into each
-- event, so the log keeps the name the bank had at the time.
create function public.mortgage_bank_label(b public.mortgage_partner_banks)
returns text
language sql immutable set search_path = public
as $$
  select case when position(' ' in btrim(b.name)) = 0 then btrim(b.name) else b.code end;
$$;

alter table public.mortgage_partner_banks
  add constraint mortgage_partner_banks_name_fits check (char_length(btrim(name)) between 1 and 80),
  add constraint mortgage_partner_banks_colour_fits check (
    brand_color is null or brand_color ~ '^#[0-9A-Fa-f]{6}$' or brand_color ~ '^oklch\([0-9. %/]+\)$'
  ),
  add constraint mortgage_partner_banks_inboxes_fit check (cardinality(package_emails) <= 5);

-- Add or change a bank (SPEC §7: the Head of mortgages, or an admin). A bank
-- is never deleted — its submissions keep pointing at it — only switched off.
create function public.mortgage_save_bank(
  p_id             uuid,
  p_code           text,
  p_name           text,
  p_brand_color    text,
  p_active         boolean,
  p_package_emails text[],
  p_sort_order     integer
)
returns public.mortgage_partner_banks
language plpgsql security definer set search_path = public
as $$
declare
  b        public.mortgage_partner_banks;
  v_emails text[];
  e        text;
begin
  if not (coalesce(public.mortgage_role() = 'head', false) or public.is_admin()) then
    raise exception 'not allowed' using errcode = 'MR403';
  end if;

  select coalesce(array_agg(distinct lower(btrim(x))) filter (where btrim(x) <> ''), '{}')
    into v_emails
    from unnest(coalesce(p_package_emails, '{}')) as x;
  foreach e in array v_emails loop
    if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(e) > 254 then
      raise exception 'bad package address' using errcode = 'MR422';
    end if;
  end loop;
  if coalesce(p_active, true) and cardinality(v_emails) = 0 then
    raise exception 'an active bank needs a package address' using errcode = 'MR422';
  end if;

  begin
    if p_id is null then
      insert into public.mortgage_partner_banks (code, name, brand_color, active, package_emails, sort_order)
      values (upper(btrim(p_code)), btrim(p_name), nullif(btrim(coalesce(p_brand_color, '')), ''),
              coalesce(p_active, true), v_emails, coalesce(p_sort_order, 0))
      returning * into b;
    else
      update public.mortgage_partner_banks set
        code           = upper(btrim(p_code)),
        name           = btrim(p_name),
        brand_color    = nullif(btrim(coalesce(p_brand_color, '')), ''),
        active         = coalesce(p_active, active),
        package_emails = v_emails,
        sort_order     = coalesce(p_sort_order, sort_order)
      where id = p_id
      returning * into b;
      if not found then
        raise exception 'bank not found' using errcode = 'MR404';
      end if;
    end if;
  exception
    when unique_violation then
      raise exception 'code_taken' using errcode = 'MR409';
    when check_violation or not_null_violation then
      raise exception 'bad bank' using errcode = 'MR422';
  end;
  return b;
end;
$$;

-- ── Sending the file (C2's "Accept application") ─────────────────

-- `p_packages`: one `{ bank_id, token_hash, expires_at }` per chosen bank.
-- `p_manifest`: what the package holds, kept on each submission.
create function public.mortgage_send_to_banks(
  p_request_id          uuid,
  p_packages            jsonb,
  p_manifest            jsonb,
  p_expected_updated_at timestamptz default null
)
returns public.mortgage_requests
language plpgsql security definer set search_path = public
as $$
declare
  r       public.mortgage_requests := public.mortgage_lock(p_request_id, p_expected_updated_at);
  v_actor uuid := public.mortgage_authorise(r, true);
  p       jsonb;
  bk       public.mortgage_partner_banks;
  v_codes  text[] := '{}';
  v_labels text[] := '{}';
begin
  if r.service <> 'pre_approval' or r.status <> 'in_review' then
    raise exception 'only a file in review goes to the banks' using errcode = 'MR409';
  end if;
  if jsonb_typeof(p_packages) is distinct from 'array'
  or jsonb_array_length(p_packages) = 0
  or jsonb_array_length(p_packages) > 20 then
    raise exception 'choose at least one bank' using errcode = 'MR422';
  end if;

  for p in select value from jsonb_array_elements(p_packages) loop
    select * into bk from public.mortgage_partner_banks where id = (p ->> 'bank_id')::uuid;
    if not found or not bk.active or cardinality(bk.package_emails) = 0 then
      raise exception 'bank_unavailable' using errcode = 'MR422';
    end if;
    if coalesce(p ->> 'token_hash', '') !~ '^[0-9a-f]{64}$'
    or (p ->> 'expires_at')::timestamptz <= now() then
      raise exception 'bad package link' using errcode = 'MR422';
    end if;
    insert into public.mortgage_bank_submissions
      (request_id, bank_id, status, sent_at, sent_by, package_manifest, package_token_hash, package_expires_at)
    values
      (r.id, bk.id, 'sent', now(), v_actor, coalesce(p_manifest, '{}'::jsonb),
       p ->> 'token_hash', (p ->> 'expires_at')::timestamptz);
    v_codes := v_codes || bk.code;
    v_labels := v_labels || public.mortgage_bank_label(bk);
  end loop;

  -- Every document accepted, consent on file, at least one bank (SPEC §2.4).
  r := public.mortgage_transition(r.id, 'sent_to_banks', 'staff', v_actor);

  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (r.id, 'staff', v_actor, 'bank.package_sent',
          jsonb_build_object('banks', to_jsonb(v_codes), 'labels', to_jsonb(v_labels),
                             'documents', coalesce((p_manifest ->> 'documents')::integer, 0)));
  return r;
end;
$$;

-- ── A reminder, with a fresh link ────────────────────────────────

create function public.mortgage_bank_reminder(
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

-- ── The bank's letter ────────────────────────────────────────────

-- The row for a letter about to be uploaded: a PDF of at most 10 MB, on a
-- submission of a file with the banks. The upload route presigns the storage
-- key and, once the bytes are there, checks and scans them.
create function public.mortgage_letter_presign(
  p_submission_id uuid,
  p_name          text,
  p_size_bytes    bigint
)
returns public.mortgage_files
language plpgsql security definer set search_path = public
as $$
declare
  s    public.mortgage_bank_submissions;
  r    public.mortgage_requests;
  v_id uuid := gen_random_uuid();
  f    public.mortgage_files;
begin
  select * into s from public.mortgage_bank_submissions where id = p_submission_id;
  if not found then
    raise exception 'submission not found' using errcode = 'MR404';
  end if;
  r := public.mortgage_lock(s.request_id, null);
  perform public.mortgage_authorise(r, true);
  if r.status <> 'with_banks' or s.status = 'withdrawn' then
    raise exception 'the file is no longer with the banks' using errcode = 'MR409';
  end if;
  if p_size_bytes is null or p_size_bytes <= 0 or p_size_bytes > 10485760 then
    raise exception 'too_large' using errcode = 'MR422';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'a file name is needed' using errcode = 'MR422';
  end if;

  insert into public.mortgage_files
    (id, bank_submission_id, kind, state, storage_key, original_name, mime, size_bytes, scan_status)
  values
    (v_id, s.id, null, 'pending', 'f/' || v_id, left(btrim(p_name), 200), 'application/pdf', p_size_bytes, 'pending')
  returning * into f;
  return f;
end;
$$;

-- ── The bank's answer (C5, "Record response": not designed) ──────

create function public.mortgage_record_bank_response(
  p_submission_id  uuid,
  p_status         public.mortgage_bank_sub_status,
  p_max_amount_aed numeric,
  p_rate_pct       numeric,
  p_rate_type      public.mortgage_rate_type,
  p_fixed_years    integer,
  p_valid_until    date,
  p_letter_file_id uuid,
  p_notes          text
)
returns public.mortgage_bank_submissions
language plpgsql security definer set search_path = public
as $$
declare
  s        public.mortgage_bank_submissions;
  r        public.mortgage_requests;
  v_actor  uuid;
  v_code   text;
  v_label  text;
  v_letter public.mortgage_files;
  v_today  date := (now() at time zone 'Asia/Dubai')::date;
begin
  select * into s from public.mortgage_bank_submissions where id = p_submission_id;
  if not found then
    raise exception 'submission not found' using errcode = 'MR404';
  end if;
  r := public.mortgage_lock(s.request_id, null);
  v_actor := public.mortgage_authorise(r, true);
  if r.status <> 'with_banks' or s.status = 'withdrawn' then
    raise exception 'the file is no longer with the banks' using errcode = 'MR409';
  end if;
  if p_status is null or p_status not in ('pre_approved', 'declined') then
    raise exception 'a response is pre-approved or declined' using errcode = 'MR422';
  end if;

  if p_letter_file_id is not null then
    select * into v_letter from public.mortgage_files
     where id = p_letter_file_id and bank_submission_id = s.id and state = 'active'
       and scan_status = 'clean' and mime = 'application/pdf';
    if not found then
      raise exception 'letter_not_ready' using errcode = 'MR422';
    end if;
  end if;

  if p_status = 'pre_approved' then
    if p_max_amount_aed is null or p_max_amount_aed <= 0 or p_max_amount_aed > 100000000
    or p_rate_pct is null or p_rate_pct <= 0 or p_rate_pct >= 30
    or p_rate_type is null
    or (p_rate_type = 'fixed') <> (p_fixed_years is not null)
    or (p_fixed_years is not null and p_fixed_years not between 1 and 30)
    or p_valid_until is null or p_valid_until < v_today then
      raise exception 'bad_offer' using errcode = 'MR422';
    end if;
    -- The letter is what the applicant receives: an offer without one can't be recorded.
    if v_letter.id is null and not exists (
      select 1 from public.mortgage_files
       where bank_submission_id = s.id and state = 'active' and scan_status = 'clean' and mime = 'application/pdf'
    ) then
      raise exception 'letter_not_ready' using errcode = 'MR422';
    end if;
  end if;

  update public.mortgage_bank_submissions set
    status         = p_status,
    max_amount_aed = case when p_status = 'pre_approved' then p_max_amount_aed end,
    rate_pct       = case when p_status = 'pre_approved' then p_rate_pct end,
    rate_type      = case when p_status = 'pre_approved' then p_rate_type end,
    fixed_years    = case when p_status = 'pre_approved' then p_fixed_years end,
    valid_until    = case when p_status = 'pre_approved' then p_valid_until end,
    responded_at   = now(),
    recorded_by    = v_actor,
    notes          = nullif(left(btrim(coalesce(p_notes, '')), 1000), '')
  where id = s.id
  returning * into s;

  -- A new letter replaces the one before it.
  if v_letter.id is not null then
    update public.mortgage_files set state = 'removed'
     where bank_submission_id = s.id and id <> v_letter.id and state <> 'removed';
  end if;

  select b.code, public.mortgage_bank_label(b) into v_code, v_label from public.mortgage_partner_banks b where b.id = s.bank_id;
  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (r.id, 'staff', v_actor, 'bank.response_recorded',
          jsonb_strip_nulls(jsonb_build_object(
            'bank', v_code, 'label', v_label, 'status', p_status,
            'amount', s.max_amount_aed, 'rate', s.rate_pct, 'rate_type', s.rate_type,
            'fixed_years', s.fixed_years, 'valid_until', s.valid_until,
            'letter', (select original_name from public.mortgage_files
                        where bank_submission_id = s.id and state = 'active'
                        order by uploaded_at desc limit 1))));
  return s;
end;
$$;

-- ── Pre-approve (C5's Confirm) ───────────────────────────────────

create function public.mortgage_pre_approve(
  p_request_id          uuid,
  p_lead_submission_id  uuid,
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
  s           public.mortgage_bank_submissions;
  v_code      text;
  v_label     text;
  v_withdrawn integer := 0;
begin
  if r.service <> 'pre_approval' or r.status <> 'with_banks' then
    raise exception 'only a file with the banks is pre-approved' using errcode = 'MR409';
  end if;
  if v_message = '' or char_length(v_message) > 4000 then
    raise exception 'a message is needed' using errcode = 'MR422';
  end if;
  if p_channels is null
  or not ('email' = any(p_channels))
  or not (p_channels <@ array['email', 'whatsapp']) then
    raise exception 'email always goes; whatsapp is the only other channel' using errcode = 'MR422';
  end if;

  select * into s from public.mortgage_bank_submissions
   where id = p_lead_submission_id and request_id = r.id;
  if not found or s.status <> 'pre_approved' then
    raise exception 'lead_not_pre_approved' using errcode = 'MR422';
  end if;
  if s.valid_until < (now() at time zone 'Asia/Dubai')::date then
    raise exception 'offer_expired' using errcode = 'MR422';
  end if;
  if not exists (
    select 1 from public.mortgage_files
     where bank_submission_id = s.id and state = 'active' and scan_status = 'clean' and mime = 'application/pdf'
  ) then
    raise exception 'letter_not_ready' using errcode = 'MR422';
  end if;
  if not exists (
    select 1 from public.mortgage_consents where request_id = r.id and withdrawn_at is null
  ) then
    raise exception 'no_consent' using errcode = 'MR422';
  end if;

  -- The decision is made: banks still considering the file are withdrawn.
  update public.mortgage_bank_submissions set status = 'withdrawn'
   where request_id = r.id and status = 'sent';
  get diagnostics v_withdrawn = row_count;

  r := public.mortgage_transition(
    r.id, 'pre_approved', 'staff', v_actor, '{}'::jsonb,
    jsonb_build_object('message', v_message, 'lead_bank_submission_id', s.id)
  );

  select b.code, public.mortgage_bank_label(b) into v_code, v_label from public.mortgage_partner_banks b where b.id = s.bank_id;
  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (r.id, 'staff', v_actor, 'decision.pre_approved',
          jsonb_build_object('lead', v_code, 'label', v_label, 'amount', s.max_amount_aed, 'channels', to_jsonb(p_channels),
                             'banks_withdrawn', v_withdrawn));

  insert into public.mortgage_notifications (request_id, kind, channel, created_at, next_attempt_at)
  select r.id, 'decision_pre_approved', c, now(), now()
    from unnest(p_channels) as c;

  return r;
end;
$$;

-- ── Grants ───────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.mortgage_save_bank(uuid, text, text, text, boolean, text[], integer)',
    'public.mortgage_send_to_banks(uuid, jsonb, jsonb, timestamptz)',
    'public.mortgage_bank_reminder(uuid, text, timestamptz)',
    'public.mortgage_letter_presign(uuid, text, bigint)',
    'public.mortgage_record_bank_response(uuid, public.mortgage_bank_sub_status, numeric, numeric, public.mortgage_rate_type, integer, date, uuid, text)',
    'public.mortgage_pre_approve(uuid, uuid, text, text[], timestamptz)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
