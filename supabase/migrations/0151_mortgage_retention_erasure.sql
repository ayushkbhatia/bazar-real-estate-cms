-- 0151 · Retention and erasure (Phase 7 of the mortgage module;
-- docs/mortgage/PLAN.md, SPEC §5 `retention.purge`, §8 DSR).
--
-- Both remove what the private bucket holds, and SQL can't delete a storage
-- object. So each is two halves: these functions say which files are due
-- and then retire or delete the rows, and the app deletes the objects in
-- between (lib/mortgage-requests/server/retention.ts, server/dsr.ts). The
-- objects go first: a row whose object is gone opens as "not found", while
-- an object whose row is gone could never be found again.
--
--   · Retention: `mortgage_settings.retention_months` after a request closes,
--     its files (the applicant's documents and the banks' letters) are
--     deleted and their rows kept as `removed`, with no name, so the file
--     still shows how many documents it had. The request itself stays. Null
--     months (the default, until compliance answers D7) means nothing is
--     ever due.
--   · Erasure (a data-subject request, from /admin/dsr): the subject's
--     requests are deleted outright, with everything that hangs off them —
--     documents, files, consents, links, bank submissions, consultations,
--     contact notes, the outbox and the activity log. The log is append-only
--     (0139); deleting it is allowed only here, inside this transaction, by
--     setting `mortgage.purge`. What the banks were already sent can't be
--     recalled, so the function returns which banks hold a package, for the
--     DSR record to say so.
--
-- All four functions are for the service role only.

-- ── Retention ────────────────────────────────────────────────────

-- The files due: every live file of a request closed more than `p_months`
-- months ago, oldest first.
create function public.mortgage_retention_files(p_months integer, p_limit integer default 200)
returns table (file_id uuid, storage_key text, request_id uuid)
language sql stable security definer set search_path = public
as $$
  select f.id, f.storage_key, r.id
    from public.mortgage_files f
    left join public.mortgage_documents d on d.id = f.document_id
    left join public.mortgage_bank_submissions s on s.id = f.bank_submission_id
    join public.mortgage_requests r on r.id = coalesce(d.request_id, s.request_id)
   where p_months is not null and p_months > 0
     and r.closed_at is not null
     and r.closed_at < now() - make_interval(months => p_months)
     and f.state <> 'removed'
   order by r.closed_at, f.id
   limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

-- Once their objects are deleted: the rows kept as removed, nameless, and one
-- `files.purged` line on each request's activity.
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
    returning f.document_id, f.bank_submission_id
  ), per_request as (
    select coalesce(d.request_id, s.request_id) as request_id, count(*) as files
      from retired x
      left join public.mortgage_documents d on d.id = x.document_id
      left join public.mortgage_bank_submissions s on s.id = x.bank_submission_id
     group by 1
  ), logged as (
    insert into public.mortgage_events (request_id, actor_kind, type, data)
    select request_id, 'system', 'files.purged', jsonb_build_object('files', files, 'reason', 'retention')
      from per_request
     where request_id is not null
    returning 1
  )
  select coalesce(sum(files), 0) into v_count from per_request;
  return v_count;
end;
$$;

-- ── Erasure ──────────────────────────────────────────────────────

-- Every file an erasure has to delete from the bucket: the requests'
-- documents, the banks' letters, and uploads waiting in the drafts their
-- secure links or their submission used (a draft only points at a request,
-- so it doesn't go with it).
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
      or f.bank_submission_id in (select id from public.mortgage_bank_submissions where request_id = any(coalesce(p_request_ids, '{}')))
      or f.draft_id in (select id from drafts);
$$;

-- Delete the requests and everything that hangs off them. Returns what went,
-- and which banks had been sent a package (it can't be recalled).
create function public.mortgage_erase_requests(p_request_ids uuid[])
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ids    uuid[];
  v_refs   text[];
  v_banks  jsonb;
  v_drafts uuid[];
  v_files  integer;
  v_events integer;
begin
  select array_agg(id order by id), array_agg(reference order by reference)
    into v_ids, v_refs
    from public.mortgage_requests
   where id = any(coalesce(p_request_ids, '{}'));
  if v_ids is null then
    return jsonb_build_object('requests', '[]'::jsonb, 'files', 0, 'events', 0, 'shared_with_banks', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'reference', r.reference,
           'bank', b.code,
           'label', public.mortgage_bank_label(b),
           'sent_at', s.sent_at,
           'status', s.status
         ) order by s.sent_at), '[]'::jsonb)
    into v_banks
    from public.mortgage_bank_submissions s
    join public.mortgage_partner_banks b on b.id = s.bank_id
    join public.mortgage_requests r on r.id = s.request_id
   where s.request_id = any(v_ids);

  select array_agg(distinct id) into v_drafts from (
    select id from public.mortgage_upload_drafts where claimed_request_id = any(v_ids)
    union
    select draft_id from public.mortgage_access_links where request_id = any(v_ids) and draft_id is not null
  ) d;

  select count(*) into v_files from public.mortgage_erasure_files(v_ids);
  select count(*) into v_events from public.mortgage_events where request_id = any(v_ids);

  -- The activity log's append-only trigger (0139) lets this transaction delete.
  perform set_config('mortgage.purge', 'on', true);

  delete from public.mortgage_files where draft_id = any(coalesce(v_drafts, '{}')) and document_id is null and bank_submission_id is null;
  delete from public.mortgage_requests where id = any(v_ids);
  delete from public.mortgage_upload_drafts where id = any(coalesce(v_drafts, '{}'));

  perform set_config('mortgage.purge', '', true);

  return jsonb_build_object(
    'requests', to_jsonb(v_refs),
    'files', v_files,
    'events', v_events,
    'shared_with_banks', v_banks
  );
end;
$$;

-- ── Grants ───────────────────────────────────────────────────────

revoke all on function public.mortgage_retention_files(integer, integer) from public, anon, authenticated;
revoke all on function public.mortgage_retire_files(uuid[]) from public, anon, authenticated;
revoke all on function public.mortgage_erasure_files(uuid[]) from public, anon, authenticated;
revoke all on function public.mortgage_erase_requests(uuid[]) from public, anon, authenticated;
grant execute on function public.mortgage_retention_files(integer, integer) to service_role;
grant execute on function public.mortgage_retire_files(uuid[]) to service_role;
grant execute on function public.mortgage_erasure_files(uuid[]) to service_role;
grant execute on function public.mortgage_erase_requests(uuid[]) to service_role;
