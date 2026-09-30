-- ───────────────────────────────────────────────────────────────
-- 0140 · Mortgage requests — private file storage (docs/mortgage PLAN Phase 2)
--
-- Applicants' documents (Emirates IDs, passports, salary certificates, bank
-- statements) and banks' pre-approval letters live in one private bucket.
-- Nobody reaches it through the Storage API with their own session: there are
-- deliberately no storage.objects policies for this bucket, so only the
-- service role can read or write it, and every staff read goes through
-- /api/admin/mortgages/files/[fileId], which logs the open first (SPEC §8).
--
-- Deviations from SPEC §4.2, recorded in docs/mortgage/IMPLEMENTATION.md §1.7:
--   · Supabase Storage has no lifecycle rules, so unclaimed drafts are purged
--     by the mortgage-worker cron rather than a `drafts/` prefix rule.
--   · Signed upload URLs carry no size condition. The bucket caps any object
--     at 40 MiB (the largest file SPEC allows), and the per-kind limits are
--     checked at presign on the declared size and again at completion on the
--     stored size.
--   · Object keys are `f/{file id}`: no draft, request or reference in the
--     path, so no personal data in keys and nothing moves when a draft is
--     submitted.
--
-- The region follows the Supabase project's (decision D4 is open). If D4
-- requires UAE residency, lib/mortgage-requests/server/storage.ts swaps in an
-- S3 adapter and this bucket goes unused.
-- ───────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mortgage-files',
  'mortgage-files',
  false,
  41943040, -- 40 MiB
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public             = false,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Attaching a draft's files to a request ─────────────────────

-- At submit (Phase 3), the draft's files move onto the new request's document
-- rows by kind. A file can't be attached until it has passed its checks and
-- its malware scan (SPEC §5: "Staff can't open unscanned files"), so any file
-- still pending, uploading or infected refuses the whole attach. Files whose
-- kind isn't in the request's document set (the applicant changed employment
-- type after uploading, FE-4) are marked removed and returned, so the caller
-- deletes their objects.
create or replace function public.mortgage_attach_draft(
  p_request_id       uuid,
  p_draft_id         uuid,
  p_require_complete boolean default true,
  p_at               timestamptz default now()
)
returns uuid[]
language plpgsql security definer set search_path = public
as $$
declare
  v_draft     public.mortgage_upload_drafts;
  v_unready   integer;
  v_orphans   uuid[];
  v_missing   integer;
begin
  if public.mortgage_caller() not in ('service_role', 'direct') then
    raise exception 'not allowed' using errcode = 'MR403';
  end if;

  select * into v_draft from public.mortgage_upload_drafts where id = p_draft_id for update;
  if not found then
    raise exception 'draft not found' using errcode = 'MR404';
  end if;
  if v_draft.claimed_request_id is not null then
    raise exception 'draft already submitted' using errcode = 'MR409';
  end if;
  if v_draft.expires_at <= p_at then
    raise exception 'draft_expired' using errcode = 'MR422';
  end if;
  if not exists (select 1 from public.mortgage_requests where id = p_request_id) then
    raise exception 'mortgage request not found' using errcode = 'MR404';
  end if;

  -- Every live file must be finished and clean.
  select count(*) into v_unready
    from public.mortgage_files
   where draft_id = p_draft_id
     and state <> 'removed'
     and (state <> 'active' or scan_status <> 'clean');
  if v_unready > 0 then
    raise exception 'files_not_ready' using errcode = 'MR422';
  end if;

  -- Files for documents this request doesn't have.
  with orphaned as (
    update public.mortgage_files f
       set state = 'removed'
     where f.draft_id = p_draft_id
       and f.state = 'active'
       and not exists (
         select 1 from public.mortgage_documents d
          where d.request_id = p_request_id and d.kind = f.kind
       )
    returning f.id
  )
  select coalesce(array_agg(id), '{}') into v_orphans from orphaned;

  update public.mortgage_files f
     set document_id = d.id,
         upload_round = 0
    from public.mortgage_documents d
   where f.draft_id = p_draft_id
     and f.state = 'active'
     and d.request_id = p_request_id
     and d.kind = f.kind;

  if p_require_complete then
    select count(*) into v_missing
      from public.mortgage_documents d
     where d.request_id = p_request_id
       and not exists (
         select 1 from public.mortgage_files f
          where f.document_id = d.id and f.state = 'active' and f.scan_status = 'clean'
       );
    if v_missing > 0 then
      raise exception 'documents_incomplete' using errcode = 'MR422';
    end if;
  end if;

  update public.mortgage_upload_drafts set claimed_request_id = p_request_id where id = p_draft_id;

  return v_orphans;
end;
$$;

revoke all on function public.mortgage_attach_draft(uuid, uuid, boolean, timestamptz)
  from public, anon, authenticated;
grant execute on function public.mortgage_attach_draft(uuid, uuid, boolean, timestamptz)
  to service_role;
