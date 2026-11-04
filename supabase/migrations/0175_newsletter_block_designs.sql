-- 0175 · Block-built newsletters and saved templates (docs/NEWSLETTER.md,
-- "Block-built newsletters").
--
-- The client asked (3 Nov 2026) to build launch mailers like the ones the
-- portals send — a full-width hero photograph, bands of colour, a row of
-- features, tags, an "at a glance" table, a closing ask — piece by piece, and
-- to keep a layout they like as a template for the next one.
--
-- 1. `newsletter_campaigns.format` — 'rich' (the rich-text body every
--    newsletter so far was written in, unchanged) or 'blocks' — and
--    `design`, the block document (lib/newsletter/blocks/types.ts): settings
--    plus an ordered list of blocks, each block's Arabic beside its English
--    under `<key>_ar`. The app normalises it at the save boundary and again
--    at render, so the column is plain jsonb.
--
-- 2. `newsletter_templates` — a design an editor saved to start the next
--    newsletter from, with its subject and preview line in both languages.
--    The built-in templates (Project launch, Featured listings…) are code
--    (lib/newsletter/blocks/templates.ts), filled from the live catalogue
--    and site footer when used; these rows are the editors' own.
--
-- Additive; the deployed code reads none of it.

alter table public.newsletter_campaigns
  add column if not exists format text not null default 'rich',
  add column if not exists design jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'newsletter_campaigns_format_check'
  ) then
    alter table public.newsletter_campaigns
      add constraint newsletter_campaigns_format_check check (format in ('rich', 'blocks'));
  end if;
end $$;

comment on column public.newsletter_campaigns.format is
  'rich = body/body_ar written in the rich-text editor; blocks = design (lib/newsletter/blocks).';
comment on column public.newsletter_campaigns.design is
  'Block document for format = blocks: {version, settings, blocks[]}; Arabic under <key>_ar inside each block.';

create table if not exists public.newsletter_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) between 1 and 120),
  description  text not null default '',
  subject      text not null default '',
  preheader    text not null default '',
  subject_ar   text not null default '',
  preheader_ar text not null default '',
  design       jsonb not null,
  created_by   uuid references auth.users(id) on delete set null,
  updated_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists newsletter_templates_updated_idx
  on public.newsletter_templates (updated_at desc);

drop trigger if exists newsletter_templates_set_updated_at on public.newsletter_templates;
create trigger newsletter_templates_set_updated_at
  before update on public.newsletter_templates
  for each row execute function public.set_updated_at();

alter table public.newsletter_templates enable row level security;

drop policy if exists newsletter_templates_staff_read on public.newsletter_templates;
create policy newsletter_templates_staff_read on public.newsletter_templates
  for select to authenticated
  using ((select public.is_staff()));

-- Whoever may write a newsletter may keep a template of one.
drop policy if exists newsletter_templates_composer_write on public.newsletter_templates;
create policy newsletter_templates_composer_write on public.newsletter_templates
  for all to authenticated
  using ((select public.current_staff_role()) in ('admin', 'editor', 'marketing'))
  with check ((select public.current_staff_role()) in ('admin', 'editor', 'marketing'));

grant select, insert, update, delete on public.newsletter_templates to authenticated;
grant all on public.newsletter_templates to service_role;
