-- 0073_buy_form_nav_links.sql
--
-- Repoints the two placeholder links in the megamenu's Buy > Property Status
-- column.
--
-- 0043_buy_megamenu_restructure.sql:62 seeded "Ready Properties" and "Resale
-- Properties" both pointing at the bare /buy landing, under its own comment:
-- "No ready/resale filter exists on /buy yet, so both route to the buy index".
-- That filter now exists, so they get their own routes.
--
-- Two labels sharing one destination is also why nobody noticed for 30
-- migrations: e2e/megamenu-links.spec.ts dedupes hrefs into a Set and only
-- asserts non-404, so /buy passed for both. e2e/buy-forms.spec.ts now asserts
-- the two routes render distinct h1s, which is the assertion that would have
-- caught it.
--
-- APPLY ONLY AFTER app/(public)/buy/ready and app/(public)/buy/resale ARE
-- DEPLOYED. e2e/megamenu-links.spec.ts reads every href straight from the
-- database and asserts it does not 404, so repointing ahead of the deploy
-- turns CI red.
--
-- Applying this through the Supabase MCP does NOT run
-- revalidatePath("/", "layout") — that only fires inside the megamenu admin
-- action — so the nav will serve the old hrefs from the layout cache until the
-- next deploy or an explicit revalidation.
--
-- Matched on label within the Buy tab rather than on id: the ids are generated
-- and the labels are what 0043 seeded. Idempotent, and a no-op if an editor
-- has already repointed them by hand in /admin/megamenu.

update public.megamenu_items i
   set href = '/buy/ready'
  from public.megamenu_columns c, public.megamenu_tabs t
 where i.column_id = c.id
   and c.tab_id = t.id
   and lower(t.label) like '%buy%'
   and i.label = 'Ready Properties'
   and i.href = '/buy';

update public.megamenu_items i
   set href = '/buy/resale'
  from public.megamenu_columns c, public.megamenu_tabs t
 where i.column_id = c.id
   and c.tab_id = t.id
   and lower(t.label) like '%buy%'
   and i.label = 'Resale Properties'
   and i.href = '/buy';
