-- ═══════════════════════════════════════════════════════════════════════
-- 0090 · Split the renders gallery into interior and exterior
-- ═══════════════════════════════════════════════════════════════════════
--
-- The renders section used to hold one list, `images`. It now holds two —
-- `interior_images` and `exterior_images` — rendered side by side in the same
-- section. Everything shot so far is exterior imagery, so the stored list moves
-- there wholesale and interiors start empty, which is what the brief asked for.
--
-- Additive on purpose: `images` is left in place rather than dropped. Until the
-- code that reads the new keys is deployed, the old key is what the live page
-- renders from, so this can be applied ahead of the merge without blanking the
-- section on any project. The next save through the editor strips `images` on
-- its own — `validateSections` writes only the fields the registry declares.
--
-- Idempotent: the guard skips any document that already carries
-- `exterior_images`, so a re-run is a no-op.

update public.pages p
set blocks = (
  select jsonb_agg(
    case
      when e.value ->> 'key' = 'renders' then
        e.value
        || jsonb_build_object(
             'values',
             (case
                when jsonb_typeof(e.value -> 'values') = 'object'
                  then e.value -> 'values'
                else '{}'::jsonb
              end)
             || jsonb_build_object(
                  'exterior_images',
                  coalesce(e.value -> 'values' -> 'images', '[]'::jsonb),
                  'interior_images',
                  coalesce(e.value -> 'values' -> 'interior_images', '[]'::jsonb)
                )
           )
      else e.value
    end
    order by e.ordinality
  )
  from jsonb_array_elements(p.blocks) with ordinality as e(value, ordinality)
)
where p.slug like 'subpage/development/%'
  and jsonb_typeof(p.blocks) = 'array'
  and exists (
    select 1
      from jsonb_array_elements(p.blocks) as e(value)
     where e.value ->> 'key' = 'renders'
       and e.value -> 'values' -> 'exterior_images' is null
  );
