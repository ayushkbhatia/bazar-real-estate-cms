-- 0148 · Declining a Fast Pre-Approval: its email joins the catalogue.
--
-- Phase 6 of the mortgage module (docs/mortgage/PLAN.md) decides a Fast
-- Pre-Approval, and 0147 built the decline (D19). One email comes with it
-- (SPEC §6):
--
--   · mortgage_decision_declined — to the applicant, when an adviser declines
--     their application in the CMS: who has written, the adviser's own
--     message quoted, and how to reach them. The message is the adviser's —
--     prefilled from the reason and edited before it goes — so it is the
--     panel the re-upload request quotes ({{mortgage_adviser_message}}):
--     escaped, its line breaks kept, never links or formatting, and quoted
--     line by line in both halves of the email. It is required: without it
--     the email says someone has written and shows nothing. The subject is
--     "an update", never the outcome, because a phone shows the subject on
--     its lock screen. Nothing about the applicant goes in beyond their first
--     name: its scope has no full name, mobile, email address, date of birth
--     or income to fill.
--
-- Seeded as a DRAFT, like every other system email: a draft sends nothing,
-- and the built-in template in lib/email-templates.ts sends until someone
-- publishes an override. The wording is provisional — the copy for every
-- mortgage email is an open design decision (D29). The row carries an Arabic
-- machine first draft (ADR-0008), as 0146 gave its three theirs. In it the
-- team's phone number is wrapped in invisible bidi isolates (U+2066 … U+2069,
-- lib/i18n/bidi), so it reads left to right inside the Arabic sentence.
--
-- Nothing here touches the mortgage tables (0147 and before). The row is
-- copy, and can be applied before or after the decline ships.
--
-- The allow-list below is the WHOLE list, not an addition: it replaces the one
-- 0146 wrote, so a later migration that rewrites it must carry this key too.
--
-- The wording is lib/content-assets/system-defaults.ts and
-- system-defaults-ar.ts, reproduced verbatim. system.test.ts and
-- arabic.test.ts fail if the two drift.

alter table public.content_assets
  drop constraint if exists content_assets_system_key_known;

alter table public.content_assets
  add constraint content_assets_system_key_known check (
    system_key is null
    or system_key = any (array[
      'enquiry_auto_reply',
      'mortgage_enquiry_ack',
      'mortgage_consultancy_received',
      'mortgage_preapproval_received',
      'mortgage_consultation_booked',
      'mortgage_preapproval_invite',
      'mortgage_reupload_request',
      'mortgage_code',
      'mortgage_decision_declined',
      'valuation_request_ack',
      'valuation_code',
      'valuation_report_requested',
      'valuation_report',
      'valuation_nurture_day7',
      'valuation_nurture_day30',
      'newsletter_confirmation',
      'newsletter_welcome',
      'staff_invitation',
      'staff_password_reset',
      'enquiry_escalation',
      'mortgage_team_new_request',
      'mortgage_team_at_risk',
      'mortgage_team_breached',
      'mortgage_team_reupload_received',
      'permit_expiry_warning',
      'bulk_reassign_digest',
      'health_digest',
      'form_submission_notification'
    ])
  );

insert into public.content_assets
  (slug, system_key, kind, name, category, subject, body, body_format, role,
   subject_ar, body_ar, notes, status, position)
values
  (
    $s$system-mortgage-decision-declined$s$,
    $s$mortgage_decision_declined$s$,
    'email',
    $s$Fast Pre-Approval declined$s$,
    'system',
    $s$An update on your Fast Pre-Approval application — {{mortgage_reference}}$s$,
    $body$<p>Hello {{lead_first_name}},</p><p>{{mortgage_adviser}} from Bazar's mortgage team has written about your Fast Pre-Approval application {{mortgage_reference}}.</p><p>{{mortgage_adviser_message}}</p><p>You can reply to this email to reach {{mortgage_adviser}} directly, or call the mortgage team on +971 2 632 2223.</p><p>— The Bazar mortgage team</p>$body$,
    'html',
    -- `role` is not decoration: content_assets_html_is_whole_message only
    -- lets a row store HTML when it is a system email or a form reply, and
    -- the column default is 'outreach'.
    'system',
    $s$تحديث بشأن طلبك للموافقة المبدئية السريعة — {{mortgage_reference}}$s$,
    $body$<p>مرحباً {{lead_first_name}}،</p><p>وصلتك رسالة من {{mortgage_adviser}}، من فريق التمويل العقاري في بازار، بخصوص طلبك للموافقة المبدئية السريعة {{mortgage_reference}}.</p><p>{{mortgage_adviser_message}}</p><p>يمكنك الرد على هذه الرسالة للتواصل مع {{mortgage_adviser}} مباشرةً، أو الاتصال بفريق التمويل العقاري على ⁦+971 2 632 2223⁩.</p><p>— فريق التمويل العقاري في بازار</p>$body$,
    $note$Sent when an adviser declines a Fast Pre-Approval application in the CMS. {{mortgage_adviser_message}} is the adviser's own message, quoted exactly as they wrote it: plain text, never links or formatting. Keep the outcome out of the subject line: a phone shows the subject on its lock screen. Say nothing about the applicant beyond their first name. If the adviser's name is ever missing, {{mortgage_adviser}} reads "Bazar's mortgage team", so the opening line would name the team twice. Provisional wording: the copy for the mortgage emails is still being designed. Keep {{mortgage_adviser_message}} — the editor will not publish a version without it.$note$,
    'draft',
    1
  )
on conflict (slug) do nothing;
