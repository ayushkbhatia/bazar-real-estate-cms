-- 0118_megamenu_buy_off_plan_to_search.sql
--
-- The Buy tab's "Off-Plan Properties" link points at the marketing landing.
-- Point it at the search facet that actually renders every off-plan listing.
--
-- WHY NOT /off-plan/search
-- Off-plan is written on two axes (see 0110). `properties.mode = 'off_plan'`
-- is the legacy transaction-mode spelling; `property_form = 'off_plan'` is the
-- completion-form spelling that 0110 backfilled and keeps in step by trigger.
-- Both are legitimate — a unit filed on the buy axis with an off-plan form is
-- exactly the combination the trigger deliberately leaves alone.
--
-- The two surfaces do not see the same rows:
--
--   /off-plan/search        mode = 'off_plan'                      → 18 of 27
--   /buy/search?form=…      mode in ('buy','off_plan')             → 27 of 27
--                             and property_form = 'off_plan'
--
-- A visitor clicking "Off-Plan Properties" under Property Status wants the
-- whole set, so the link goes to the union. `/buy/search?form=off_plan` is a
-- first-class surface, not a fallback: it carries its own search-header
-- document (`off-plan-sale`) with its own eyebrow, headline, sub-title and
-- Arabic twin, so the page reads as off-plan rather than borrowing the buy
-- umbrella's copy.
--
-- Data-only. Targets the item by its column + label so it stays correct if the
-- href was already edited in /admin/navigation, and scopes to the Buy tab so
-- the New Projects tab's own off-plan links are untouched.

update public.megamenu_items i
set href = '/buy/search?form=off_plan'
from public.megamenu_columns c
join public.megamenu_tabs t on t.id = c.tab_id
where i.column_id = c.id
  and t.slug = 'buy'
  and c.heading = 'Property Status'
  and i.label = 'Off-Plan Properties';
