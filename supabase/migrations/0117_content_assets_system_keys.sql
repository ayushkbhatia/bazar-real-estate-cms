-- 0117_content_assets_system_keys.sql
-- Fold the dead Settings → Templates editor into Content Assets.
--
-- WHAT WAS BROKEN. /admin/settings/templates wrote four {subject, body}
-- overrides into site_settings.email_templates, showed a "Template saved."
-- toast and wrote an audit row — and nothing anywhere read the column. Every
-- transactional email went out from the string literals in
-- lib/email-templates.ts regardless. An editor could rewrite the enquiry
-- acknowledgement all afternoon and change nothing. In production the column
-- reads `{}`, so no override is being lost here.
--
-- WHAT REPLACES IT. The same four emails become rows in content_assets,
-- carrying a `system_key`. The library already has the parts this needs — an
-- editor, a preview, publish/draft, token validation, an audit trail — and
-- consolidating means one place to write outbound copy instead of two.
--
-- 0061 said transactional mail stays in code because "a half-saved edit would
-- break a flow silently". That reasoning is answered rather than ignored:
--
--   · The code template stays. It is the fallback, not the dead branch.
--   · Only a PUBLISHED system row overrides it. These seed as DRAFTS, so
--     applying this migration changes not one sent email. Publishing is the
--     switch, and it's deliberate.
--   · A published row still failing to read (RLS, outage, service-role key
--     absent) falls back rather than sending nothing.
--   · The rows can't be deleted, trashed, re-slugged or re-keyed — see the
--     trigger below. A system email cannot go missing.
--
-- BODIES ARE WHOLE HERE. Unlike the hand-written assets seeded in 0062 —
-- which are the MIDDLE of a message, wrapped by staffReplyTemplate with a
-- greeting above and a signature below — a system body is the complete prose
-- including its own greeting and sign-off. Only the Bazar header and footer
-- chrome are added at send time.

-- ───────────────────────────────────────────────────────────────
-- Column
-- ───────────────────────────────────────────────────────────────
alter table public.content_assets
  add column if not exists system_key text;

comment on column public.content_assets.system_key is
  'Non-null on the four rows that override a transactional email. Assigned by migration, never by the editor. Null for hand-written outreach.';

-- One row per key. Partial so the ordinary assets, all null, do not collide.
create unique index if not exists content_assets_system_key_uniq
  on public.content_assets (system_key)
  where system_key is not null;

-- ───────────────────────────────────────────────────────────────
-- Seed — drafts, so nothing sent changes until someone publishes
-- ───────────────────────────────────────────────────────────────
-- Idempotent on slug, and existing rows are left alone: re-running must not
-- revert an editor's wording.
insert into public.content_assets
  (slug, system_key, kind, name, category, subject, body, notes, status, position)
values
  (
    'system-enquiry-auto-reply',
    'enquiry_auto_reply',
    'email',
    'Enquiry acknowledgement',
    'system',
    'We received your brief on {{property_reference}}',
    $body$Hello {{lead_first_name}},

Thank you for getting in touch with Bazar.

You wrote to us about {{property_title}} ({{property_reference}}).

One of our advisors will reach out within two hours during business hours, and by next morning otherwise.

Your message:
{{enquiry_message}}

— Bazar$body$,
    $note$Fires the moment a lead submits any enquiry form, and again from the auto-reply cron for anything the form path missed. It is the first thing a lead ever receives from Bazar — keep the two-hour promise in it only while the desk can keep it.$note$,
    'draft',
    0
  ),
  (
    'system-valuation-acknowledgement',
    'valuation_request_ack',
    'email',
    'Valuation acknowledgement',
    'system',
    'Your Bazar valuation is in review',
    $body$Hello {{lead_first_name}},

Thanks for sharing the details on {{valuation_property}}.

Instant range based on the inputs you provided: {{valuation_range}} (midpoint {{valuation_midpoint}}).

A senior advisor will refine this and send you a final number within 24 hours. There is no obligation — and no listing pressure.

— Bazar$body$,
    $note$Sent the instant an owner completes /tools/valuation. The refined number is a separate email an advisor sends by hand from /admin/valuations. Publishing this replaces the built-in version, including its large range panel — the numbers stay, as tokens, but the panel does not.$note$,
    'draft',
    1
  ),
  (
    'system-viewing-confirmation',
    'viewing_confirmation',
    'email',
    'Viewing confirmation',
    'system',
    'Tentative viewing · {{property_reference}}',
    $body$Hello {{lead_first_name}},

We have tentatively scheduled your viewing for {{viewing_time}} (Asia/Dubai).

Listing: {{property_reference}} · {{property_title}}
Where: {{viewing_location}}
Duration: {{viewing_duration}}

If this time does not work, simply reply and we will find another.

— Bazar Real Estate$body$,
    $note$Sent when an advisor books a viewing from an enquiry. The word to keep is "tentative" — the building has not confirmed access at this point.$note$,
    'draft',
    2
  ),
  (
    'system-newsletter-welcome',
    'newsletter_welcome',
    'email',
    'Newsletter welcome',
    'system',
    'You are in — welcome to the Bazar Brief',
    $body$Welcome to the Bazar Brief.

Every Wednesday, we send one short email: one market chart, one observation from our advisors, and one off-market listing worth a look.

You can unsubscribe at any time: {{unsubscribe_url}}$body$,
    $note$Sent after a subscriber clicks the confirmation link, not when they first type their address. The unsubscribe link is legally required — PDPL and the campaign providers both expect it — so leave {{unsubscribe_url}} in the body.$note$,
    'draft',
    3
  )
