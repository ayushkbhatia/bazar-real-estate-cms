-- 0048_services_megamenu_icons.sql
-- Icons for the Services "lead magnet" cards. The panel maps these strings to
-- lucide icons (see CARD_ICONS in megamenu-panel.tsx); data-driven so the
-- mapping isn't hardcoded per tab. Keyed on the service column heading.

update public.megamenu_items i
set icon = case c.heading
  when 'Buy a Property'      then 'search'
  when 'Sell Your Property'  then 'tag'
  when 'Rent a Property'     then 'key-round'
  when 'List Your Property'  then 'clipboard-list'
  when 'Property Management' then 'building-2'
  when 'Mortgage Support'    then 'landmark'
  else i.icon
end
from public.megamenu_columns c
where i.column_id = c.id
  and c.tab_id = (select id from public.megamenu_tabs where slug = 'services');
