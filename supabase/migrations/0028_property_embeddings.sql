-- 0028_property_embeddings.sql
-- Sprint 12 — pgvector embeddings for /concierge semantic_search.
--
-- 1024 dims matches lib/embeddings.ts EMBEDDING_DIM (voyage-3 model).
-- Indexed with ivfflat (lists=100) — appropriate for a few thousand
-- listings, swap to hnsw when the catalogue passes ~50k.

set local search_path = public, auth, extensions;

create extension if not exists vector;

create table public.property_embeddings (
  property_id  uuid primary key references public.properties(id) on delete cascade,
  embedding    vector(1024) not null,
  model        text not null default 'voyage-3',
  updated_at   timestamptz not null default now()
);

create index property_embeddings_ivfflat
  on public.property_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.property_embeddings enable row level security;

-- Public read (the concierge tool runs RLS-scoped queries that join
-- this against properties; the embedding itself isn't sensitive).
drop policy if exists property_embeddings_public_read on public.property_embeddings;
create policy property_embeddings_public_read on public.property_embeddings
  for select using (true);

-- Staff/service-role write only.
drop policy if exists property_embeddings_staff_write on public.property_embeddings;
create policy property_embeddings_staff_write on public.property_embeddings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ───────────────────────────────────────────────────────────────
-- RPC: match_properties(query_embedding, match_limit)
-- ───────────────────────────────────────────────────────────────
-- Used by lib/concierge/tools.ts handleSemanticSearch when Voyage is
-- configured. Returns property_id ordered by cosine distance.
create or replace function public.match_properties(
  query_embedding vector(1024),
  match_limit int default 8
)
returns table (property_id uuid, distance float)
language sql stable
as $$
  select pe.property_id, (pe.embedding <=> query_embedding) as distance
  from public.property_embeddings pe
  join public.properties p on p.id = pe.property_id
  where p.status = 'published' and p.deleted_at is null
  order by pe.embedding <=> query_embedding
  limit match_limit;
$$;

grant execute on function public.match_properties(vector, int)
  to anon, authenticated, service_role;
