-- 0180 · Buy menu: "MBZ City" spelled out as "Mohammed Bin Zayed City".
--
-- The client asked (27 Nov 2026) for the full name in the menu, as the area
-- record itself reads. 0178 added the link as "MBZ City"; the Arabic was
-- already the full name. Data only, idempotent, matched on href. Also
-- editable at /admin/navigation.

update public.megamenu_items
   set label = 'Mohammed Bin Zayed City'
 where href = '/buy/search?area=mohammed-bin-zayed-city'
   and label = 'MBZ City';
