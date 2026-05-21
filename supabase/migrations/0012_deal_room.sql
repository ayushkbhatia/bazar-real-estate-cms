-- 0012_deal_room.sql
-- Phase 8 / Track G — the Deal Room.
--
--   deals      — the post-offer transaction file, one row per closed sale.
--                Walks the stage machine
--                  mou → deposit → noc_pending → dld_pending → transferred
--                Each stage stamp lives on the row itself so we can render the
--                full timeline without a join.
--
--   documents  — generic KYC + transaction document table.
--                Polymorphic owner (account, deal, property, development,
--                enquiry) so a passport sits on an `account`, a title deed
--                on a `property`, an MoU on a `deal`, etc.
--                Status walks
--                  uploaded → pending_review → verified | rejected | expired
--                Soft-delete via deleted_at — AML/CFT requires 7-year
--                retention for transaction docs.
--
-- RLS:
--   - deals      · staff full access. Buyers see their own deals (SELECT only).
--   - documents  · staff full access. Account sees own account-scoped docs,
--                  AND docs on deals where they're the buyer.
--
-- Storage policies for the `documents` bucket live alongside in 0012 — the
-- bucket itself + object policies are created here so the DB and storage
-- layers ship as one atomic migration. The bucket is PRIVATE (unlike
-- `media`), all access via signed URLs.

-- ── enums ───────────────────────────────────────────────────────
create type public.deal_stage as enum (
  'mou',
  'deposit',
  'noc_pending',
  'dld_pending',
  'transferred'
);

create type public.document_owner_kind as enum (
  'account',
  'deal',
  'property',
  'development',
  'enquiry'
);

create type public.document_kind as enum (
  'passport',
  'emirates_id',
  'title_deed',
  'form_a',
  'noc',
  'mou',
  'sale_contract',
  'power_of_attorney',
  'valuation_report',
  'mortgage_pre_approval'
);

create type public.document_status as enum (
  'uploaded',
  'pending_review',
  'verified',
  'rejected',
  'expired'
);

