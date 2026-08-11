-- ═══════════════════════════════════════════════════════════════════════
-- 0094 · Forms Manager — the site's lead-capture forms, owned by the CMS
-- ═══════════════════════════════════════════════════════════════════════
--
-- Twenty lead forms were spread across the codebase: the home "List your
-- property" card, the two landing forms on Buy and Rent, the off-plan
-- registration, the brochure and floor-plan gates, the three service leads,
-- the property dialog, the newsletter box. Their field lists, their labels,
-- their buttons and their confirmations were JSX. Changing "Submit" to
-- "Request a callback" was a deploy.
--
-- Three tables, and a deliberate division of labour with `lib/forms/registry.ts`:
--
--   forms             per-form visibility, copy and notification list
--   form_fields       the ordered field list, once an editor has touched it
--   form_submissions  what visitors actually sent, whatever the form asked
--
-- The registry stays authoritative for *what forms exist* — a form is a piece
-- of a page, and a row that outlives its component is a ghost. Storage is
-- authoritative for *what an editor changed*. Both resolve at read time
-- (`lib/forms/resolve.ts`), which is why this migration seeds nothing: with no
-- rows, every form renders precisely what it rendered before this existed, so
-- applying it is a no-op for the public site until someone opens the manager.
--
-- Why `form_submissions` when `enquiries` already exists: an enquiry has
-- columns (name, email, brief, timeline) and a workflow (assignment, threads,
-- escalation), and it stays the desk's surface. But an editor who adds "Which
-- floor do you live on?" has nowhere to put the answer — `enquiries` has no
-- column for it and never will. Submissions record the form as asked and the
-- answers as given, and carry `enquiry_id` across to the lead the desk works.

set local search_path = public, auth, extensions;

-- ───────────────────────────────────────────────────────────────
-- forms — visibility + copy
-- ───────────────────────────────────────────────────────────────
create table if not exists public.forms (
  id            uuid primary key default gen_random_uuid(),
  -- Matches a key in lib/forms/registry.ts. A row whose key is not in the
  -- registry is inert: nothing renders it and the manager doesn't list it.
  key           text not null unique,
  -- Off hides the form from the public page. The contact page's own enquiry
  -- box declares `alwaysOn` in the registry and the editor's toggle is
  -- disabled there; this column is not the enforcement point for that, the
  -- resolver is, because "the site must be contactable" is a product rule
  -- rather than a data constraint.
  enabled       boolean not null default true,
  -- Partial `FormCopy`. Absent keys fall back to the registry default, so a
  -- form gains new copy fields without a backfill, and "revert to default" is
  -- deleting a key rather than guessing the original string.
  copy          jsonb not null default '{}'::jsonb,
  -- Extra recipients notified on submission, on top of the routing rules in
  -- Settings → Lead routing. Empty is the norm.
  notify_emails text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint forms_key_slug check (key ~ '^[a-z][a-z0-9_]*$'),
  constraint forms_copy_is_object check (jsonb_typeof(copy) = 'object')
);

create trigger forms_set_updated_at before update
  on public.forms
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- form_fields — the ordered field list
-- ───────────────────────────────────────────────────────────────
-- Rows appear the first time an editor saves a form. Until then the registry's
-- fields are what render, which is what makes this migration safe to apply
-- ahead of the deploy that reads it.
create table if not exists public.form_fields (
  id            uuid primary key default gen_random_uuid(),
  form_id       uuid not null references public.forms(id) on delete cascade,
  -- Input name and submission key. Unique per form — two fields answering to
  -- the same name would overwrite each other in `form_submissions.data`.
  key           text not null,
  label         text not null,
  -- Kept as a checked text rather than an enum: adding a field type is a code
  -- change either way, and `alter type … add value` can't run in a transaction
  -- with the rest of a migration.
  type          text not null check (type in (
                  'text', 'email', 'tel', 'phone_dial', 'textarea',
                  'select', 'chips', 'radio', 'checkbox', 'number')),
  -- Where the answer goes. Everything but 'custom' claims a column on
  -- `enquiries`; 'custom' rides in `form_submissions.data` and is appended to
  -- the brief the advisor reads.
  mapping       text not null default 'custom' check (mapping in (
                  'name', 'first_name', 'last_name', 'email', 'phone',
                  'message', 'intent', 'timeline', 'budget_min', 'budget_max',
                  'development_id', 'property_id', 'consent', 'custom')),
  placeholder   text,
  help          text,
  required      boolean not null default false,
  enabled       boolean not null default true,
  width         text not null default 'full' check (width in ('full', 'half')),
  -- [{label, value, intent?}]. Empty when `option_source` is set.
  options       jsonb not null default '[]'::jsonb,
  -- Options that come from live records instead of the editor's typing.
  option_source text check (option_source in (
                  'offplan_projects', 'areas', 'property_types',
                  'consultation_interests')),
  -- textarea only.
  rows          int check (rows between 2 and 12),
  -- number only. Named `min_value` / `max_value`: `min` and `max` are not
  -- reserved, but reading `min int` next to `rows int` invites the wrong guess.
  min_value     int,
  max_value     int,
  -- A field the handler cannot submit without. The editor may relabel it and
  -- move it; delete, retype and disable are refused in the action.
  locked        boolean not null default false,
  position      int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (form_id, key),
  constraint form_fields_key_slug check (key ~ '^[a-z][a-z0-9_]*$'),
  constraint form_fields_label_not_blank check (length(btrim(label)) > 0),
  constraint form_fields_options_is_array check (jsonb_typeof(options) = 'array'),
  constraint form_fields_range check (
    min_value is null or max_value is null or min_value <= max_value)
);

