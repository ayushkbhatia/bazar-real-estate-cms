# ADR-0001: Postgres FTS as the baseline; Meilisearch as progressive enhancement

Date: 2026-05-22 · Revised 2026-05-24
Status: Accepted
Deciders: Engineering

## Context

The original spec named Meilisearch as the search engine for the public
marketplace and the AI concierge's tool surface. Meilisearch gives us
typo-tolerance, faceted scoring, and sub-50ms response on millions of
documents.

At launch, the catalogue is in the low hundreds and growing to the low
thousands. Running Meilisearch from day one means standing up another
service to operate (deploy, back up, monitor, key-rotate), plus a
catalogue-sync job that has to stay in lockstep with Postgres.

## Decision

**Two-layer architecture, both shipped:**

1. **Postgres full-text search** is the baseline. A generated
   `search_text` tsvector column on `properties`, GIN-indexed
   ([supabase/migrations/0004_search.sql](../../supabase/migrations/0004_search.sql)).
   Query through `supabase.from('properties').textSearch(...)`.

2. **Meilisearch** was added in Sprint 12 as a progressive enhancement
   ([lib/meilisearch.ts](../../lib/meilisearch.ts),
   [app/api/cron/meilisearch-sync/route.ts](../../app/api/cron/meilisearch-sync/route.ts)).
   The daily sync cron pages published properties and indexes them; the
   admin reindex endpoint drops + rebuilds on demand. Search hits go
   through Meilisearch when `MEILISEARCH_HOST` + `MEILISEARCH_API_KEY`
   are configured, and fall back to Postgres FTS when they aren't.

The search index is **ID-only** — the caller hydrates rows from
Postgres so RLS still applies. We never return user-visible data
straight out of Meilisearch.

## Consequences

- Local dev and preview environments without Meilisearch creds run on
  FTS automatically — no extra setup to get a working `/buy` page.
- Production with Meilisearch configured gets the typo tolerance and
  faceted ranking. FTS remains the catastrophic-failure fallback.
- The sync job is now a real surface to monitor (it can fall behind,
  fail silently, or index stale rows). See ADR-0003 for the cron
  silent-failure risk; the meilisearch-sync cron sits in that same bucket.
- The ID-only contract keeps RLS as the security boundary. We can never
  accidentally leak a draft listing through search.

## When to revisit

- If Meilisearch becomes the only-correct path (e.g., the FTS fallback
  produces visibly worse results in production and we want to stop
  maintaining both branches), promote it to required and rip out FTS.
- If catalogue growth stalls and Meilisearch operational cost outpaces
  its relevance benefit, deprecate it back to FTS-only.

## Alternatives considered

- **Meilisearch only from day one.** Rejected: operational cost before
  product-market fit.
- **Postgres + pg_trgm trigrams.** Adds typo tolerance to FTS without
  a new service — would have delayed the Meilisearch decision by
  another quarter. Sprint 12 went straight to Meilisearch instead;
  pg_trgm is still on the table if Meilisearch is later deprecated.
- **Typesense / Algolia.** Similar trade-off shape; Meilisearch won on
  self-host friendliness.