-- ── deals ───────────────────────────────────────────────────────
create table public.deals (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid not null references public.properties(id) on delete restrict,
  buyer_account_id    uuid not null references public.accounts(user_id) on delete restrict,
  seller_account_id   uuid references public.accounts(user_id) on delete set null,
  lead_agent_id       uuid references public.staff(user_id) on delete set null,
  enquiry_id          uuid references public.enquiries(id) on delete set null,
  price_aed           numeric(15, 2) not null,
  advisory_fee_aed    numeric(15, 2) not null default 0,
  commission_aed      numeric(15, 2),
  stage               public.deal_stage not null default 'mou',
  mou_signed_at       timestamptz,
  noc_obtained_at     timestamptz,
  transferred_at      timestamptz,
  notes               text,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index deals_property_idx    on public.deals (property_id);
create index deals_buyer_idx       on public.deals (buyer_account_id);
create index deals_agent_idx       on public.deals (lead_agent_id);
create index deals_enquiry_idx     on public.deals (enquiry_id) where enquiry_id is not null;
create index deals_stage_idx       on public.deals (stage);
create index deals_created_at_idx  on public.deals (created_at desc);
create index deals_deleted_at_idx  on public.deals (deleted_at) where deleted_at is null;
create trigger deals_set_updated_at before update on public.deals
  for each row execute function public.set_updated_at();

-- ── documents ───────────────────────────────────────────────────
-- `owner_kind + owner_id` is polymorphic — we don't add FKs because the
-- target table differs. Validity is enforced in app code + the storage
-- policies for the documents bucket.
create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  owner_kind      public.document_owner_kind not null,
  owner_id        uuid not null,
  kind            public.document_kind not null,
  status          public.document_status not null default 'uploaded',
  media_id        uuid references public.media_assets(id) on delete set null,
  storage_key     text,                  -- direct pointer when media_id is null
  filename        text,
  size_bytes      bigint,
  mime_type       text,
  uploaded_by     uuid references auth.users(id) on delete set null,
  verified_by     uuid references public.staff(user_id) on delete set null,
  verified_at     timestamptz,
  rejected_reason text,
  expires_at      date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index documents_owner_idx       on public.documents (owner_kind, owner_id);
create index documents_kind_idx        on public.documents (kind);
create index documents_status_idx      on public.documents (status);
create index documents_uploaded_by_idx on public.documents (uploaded_by);
create index documents_expires_idx     on public.documents (expires_at)
  where expires_at is not null and deleted_at is null;
create index documents_deleted_at_idx  on public.documents (deleted_at)
  where deleted_at is null;
create trigger documents_set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- ── helper: deal_buyer_account ───────────────────────────────────
-- Used by RLS on `documents` to let a buyer see deal-scoped docs without
-- needing a recursive policy. SECURITY DEFINER bypasses RLS on `deals`
-- (which is fine — we only return the buyer_account_id, no PII).
create or replace function public.deal_buyer_account(deal_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select buyer_account_id from public.deals where id = deal_id;
$$;
grant execute on function public.deal_buyer_account(uuid) to authenticated;

-- ── RLS — deals ─────────────────────────────────────────────────
alter table public.deals enable row level security;

drop policy if exists deals_staff_all on public.deals;
drop policy if exists deals_buyer_select on public.deals;

create policy deals_staff_all on public.deals
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy deals_buyer_select on public.deals
  for select to authenticated using (buyer_account_id = auth.uid());

-- ── RLS — documents ─────────────────────────────────────────────
alter table public.documents enable row level security;

drop policy if exists documents_staff_all on public.documents;
drop policy if exists documents_owner_account_select on public.documents;
drop policy if exists documents_owner_account_insert on public.documents;
drop policy if exists documents_owner_deal_select on public.documents;

create policy documents_staff_all on public.documents
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Account holders can SELECT their own account-scoped documents.
create policy documents_owner_account_select on public.documents
  for select to authenticated using (
    owner_kind = 'account' and owner_id = auth.uid()
  );

-- And INSERT new account-scoped documents for themselves.
create policy documents_owner_account_insert on public.documents
  for insert to authenticated with check (
    owner_kind = 'account'
    and owner_id = auth.uid()
    and uploaded_by = auth.uid()
    and verified_by is null
    and status = 'uploaded'
  );

-- Buyers can SELECT documents on deals where they're the buyer.
create policy documents_owner_deal_select on public.documents
  for select to authenticated using (
    owner_kind = 'deal'
    and public.deal_buyer_account(owner_id) = auth.uid()
  );

-- ── storage bucket ──────────────────────────────────────────────
-- PRIVATE bucket (`documents`). Unlike `media`, nothing is publicly
-- readable — every URL must be signed via the service-role on the server.
insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do update set public = excluded.public;

-- Staff full access to everything in the bucket.
drop policy if exists "documents_staff_all_select" on storage.objects;
create policy "documents_staff_all_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_staff());

drop policy if exists "documents_staff_all_insert" on storage.objects;
create policy "documents_staff_all_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_staff());

drop policy if exists "documents_staff_all_update" on storage.objects;
create policy "documents_staff_all_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'documents' and public.is_staff())
  with check (bucket_id = 'documents' and public.is_staff());

drop policy if exists "documents_staff_all_delete" on storage.objects;
create policy "documents_staff_all_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_staff());

-- Account-owner SELECT — only their own prefix accounts/<auth.uid()>/.
drop policy if exists "documents_account_own_select" on storage.objects;
create policy "documents_account_own_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'accounts'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Account-owner INSERT — same prefix.
drop policy if exists "documents_account_own_insert" on storage.objects;
create policy "documents_account_own_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'accounts'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Deal-owner SELECT — for deals/<id>/* where the user is the buyer.
drop policy if exists "documents_deal_buyer_select" on storage.objects;
create policy "documents_deal_buyer_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'deals'
    and public.deal_buyer_account(
      ((storage.foldername(name))[2])::uuid
    ) = auth.uid()
  );

-- Done.
