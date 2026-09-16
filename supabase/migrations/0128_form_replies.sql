-- 0128_form_replies.sql
-- Let a marketing manager choose which email answers which form.
--
-- WHAT WAS MISSING. 0127 catalogued every email the site sends, but the
-- mapping between the twenty-two public forms and the one email that answers
-- nearly all of them lived only in code: submit any lead form — the Buy hero,
-- a brochure gate, the contact page — and the visitor received the same
-- "We received your brief". The only way to say something different to a
-- brochure request than to a valuation lead was a code change.
--
-- WHAT THIS ADDS, in three parts. None of it changes a sent email.
--
--   1. `content_assets.role`. The library already held two kinds of asset:
--      hand-written outreach (plain text, the middle of a message) and the
--      seventeen system emails (rich text, the whole message). This names
--      them, and adds a third — `form_reply`: a whole-message rich-text email
--      written by an editor and assigned to one or more forms. Backfilled
--      from `system_key`, so every existing row keeps its meaning.
--
--   2. `forms.reply_asset_id`. Which reply answers this form. Null — the
--      default, and the state every form is in after this migration — means
--      the email the code already sends.
--
--   3. `enquiries.form_key`. Which form the lead came from. The auto-reply
--      cron sweeps `enquiries` minutes later with no idea which form was
--      filled in; without this it would send the general acknowledgement to a
--      lead whose form has a reply assigned. It is also simply useful: the
--      desk can now see which box on which page produced a lead.
--
-- Resolution at send time (lib/content-assets/system-emails.ts):
--
--   the form's assigned reply, if PUBLISHED
--     └─ else the mortgage acknowledgement, for a mortgage lead, if published
--          └─ else the enquiry acknowledgement, if published
--               └─ else the built-in template
--
-- So an unassigned form, an assigned-but-draft reply, a trashed reply or an
-- unreadable row all send exactly what they sent before.

-- ───────────────────────────────────────────────────────────────
-- 1. Asset roles
-- ───────────────────────────────────────────────────────────────
alter table public.content_assets
  add column if not exists role text not null default 'outreach';

update public.content_assets
   set role = 'system'
 where system_key is not null
   and role <> 'system';

alter table public.content_assets
  drop constraint if exists content_assets_role_known;
alter table public.content_assets
  add constraint content_assets_role_known
  check (role in ('outreach', 'system', 'form_reply'));

-- The role and the key are one fact stated twice; the constraint keeps them
-- from disagreeing. `system_key` is already immutable (the 0117 trigger), so
-- a system row cannot be re-roled either.
alter table public.content_assets
  drop constraint if exists content_assets_role_matches_system;
alter table public.content_assets
  add constraint content_assets_role_matches_system
  check ((role = 'system') = (system_key is not null));

-- A form reply is an email. WhatsApp has no reply path from a web form.
alter table public.content_assets
  drop constraint if exists content_assets_form_reply_is_email;
alter table public.content_assets
  add constraint content_assets_form_reply_is_email
  check (role <> 'form_reply' or kind = 'email');

-- Rich text is for whole-message assets. Outreach is the middle of a message
-- the composer wraps, and is sent as plain text.
alter table public.content_assets
  drop constraint if exists content_assets_html_is_system;
alter table public.content_assets
  drop constraint if exists content_assets_html_is_whole_message;
alter table public.content_assets
  add constraint content_assets_html_is_whole_message
  check (body_format = 'text' or role in ('system', 'form_reply'));

comment on column public.content_assets.role is
  'outreach = advisor-sent copy (plain text, wrapped by staffReplyTemplate); system = one of the seventeen transactional emails, keyed by system_key; form_reply = a whole-message email an editor assigns to public forms (forms.reply_asset_id).';

create index if not exists content_assets_role_idx
  on public.content_assets (role)
  where deleted_at is null;

-- ───────────────────────────────────────────────────────────────
-- 2. The assignment
-- ───────────────────────────────────────────────────────────────
alter table public.forms
  add column if not exists reply_asset_id uuid
  references public.content_assets(id) on delete set null;

comment on column public.forms.reply_asset_id is
  'The content asset emailed to the visitor when this form is submitted. Null (the default) sends the email the code already sends. Only honoured while the asset is published and untrashed; on delete the assignment clears rather than blocking the delete.';

create index if not exists forms_reply_asset_idx
  on public.forms (reply_asset_id)
  where reply_asset_id is not null;

-- ───────────────────────────────────────────────────────────────
-- 3. Which form a lead came from
-- ───────────────────────────────────────────────────────────────
alter table public.enquiries
  add column if not exists form_key text;

comment on column public.enquiries.form_key is
  'The lib/forms registry key of the form that produced this lead, when it came through one. Read by the auto-reply cron so a swept lead gets the same reply the inline send would have chosen. Free text rather than a foreign key: the registry is code, and a lead must never fail to file because a form was renamed.';
