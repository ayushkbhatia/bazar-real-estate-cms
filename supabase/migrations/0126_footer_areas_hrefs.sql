-- Footer links: /communities -> /areas.
--
-- 0041 renamed /areas to /communities. 0054 renamed it back and rewrote every
-- megamenu href with it. 0113 then seeded the new footer CMS with the OLD
-- spelling — written from the component it replaced, which nobody had updated.
--
-- In English the mistake was invisible: next.config redirects /communities to
-- /areas, so the link worked and cost one extra hop. In Arabic it was a hard
-- 404, because a `redirects()` source has no locale segment and /ar/communities
-- matched nothing. Nine links in the Arabic footer, on every page of the site.
--
-- Both halves are being fixed: `lib/i18n/locale-redirects.ts` gives every rule
-- an /ar twin so a stale href anywhere lands somewhere real, and this puts the
-- rows themselves on the live path so they stop depending on a redirect.
--
-- Only rows still holding the seeded value are touched. An editor who has
-- already retyped one of these in /admin/footer keeps what they typed.

update public.footer_links
set href = '/areas' || substring(href from 13)
where href = '/communities'
   or href like '/communities/%';

-- The three that pointed at the index rather than a guide. 0113 sent them
-- there with a comment saying those areas had no page yet — they do now
-- (/areas/hudayriyat-island, /areas/al-ghadeer, /areas/zayed-city all serve),
-- so the link can finally be the one the label promises.
--
-- Matched on label as well as href so this cannot capture a different row an
-- editor has since pointed at the areas index on purpose.
update public.footer_links
set href = '/areas/hudayriyat-island'
where href = '/areas' and label = 'Hudayriyat Island';

update public.footer_links
set href = '/areas/al-ghadeer'
where href = '/areas' and label = 'Al Ghadeer';

update public.footer_links
set href = '/areas/zayed-city'
where href = '/areas' and label = 'Zayed City';
