-- 0101 — Arabic twins for the three public property strings, plus provenance.
--
-- Only the fields with a public render path are here. `advisor_note` is
-- internal and every `seo.*` key is derived from the three below, so
-- translating them would roughly double the token budget for nothing a visitor
-- ever sees.
--
-- No grant statements. `site_settings` is the one table in this schema with
-- column-level grants (0096/0097), where an ungranted column fails the *whole*
-- PostgREST select; `properties` uses table-wide grants plus RLS, so a new
-- column is readable by whoever could already read the row.
--
-- There is deliberately no job queue, no row trigger and no sweep cron. The
-- published corpus is 18 rows — 54 strings — so the durable-queue design the
-- plan carried would be more moving parts than work. Translation is driven
-- from the CMS instead. If the corpus grows an order of magnitude, the queue
-- goes in then and the columns here do not change.

alter table public.properties
  add column if not exists title_ar text,
  add column if not exists short_description_ar text,
  add column if not exists description_ar text;

comment on column public.properties.title_ar is
  'Arabic title. NULL or blank falls back to the English in place.';

-- Per-field provenance, keyed by the Arabic column name:
--
--   {"title_ar": {"source": "machine", "model": "claude-opus-5",
--                 "at": "2026-08-13T…", "src_hash": "9f2c…"}}
--
-- `source` is 'machine' | 'edited' | 'human'. `src_hash` is a hash of the
-- English text the translation was made from, which is the only way to answer
-- "has the source changed since this was translated?" — an editor fixing a
-- typo in the English title must not silently leave the Arabic looking current.
--
-- jsonb rather than columns because this is per-field metadata on a variable
-- field set, and because P7 adds more translatable columns to this same table.
alter table public.properties
  add column if not exists i18n jsonb not null default '{}'::jsonb;

comment on column public.properties.i18n is
  'Per-field translation provenance, keyed by Arabic column name. See 0101.';

-- Arabic full-text search, built but NOT wired into any query.
--
-- `properties.search_text` is `to_tsvector(''english'', …)`, so an Arabic query
-- against it matches nothing and returns zero rows — which reads as a broken
-- search box rather than an unsupported one. The column and index exist so the
-- switch is a query change and not a migration + reindex on a live table; the
-- Arabic search path ships with its own relevance work in P8.
--
-- Two constraints worth stating because both are silent failures:
--   - the two-argument `to_tsvector(regconfig, text)` is required. The
--     one-argument form is only STABLE and Postgres rejects it in a generated
--     column.
--   - `'arabic'` must exist in pg_ts_config. It does on this instance
--     (verified against the project directly); on a stock build without it
--     this statement fails loudly at apply time, which is the right outcome —
--     silently falling back to 'simple' would strip stemming with no signal.
alter table public.properties
  add column if not exists search_text_ar tsvector generated always as (
    setweight(to_tsvector('arabic', coalesce(title_ar, '')), 'A') ||
    setweight(to_tsvector('arabic', coalesce(short_description_ar, '')), 'B') ||
    setweight(to_tsvector('arabic', coalesce(reference, '')), 'B') ||
    setweight(to_tsvector('arabic', coalesce(description_ar, '')), 'C')
  ) stored;

create index if not exists properties_search_text_ar_idx
  on public.properties using gin (search_text_ar);

-- Alt text, the other machine-translation target.
--
-- It rides along here rather than waiting for its own migration because
-- lib/i18n/mt/targets.ts registers it, and a registered target with nowhere to
-- store its result is a job that fails on write instead of being caught in
-- review. targets.test.ts asserts the twin exists for every target, so the two
-- files cannot drift apart.
--
-- Worth translating despite being unglamorous: an Arabic page whose images
-- announce themselves in English makes a screen reader switch voice
-- mid-sentence, which is a worse experience than no alt text at all.
alter table public.media_assets
  add column if not exists alt_text_ar text,
  add column if not exists i18n jsonb not null default '{}'::jsonb;

comment on column public.media_assets.alt_text_ar is
  'Arabic alt text. NULL or blank falls back to the English in place.';
