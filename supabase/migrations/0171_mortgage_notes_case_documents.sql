-- Mortgage CMS: internal notes and case documents (client, Oct 2026).
--
-- Two things the mortgage team asked for on every request's file page:
--
--   1. Internal notes — staff-only comments that the applicant's form does not
--      ask for. Append-only, like the activity log beside them.
--   2. Case documents — up to 10 files per request that the TEAM uploads (a
--      bank's offer letter, a valuation report, a signed form), each with a
--      title and a short description.
--
-- Same rules as the rest of the module (docs/mortgage/IMPLEMENTATION.md):
--
--   - Every write is a SECURITY DEFINER function called through the adviser's
--     own session. It locks the request (stale page → MR409), authorises the
--     owner or the Head (anyone else → MR403), writes a mortgage_events row,
--     and touches `updated_at` so open pages refresh over Realtime (0161).
--   - Signed-in staff can SELECT these tables (any mortgage role, as for every
--     mortgage table); nobody but the service role can write them directly.
--   - A case document's file is a `mortgage_files` row in the private
--     `mortgage-files` bucket, linked by the new `case_document_id`. The file
--     route logs every open first (mortgage_log_event, extended below), and
--     retention and erasure find these files exactly as they find applicant
--     documents (their three functions are redefined below to include them).
--
-- Forward-only. Additive except for the redefinitions, which keep every
-- existing behaviour and add the new file owner.

-- ── Internal notes ──────────────────────────────────────────────

create table public.mortgage_notes (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.mortgage_requests(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  body       text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index mortgage_notes_request_idx on public.mortgage_notes (request_id, created_at desc);

alter table public.mortgage_notes enable row level security;
revoke all on public.mortgage_notes from anon, authenticated;
grant select on public.mortgage_notes to authenticated;
grant all on public.mortgage_notes to service_role;
create policy mortgage_notes_team_read on public.mortgage_notes
  for select to authenticated
  using ((select public.mortgage_role()) is not null);

-- Add a note. The owner or the Head, as for every other action on a file.
create function public.mortgage_add_note(
  p_request_id          uuid,
  p_body                text,
  p_expected_updated_at timestamptz default null
)
returns public.mortgage_notes
language plpgsql security definer set search_path = public
as $$
declare
  r       public.mortgage_requests := public.mortgage_lock(p_request_id, p_expected_updated_at);
  v_actor uuid := public.mortgage_authorise(r, true);
  n       public.mortgage_notes;
begin
  if char_length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'the note is empty' using errcode = 'MR422';
  end if;
  if char_length(btrim(p_body)) > 4000 then
    raise exception 'the note is too long' using errcode = 'MR422';
  end if;

  insert into public.mortgage_notes (request_id, author_id, body)
  values (r.id, v_actor, btrim(p_body))
  returning * into n;

  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (r.id, 'staff', v_actor, 'note.added', jsonb_build_object('note_id', n.id));

  update public.mortgage_requests set updated_at = now() where id = r.id;
  return n;
end;
$$;

revoke all on function public.mortgage_add_note(uuid, text, timestamptz) from public, anon;
grant execute on function public.mortgage_add_note(uuid, text, timestamptz) to authenticated, service_role;

-- ── Case documents ──────────────────────────────────────────────

create table public.mortgage_case_documents (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.mortgage_requests(id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  removed_at  timestamptz,
  removed_by  uuid references auth.users(id) on delete set null
);
create index mortgage_case_documents_request_idx
  on public.mortgage_case_documents (request_id, created_at);

alter table public.mortgage_case_documents enable row level security;
revoke all on public.mortgage_case_documents from anon, authenticated;
grant select on public.mortgage_case_documents to authenticated;
grant all on public.mortgage_case_documents to service_role;
create policy mortgage_case_documents_team_read on public.mortgage_case_documents
  for select to authenticated
  using ((select public.mortgage_role()) is not null);

-- A case document's file. Cascade from the document is safe for the same
-- reason it is for applicant documents: erasure removes the bucket objects
-- (listed by mortgage_erasure_files, below) before it deletes the rows.
alter table public.mortgage_files
  add column case_document_id uuid references public.mortgage_case_documents(id) on delete cascade;
create index mortgage_files_case_document_idx on public.mortgage_files (case_document_id);

alter table public.mortgage_files drop constraint mortgage_files_owner;
alter table public.mortgage_files add constraint mortgage_files_owner check (
  num_nonnulls(draft_id, document_id, case_document_id) >= 1
);

-- Start a case document: the title, description and its (still pending) file
-- row, in one transaction. The app has already checked the declared type and
-- size; it uploads the bytes to `storage_key` through a signed URL and then
-- completes the file (mortgage_complete_case_document), which only the service
-- role may do, after re-checking the stored bytes. At most 10 live documents
-- per request.
create function public.mortgage_add_case_document(
  p_request_id          uuid,
  p_title               text,
  p_description         text,
  p_file_id             uuid,
  p_original_name       text,
  p_mime                text,
  p_size_bytes          bigint,
  p_expected_updated_at timestamptz default null
)
returns public.mortgage_case_documents
language plpgsql security definer set search_path = public
as $$
declare
  r       public.mortgage_requests := public.mortgage_lock(p_request_id, p_expected_updated_at);
  v_actor uuid := public.mortgage_authorise(r, true);
  d       public.mortgage_case_documents;
begin
  if char_length(btrim(coalesce(p_title, ''))) = 0 then
    raise exception 'the document needs a title' using errcode = 'MR422';
  end if;
  if char_length(btrim(p_title)) > 120 then
    raise exception 'the title is too long' using errcode = 'MR422';
  end if;
  if char_length(coalesce(p_description, '')) > 500 then
    raise exception 'the description is too long' using errcode = 'MR422';
  end if;
  if (select count(*) from public.mortgage_case_documents
       where request_id = r.id and removed_at is null) >= 10 then
    raise exception 'a request holds at most 10 case documents' using errcode = 'MR422';
  end if;

  insert into public.mortgage_case_documents (request_id, title, description, created_by)
  values (r.id, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''), v_actor)
  returning * into d;

  insert into public.mortgage_files (
    id, case_document_id, state, storage_key, original_name, mime, size_bytes, scan_status
  ) values (
    p_file_id, d.id, 'pending', 'f/' || p_file_id::text,
    left(coalesce(nullif(btrim(p_original_name), ''), 'document'), 200),
    p_mime, p_size_bytes, 'pending'
  );

  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (r.id, 'staff', v_actor, 'case_document.added',
          jsonb_build_object('case_document_id', d.id, 'file_id', p_file_id));

  update public.mortgage_requests set updated_at = now() where id = r.id;
  return d;
end;
$$;

revoke all on function public.mortgage_add_case_document(uuid, text, text, uuid, text, text, bigint, timestamptz) from public, anon;
grant execute on function public.mortgage_add_case_document(uuid, text, text, uuid, text, text, bigint, timestamptz) to authenticated, service_role;

-- Complete a case document's file once its stored bytes check out. Service
-- role only: the app reads the bytes back, sniffs the type, refuses encrypted
-- PDFs and hashes them before it calls this.
create function public.mortgage_complete_case_document(
  p_file_id  uuid,
  p_sha256   text,
  p_page_count integer default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_request uuid;
begin
  update public.mortgage_files f
     set state = 'active', scan_status = 'clean', sha256 = p_sha256, page_count = p_page_count
   where f.id = p_file_id and f.case_document_id is not null and f.state = 'pending'
  returning (select request_id from public.mortgage_case_documents where id = f.case_document_id)
    into v_request;
  if v_request is null then
    raise exception 'no pending case document file' using errcode = 'MR404';
  end if;
  update public.mortgage_requests set updated_at = now() where id = v_request;
end;
$$;

revoke all on function public.mortgage_complete_case_document(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.mortgage_complete_case_document(uuid, text, integer) to service_role;

-- Remove a case document: the owner or the Head. Its file is retired (state
-- `removed`, as a replaced applicant file is), never deleted here; the app
-- deletes the bucket object afterwards, and retention would anyway. The
-- document keeps its row, marked removed, so the activity log still reads.
create function public.mortgage_remove_case_document(
  p_case_document_id    uuid,
  p_expected_updated_at timestamptz default null
)
returns table (file_id uuid, storage_key text)
language plpgsql security definer set search_path = public
as $$
declare
  v_request uuid;
  r         public.mortgage_requests;
  v_actor   uuid;
begin
  select request_id into v_request
    from public.mortgage_case_documents
   where id = p_case_document_id and removed_at is null;
  if v_request is null then
    raise exception 'case document not found' using errcode = 'MR404';
  end if;
  r := public.mortgage_lock(v_request, p_expected_updated_at);
  v_actor := public.mortgage_authorise(r, true);

  update public.mortgage_case_documents
     set removed_at = now(), removed_by = v_actor
   where id = p_case_document_id;

  insert into public.mortgage_events (request_id, actor_kind, actor_id, type, data)
  values (r.id, 'staff', v_actor, 'case_document.removed',
          jsonb_build_object('case_document_id', p_case_document_id));

  update public.mortgage_requests set updated_at = now() where id = r.id;

  return query
    update public.mortgage_files f
       set state = 'removed'
     where f.case_document_id = p_case_document_id and f.state <> 'removed'
    returning f.id, f.storage_key;
end;
$$;

revoke all on function public.mortgage_remove_case_document(uuid, timestamptz) from public, anon;
grant execute on function public.mortgage_remove_case_document(uuid, timestamptz) to authenticated, service_role;

-- ── The file route's log: applicant documents and case documents ─

-- As 0156, with one change: a staff open or download may name a file of one
-- of this request's case documents as well as one of its applicant documents.
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
    if p_type not in ('document.viewed', 'document.downloaded')
    or v_file is null or v_file !~ '^[0-9a-fA-F-]{36}$'
    or not exists (
      select 1
        from public.mortgage_files f
        left join public.mortgage_documents d on d.id = f.document_id
        left join public.mortgage_case_documents c on c.id = f.case_document_id
       where f.id = v_file::uuid
         and coalesce(d.request_id, c.request_id) = p_request_id
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

-- ── Retention and erasure: case document files too ──────────────

-- Each as 0156, finding a file through its case document as well as through
-- its applicant document. Signatures unchanged, so grants carry over.

create or replace function public.mortgage_retention_files(p_months integer, p_limit integer default 200)
returns table (file_id uuid, storage_key text, request_id uuid)
language sql stable security definer set search_path = public
as $$
  select f.id, f.storage_key, r.id
    from public.mortgage_files f
    left join public.mortgage_documents d on d.id = f.document_id
    left join public.mortgage_case_documents c on c.id = f.case_document_id
    join public.mortgage_requests r on r.id = coalesce(d.request_id, c.request_id)
   where p_months is not null and p_months > 0
     and r.closed_at is not null
     and r.closed_at < now() - make_interval(months => p_months)
     and f.state <> 'removed'
   order by r.closed_at, f.id
   limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

create or replace function public.mortgage_retire_files(p_file_ids uuid[])
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
    returning f.document_id, f.case_document_id
  ), per_request as (
    select coalesce(d.request_id, c.request_id) as request_id, count(*) as files
      from retired x
      left join public.mortgage_documents d on d.id = x.document_id
      left join public.mortgage_case_documents c on c.id = x.case_document_id
     where coalesce(d.request_id, c.request_id) is not null
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

create or replace function public.mortgage_erasure_files(p_request_ids uuid[])
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
      or f.case_document_id in (select id from public.mortgage_case_documents where request_id = any(coalesce(p_request_ids, '{}')))
      or f.draft_id in (select id from drafts);
$$;
