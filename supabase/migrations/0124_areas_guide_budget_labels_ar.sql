-- 0124_areas_guide_budget_labels_ar.sql
-- The six budget chips on `areas_guide_consultation` carried their ENGLISH as
-- their Arabic.
--
-- A data fix rather than a schema one, and it needs a migration only because
-- the value lives in a stored `form_fields` row: `lib/forms/registry.ts` holds
-- the English, `lib/master-pages/arabic/master.json` holds the Arabic, and a
-- stored `label_ar` beats both. So correcting the two files — which this
-- commit also does — could not reach this row.
--
-- WHAT IT LOOKED LIKE, and why only one chip was visibly wrong:
--
--   label            label_ar (before)
--   Under AED 1M     أقل من AED 1M      <- differs from its English, so it WON
--   AED 1M – 2M      AED 1M – 2M        <- byte-identical to its English, so
--   AED 2M – 4M      AED 2M – 4M           `resolveForm` treated it as absent
--   AED 4M – 8M      AED 4M – 8M           and fell through to the store
--   AED 8M – 15M     AED 8M – 15M
--   AED 15M+         AED 15M+
--
-- Five of the six were already rendering correct Arabic off the store the
-- moment the store was fixed. The sixth was a real translation, of a phrase
-- that had kept the currency code in it, so it kept winning and kept printing
-- "أقل من AED 1M" next to five chips reading "1 – 2 مليون درهم".
--
-- `value` and `intent` are reproduced byte-for-byte: the value carries the
-- filter bounds as "min:max" (see the `budget_band` case in
-- lib/forms/submission.ts), and rewriting one would silently change what the
-- chip searches for.
--
-- Idempotent by construction — it writes a literal, so re-running sets the same
-- six labels. Scoped by form key AND field key, so it cannot touch another
-- form's budget chips.

update public.form_fields ff
set options = '[
  {"label":"Under AED 1M","value":":1000000","intent":null,"label_ar":"أقل من مليون درهم"},
  {"label":"AED 1M – 2M","value":"1000000:2000000","intent":null,"label_ar":"1 – 2 مليون درهم"},
  {"label":"AED 2M – 4M","value":"2000000:4000000","intent":null,"label_ar":"2 – 4 مليون درهم"},
  {"label":"AED 4M – 8M","value":"4000000:8000000","intent":null,"label_ar":"4 – 8 مليون درهم"},
  {"label":"AED 8M – 15M","value":"8000000:15000000","intent":null,"label_ar":"8 – 15 مليون درهم"},
  {"label":"AED 15M+","value":"15000000:","intent":null,"label_ar":"15 مليون درهم فأكثر"}
]'::jsonb,
    updated_at = now()
from public.forms f
where f.id = ff.form_id
  and f.key = 'areas_guide_consultation'
  and ff.key = 'budget';
