-- Fix pre-existing dead megamenu links (main was already red on
-- e2e/megamenu-links). Four items pointed at entity detail pages that aren't
-- seeded in the DB, so they 404'd:
--   /communities/hudayriyat-island  (no such area row)
--   /developers/radiant-real-estate | /developers/ohana-development | /developers/taraf
-- Repoint to valid destinations. Follow-up: seed those entities and restore the
-- direct detail links. Idempotent — the rewritten hrefs no longer match.
update public.megamenu_items
  set href = '/off-plan/search?area=hudayriyat-island'
  where href = '/communities/hudayriyat-island';

update public.megamenu_items
  set href = '/developers'
  where href in (
    '/developers/radiant-real-estate',
    '/developers/ohana-development',
    '/developers/taraf'
  );