on conflict (slug) do nothing;

-- ───────────────────────────────────────────────────────────────
-- Constraints — added after the seed so they validate against real rows
-- ───────────────────────────────────────────────────────────────
-- The key vocabulary is closed in Postgres as well as in
-- lib/content-assets/system.ts. Adding a fifth system email is a migration,
-- deliberately: the send path has to be taught to read it in the same commit.
alter table public.content_assets
  drop constraint if exists content_assets_system_key_known;
alter table public.content_assets
  add constraint content_assets_system_key_known
  check (system_key is null or system_key in (
    'enquiry_auto_reply',
    'valuation_request_ack',
    'viewing_confirmation',
    'newsletter_welcome'
  ));

-- Every system email is email. WhatsApp has no transactional send path.
alter table public.content_assets
  drop constraint if exists content_assets_system_is_email;
alter table public.content_assets
  add constraint content_assets_system_is_email
  check (system_key is null or kind = 'email');

-- A system row with no subject would publish an email with a blank subject
-- line. The app blocks it first with a readable message; this is the floor.
alter table public.content_assets
  drop constraint if exists content_assets_system_has_subject;
alter table public.content_assets
  add constraint content_assets_system_has_subject
  check (system_key is null or (subject is not null and subject <> ''));

-- ───────────────────────────────────────────────────────────────
-- Protection trigger
-- ───────────────────────────────────────────────────────────────
-- RLS grants admin/editor/marketing `for all` on this table, so the row-level
-- write policy cannot express "these four rows are editable but not
-- removable". Per-column and per-row rules of this shape need a trigger.
create or replace function public.content_assets_protect_system()
returns trigger
language plpgsql
as $fn$
begin
  if tg_op = 'DELETE' then
    if old.system_key is not null then
      raise exception
        'content_assets: the % system email cannot be deleted', old.system_key;
    end if;
    return old;
  end if;

  if old.system_key is not null then
    if new.system_key is distinct from old.system_key then
      raise exception 'content_assets: system_key cannot be reassigned';
    end if;
    if new.slug is distinct from old.slug then
      raise exception 'content_assets: a system email keeps its slug';
    end if;
    if new.kind is distinct from old.kind then
      raise exception 'content_assets: a system email is always email';
    end if;
    if new.deleted_at is not null and old.deleted_at is null then
      raise exception
        'content_assets: the % system email cannot be trashed. Set it back to draft to stop it overriding the built-in copy.',
        old.system_key;
    end if;
  elsif new.system_key is not null then
    raise exception
      'content_assets: system_key is assigned by migration, not by the editor';
  end if;

  return new;
end
$fn$;

drop trigger if exists content_assets_protect_system on public.content_assets;
create trigger content_assets_protect_system
  before update or delete on public.content_assets
  for each row execute function public.content_assets_protect_system();
