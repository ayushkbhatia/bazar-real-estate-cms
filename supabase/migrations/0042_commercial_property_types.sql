-- 0042_commercial_property_types.sql
-- Client hero "Commercial" search tab needs granular commercial property
-- types. property_type previously carried only a generic 'commercial'
-- (plus 'land'); add the four missing subtypes so listings can be modelled
-- and filtered properly.
--
-- Additive ADD VALUE only — no data change. Existing 'commercial' rows are
-- untouched; the new subtypes apply to future/re-tagged listings.
-- IF NOT EXISTS keeps it safely re-runnable.

alter type public.property_type add value if not exists 'office';
alter type public.property_type add value if not exists 'building';
alter type public.property_type add value if not exists 'retail';
alter type public.property_type add value if not exists 'commercial_villa';
