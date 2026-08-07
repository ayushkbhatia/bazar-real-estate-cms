-- ═══════════════════════════════════════════════════════════════════════
-- 0079 · Put "Units & floor plans" where the design wants it
-- ═══════════════════════════════════════════════════════════════════════
--
-- `resolveSections` is authoritative for *what exists* but takes order from
-- storage, appending anything the stored document has never heard of. So on a
-- project whose page has already been edited, the new section arrives at the
-- very bottom — below the advisor banner — instead of between Named features
-- and Location. Verified on Bashayer Residences before this migration existed.
--
-- Splice the key into the saved documents directly. The ordinal trick: existing
-- entries get 10, 20, 30… and the new one gets (position of `features` × 10)+5,
-- so it lands immediately after. A document with no `features` entry yields
-- null, and `order by` puts it last — the same place it would have gone anyway.
--
-- Safe to run before the code that renders it ships: a stored section whose key
-- the registry doesn't know is dropped on read, so an older deployment ignores
-- this entirely. Re-run it if a stale editor tab strips the key back out.

update public.pages p
set blocks = (
  select jsonb_agg(spliced.elem order by spliced.ord)
  from (
    select e.value as elem, e.ordinality * 10 as ord
    from jsonb_array_elements(p.blocks) with ordinality as e(value, ordinality)
    union all
    select
      '{"key":"unit-plans","enabled":true,"values":{}}'::jsonb,
      (select f.ordinality * 10 + 5
         from jsonb_array_elements(p.blocks) with ordinality as f(value, ordinality)
        where f.value ->> 'key' = 'features'
        limit 1)
  ) as spliced
)
where p.slug like 'subpage/development/%'
  and jsonb_typeof(p.blocks) = 'array'
  and not exists (
    select 1 from jsonb_array_elements(p.blocks) as e(value)
     where e.value ->> 'key' = 'unit-plans'
  );