create index if not exists form_fields_form_position_idx
  on public.form_fields (form_id, position);

create trigger form_fields_set_updated_at before update
  on public.form_fields
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- form_submissions — what visitors sent
-- ───────────────────────────────────────────────────────────────
create table if not exists public.form_submissions (
  id          uuid primary key default gen_random_uuid(),
  -- Text, not a foreign key: a submission is evidence, and it must survive the
  -- form being renamed, disabled, or resolved from registry defaults with no
  -- `forms` row ever having existed.
  form_key    text not null,
  -- Every answered field, keyed by field key, plus a `_labels` object holding
  -- the labels as they read at submission time. The labels are snapshotted on
  -- purpose: an editor who renames a question next month must not silently
  -- relabel the answers people already gave to the old one.
  data        jsonb not null default '{}'::jsonb,
  -- The lead this became, when the handler made one. Null for a newsletter
  -- signup, or when the downstream insert failed and only the evidence landed.
  enquiry_id  uuid references public.enquiries(id) on delete set null,
  -- The page it was sent from, including the slug on a dynamic route — the
  -- registry only knows "/developments", not which project.
  source_path text,
  status      text not null default 'new'
    check (status in ('new', 'read', 'archived')),
  read_at     timestamptz,
  read_by     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint form_submissions_data_is_object check (jsonb_typeof(data) = 'object')
);

create index if not exists form_submissions_form_created_idx
  on public.form_submissions (form_key, created_at desc);

create index if not exists form_submissions_status_idx
  on public.form_submissions (status) where status = 'new';

create index if not exists form_submissions_enquiry_idx
  on public.form_submissions (enquiry_id) where enquiry_id is not null;

-- ───────────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────────
alter table public.forms enable row level security;
alter table public.form_fields enable row level security;
alter table public.form_submissions enable row level security;

-- Forms and their fields are public content — they are the labels on a page an
-- anonymous visitor is looking at. A disabled form is not hidden at this layer:
-- the resolver decides what renders, and hiding the row here would make the
-- manager's own preview lie about what it is editing.
drop policy if exists forms_public_read on public.forms;
create policy forms_public_read on public.forms
  for select using (true);

drop policy if exists forms_staff_write on public.forms;
create policy forms_staff_write on public.forms
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists form_fields_public_read on public.form_fields;
create policy form_fields_public_read on public.form_fields
  for select using (true);

drop policy if exists form_fields_staff_write on public.form_fields;
create policy form_fields_staff_write on public.form_fields
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Submissions are personal data. No public policy at all: the insert runs
-- through the service-role client in the submit action, exactly as anonymous
-- enquiry inserts already do, and reading is staff-only. Deliberately *not*
-- an anon INSERT policy — that would let anyone write rows into the log
-- directly, and there is nothing an honest visitor needs it for.
drop policy if exists form_submissions_staff_all on public.form_submissions;
create policy form_submissions_staff_all on public.form_submissions
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

comment on table public.forms is
  'Per-form visibility and copy for the lead-capture forms, editable at /admin/forms. Absent row ⇒ the registry defaults in lib/forms/registry.ts are live.';
comment on table public.form_fields is
  'The ordered field list for a form, written the first time an editor saves it. Absent rows ⇒ the registry field list is live.';
comment on table public.form_submissions is
  'Every public form submission, with the answers as given and the labels as they read at the time. Links to the enquiry it became, where there is one.';
