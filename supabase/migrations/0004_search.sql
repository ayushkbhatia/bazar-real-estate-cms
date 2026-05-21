-- 0004_search.sql
-- Postgres full-text search on properties. Stand-in for Meilisearch at
-- this scale (low hundreds of listings); swap to MS when the catalogue
-- breaks ~10k rows.
--
-- - Adds a generated `search_text` tsvector that concatenates title,
--   short_description, description, and reference with weighted ranks.
-- - GIN-indexes that column for fast lookups.
-- - No trigger needed — STORED GENERATED keeps it in sync transparently.

alter table public.properties
  add column if not exists search_text tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(short_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(reference, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored;

create index if not exists properties_search_text_idx
  on public.properties using gin (search_text);
