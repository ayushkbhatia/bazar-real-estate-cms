-- ═══════════════════════════════════════════════════════════════════════
-- 0098 · Form fields — conditional questions, range sliders, budget bands
-- ═══════════════════════════════════════════════════════════════════════
--
-- The Buy hero's brief is the first form on the site whose questions depend on
-- each other: "Property Purpose" decides whether the visitor is offered
-- apartments or retail space, and whether they are asked about bedrooms at all.
-- Until now every field on a form was asked unconditionally, so a purpose
-- selector could only ever have been faked by listing all nine property types
-- at once and hoping.
--
-- Three additions and one fix:
--
--   show_when   the answer that reveals this field. Null ⇒ always asked, which
--               is every field that exists today.
--   step / unit the increment and the prefix on a range slider — "AED" and
--               250,000 on the budget one. Editable, because the currency of a
--               boutique in Abu Dhabi is a business decision, not a constant.
--   'range'     a new field type: two handles, submitted as "min:max".
--
-- And the fix: `budget_band` has been a valid mapping in lib/forms/types.ts
-- since 0094 and is used by the off-plan registration's budget pills, but it
-- was never added to this table's check constraint. Nothing broke because no
-- editor had saved that form yet — the registry defaults render without a row.
-- The first save would have failed on a check violation. It is added here
-- alongside the range work because a range slider maps to `budget_band` too:
-- one pill and two handles produce the same "min:max" value and land in the
-- same two columns on `enquiries`.

set local search_path = public, auth, extensions;

-- ───────────────────────────────────────────────────────────────
-- show_when — the answer that reveals a field
-- ───────────────────────────────────────────────────────────────
-- `{"field": "purpose", "values": ["residential"]}` — asked only when the
-- field keyed `purpose` holds one of those values. The referenced field must
-- come earlier in the form; that ordering rule is enforced in the save schema
-- rather than here, because it is a property of the list and this row can only
-- see itself.
alter table public.form_fields
  add column if not exists show_when jsonb;

alter table public.form_fields
  drop constraint if exists form_fields_show_when_shape;

alter table public.form_fields
  add constraint form_fields_show_when_shape check (
    show_when is null or (
      jsonb_typeof(show_when) = 'object'
      and jsonb_typeof(show_when -> 'field') = 'string'
      and jsonb_typeof(show_when -> 'values') = 'array'
      and jsonb_array_length(show_when -> 'values') > 0
    )
  );

-- ───────────────────────────────────────────────────────────────
-- step / unit — range sliders only
-- ───────────────────────────────────────────────────────────────
-- `min_value` and `max_value` already carry the ends of the scale; these two
-- carry how far each drag moves and what the numbers are denominated in.
alter table public.form_fields
  add column if not exists step int;

alter table public.form_fields
  add column if not exists unit text;

alter table public.form_fields
  drop constraint if exists form_fields_step_positive;

alter table public.form_fields
  add constraint form_fields_step_positive check (step is null or step > 0);

alter table public.form_fields
  drop constraint if exists form_fields_unit_short;

alter table public.form_fields
  add constraint form_fields_unit_short check (unit is null or length(unit) <= 12);

-- ───────────────────────────────────────────────────────────────
-- type — add 'range'
-- ───────────────────────────────────────────────────────────────
alter table public.form_fields
  drop constraint if exists form_fields_type_check;

alter table public.form_fields
  add constraint form_fields_type_check check (type in (
    'text', 'email', 'tel', 'phone_dial', 'textarea',
    'select', 'chips', 'radio', 'checkbox', 'number', 'range'));

-- ───────────────────────────────────────────────────────────────
-- mapping — add the missing 'budget_band'
-- ───────────────────────────────────────────────────────────────
alter table public.form_fields
  drop constraint if exists form_fields_mapping_check;

alter table public.form_fields
  add constraint form_fields_mapping_check check (mapping in (
    'name', 'first_name', 'last_name', 'email', 'phone',
    'message', 'intent', 'timeline', 'budget_min', 'budget_max',
    'budget_band', 'development_id', 'property_id', 'consent', 'custom'));

comment on column public.form_fields.show_when is
  'The answer that reveals this field: {"field": "<earlier field key>", "values": [...]}. Null ⇒ always asked. Hidden fields are dropped from validation and from the submission, so an answer given before the visitor changed their mind is never filed.';
comment on column public.form_fields.step is
  'Range sliders only — how far one drag tick moves. Ignored by every other type.';
comment on column public.form_fields.unit is
  'Range sliders only — rendered before each number ("AED 2,500,000").';
