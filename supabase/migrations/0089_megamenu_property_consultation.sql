-- 0089_megamenu_property_consultation.sql
-- Point the Services megamenu's "Property Consultation" column at its own page.
--
-- The column has existed for a while but its link went to /services/manage —
-- the property-management page — so the two entries under Services led to the
-- same place and the consultation offer had no page behind it. /services/
-- consultation now exists (a registered CMS master page), so the link can go
-- where it always read as going.
--
-- APPLY AFTER DEPLOY. The route ships with the code; run this before main is
-- live and the menu points at a 404. The nav is also editable at
-- /admin/megamenu — this migration just keeps the seeded state honest for any
-- environment rebuilt from migrations.
--
-- Data-only, and matched by heading rather than by id: the columns are seeded
-- with generated ids and editors can reorder them.

do $$
declare
  v_tab uuid;
  v_column uuid;
begin
  select id into v_tab from public.megamenu_tabs where slug = 'services';
  if v_tab is null then
    raise notice 'services tab missing — nothing to repoint';
    return;
  end if;

  select id into v_column
    from public.megamenu_columns
    where tab_id = v_tab and heading = 'Property Consultation';
  if v_column is null then
    raise notice 'Property Consultation column missing — nothing to repoint';
    return;
  end if;

  update public.megamenu_items
     set href = '/services/consultation'
   where column_id = v_column
     and href = '/services/manage';
end $$;
