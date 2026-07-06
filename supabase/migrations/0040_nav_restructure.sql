-- 0040_nav_restructure.sql
-- Client-directed top-nav restructure: 10 tabs -> 9 tabs, reordered.
--   Before: Buy, Sell, Rent, Commercial, New Projects, Areas, Developers,
--           Services, Insights, About
--   After:  Buy, Rent, New Projects, Areas, Developers, Services, Insights,
--           About, Contact
--   (Areas -> Communities rename lands in 0041, bundled with the route move.)
--
-- Sell + Commercial keep their pages/routes; only dropped from the top nav
-- (unpublished, not deleted) and their key links folded into Buy/Services
-- so users can still reach them.
--
-- Idempotent: every statement is keyed by slug or guarded with a
-- WHERE NOT EXISTS check, safe to re-run against a nav that may have
-- drifted via /admin/navigation since 0031.

-- ── 1. Reorder + keep published ─────────────────────────────────
update public.megamenu_tabs set position = 0 where slug = 'buy';
update public.megamenu_tabs set position = 1 where slug = 'rent';
update public.megamenu_tabs set position = 2 where slug = 'new-projects';
update public.megamenu_tabs set position = 3 where slug = 'areas';
update public.megamenu_tabs set position = 4 where slug = 'developers';
update public.megamenu_tabs set position = 5 where slug = 'services';
update public.megamenu_tabs set position = 6 where slug = 'insights';
update public.megamenu_tabs set position = 7 where slug = 'about';

-- ── 2. Drop Sell + Commercial from the nav (unpublish, keep rows) ─
update public.megamenu_tabs
set status = 'draft', published_at = null
where slug in ('sell', 'commercial');

-- ── 3. Add Contact (direct link, no panel) ──────────────────────
insert into public.megamenu_tabs
  (slug, label, href, has_panel, position, status, published_at)
values
  ('contact', 'Contact', '/contact', false, 8, 'published', now())
on conflict (slug) do update set
  label = excluded.label,
  href = excluded.href,
  has_panel = excluded.has_panel,
  position = excluded.position,
  status = excluded.status,
  published_at = coalesce(public.megamenu_tabs.published_at, excluded.published_at);

-- ── 4. Fold Sell + Commercial's key links into surviving panels ─
-- Services tab, left column 0 ("For owners & buyers") gains the two
-- links a visitor most needs from the old Sell tab.
insert into public.megamenu_items (column_id, position, label, href)
select '53040c95-835b-4fad-9f0a-c0e7fbfbed06', 5, 'Sell your property', '/services/sell'
where not exists (
  select 1 from public.megamenu_items
  where column_id = '53040c95-835b-4fad-9f0a-c0e7fbfbed06' and href = '/services/sell'
);

insert into public.megamenu_items (column_id, position, label, href)
select '53040c95-835b-4fad-9f0a-c0e7fbfbed06', 6, 'Free valuation', '/tools/valuation'
where not exists (
  select 1 from public.megamenu_items
  where column_id = '53040c95-835b-4fad-9f0a-c0e7fbfbed06' and href = '/tools/valuation'
);

-- Buy tab, left column 0 ("Resale & ready properties") gains the old
-- Commercial tab's entry point.
insert into public.megamenu_items (column_id, position, label, href)
select '9d5811d9-79b3-45e7-83e0-b405f077f639', 7, 'Commercial property', '/commercial'
where not exists (
  select 1 from public.megamenu_items
  where column_id = '9d5811d9-79b3-45e7-83e0-b405f077f639' and href = '/commercial'
);
