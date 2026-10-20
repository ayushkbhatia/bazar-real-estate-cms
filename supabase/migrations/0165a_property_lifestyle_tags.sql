-- 0165a_property_lifestyle_tags.sql
-- Lifestyle tags on a listing: the "Communities by lifestyle" cut the Areas
-- menu already makes (Waterfront, Family friendly, Luxury, Gated) plus Branded
-- residences, as a classification a property carries and a search can filter
-- on (`?lifestyle=gated`). Ticked in the property wizard and on the edit page.
--
-- A column, not a key in `flags` like the card labels (lib/card-labels.ts):
-- card labels are presentation, read only alongside the row that wears them,
-- while these are a search facet a whole results page is filtered by. A text[]
-- with a GIN index answers `lifestyle_tags @> '{gated}'` from the index, and
-- the CHECK keeps the stored values to the five a future landing page can
-- rely on.
--
-- The vocabulary is fixed in code (lib/lifestyle-tags.ts; Bazar, 19 Oct
-- 2026), so a sixth tag is a code change and a migration that widens this
-- CHECK, in the same PR. Additive: every existing row gets '{}', and nothing
-- that writes properties today (wizard, edit form, importer, Salesforce sync)
-- names the column.

alter table public.properties
  add column lifestyle_tags text[] not null default '{}'
    constraint properties_lifestyle_tags_known check (
      lifestyle_tags <@ array[
        'waterfront',
        'family_friendly',
        'luxury',
        'gated',
        'branded_residences'
      ]::text[]
    );

create index properties_lifestyle_tags_idx
  on public.properties using gin (lifestyle_tags);

comment on column public.properties.lifestyle_tags is
  'Lifestyle classification (waterfront, family_friendly, luxury, gated, branded_residences). Vocabulary in lib/lifestyle-tags.ts; filtered by ?lifestyle= on the search routes.';
