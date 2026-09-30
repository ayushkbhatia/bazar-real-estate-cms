-- 0150 · Partner banks and the pre-approval: three emails join the catalogue.
--
-- Phase 6 of the mortgage module (docs/mortgage/PLAN.md) sends a Fast
-- Pre-Approval to the partner banks and decides it; 0148 seeded the decline.
-- Three more emails come with it (SPEC §6):
--
--   · mortgage_bank_package — to a partner bank's package inbox when an
--     adviser sends it a file: who has shared it, how many documents, and an
--     expiring link to a structured summary and the documents, where every
--     open and download is recorded. Never the documents themselves (SPEC
--     §8). Nothing about the applicant — no name, date of birth or salary:
--     the reference is all the email holds, and its scope has no applicant
--     token to fill;
--   · mortgage_bank_reminder — to a bank that has not answered: the day the
--     package went ({{mortgage_package_sent}}) and a fresh link, because the
--     first is stored only as its hash. The same rule about the applicant;
--   · mortgage_decision_pre_approved — to the applicant when an adviser
--     confirms their pre-approval: the adviser's own message, the panel the
--     decline and the re-upload request quote ({{mortgage_adviser_message}}:
--     escaped, its line breaks kept, never links or formatting, required),
--     the bank whose letter the send path attaches ({{mortgage_bank}}), and
--     how to reach them. Its subject is the decline's, word for word, so a
--     phone's lock screen tells neither outcome apart. Nothing about the
--     applicant beyond their first name.
--
-- The bank emails greet "the team at {{mortgage_bank}}", which still reads
-- right if the name ever falls back ("the team at the bank").
--
-- Seeded as DRAFTS, like every other system email: a draft sends nothing, and
-- the built-in templates in lib/email-templates.ts send until someone
-- publishes an override. The wording is provisional — the copy for every
-- mortgage email is an open design decision (D29). Each row carries an Arabic
-- machine first draft (ADR-0008). The banks' send paths pass no language, so
-- theirs is kept only as the team alerts keep theirs; in the pre-approval's,
-- the team's phone number is wrapped in invisible bidi isolates (U+2066 …
-- U+2069, lib/i18n/bidi) so it reads left to right in the Arabic sentence.
--
-- Nothing here touches the mortgage tables. The rows are copy, and can be
-- applied before or after the banks' flow ships.
--
-- The allow-list below is the WHOLE list, not an addition: it replaces the one
-- 0148 wrote, so a later migration that rewrites it must carry these three.
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
      'mortgage_bank_package',
      'mortgage_bank_reminder',
      'mortgage_decision_pre_approved',
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
    $s$system-mortgage-bank-package$s$,
    $s$mortgage_bank_package$s$,
    'email',
    $s$Package to a partner bank$s$,
    'system',
    $s$Fast Pre-Approval package {{mortgage_reference}} from Bazar$s$,
    $body$<p>Hello to the team at {{mortgage_bank}},</p><p>{{mortgage_adviser}} from Bazar's mortgage team has shared a Fast Pre-Approval application with you: a structured summary and {{mortgage_document_count}}.</p><a data-email-button="" href="{{mortgage_package_url}}">Open the package</a><p>The link works until <strong>{{mortgage_link_expires}}</strong>. Every open and download is recorded.</p><p>Reply to this email to reach {{mortgage_adviser}}.</p><p>— The Bazar mortgage team</p>$body$,
    'html',
    -- `role` is not decoration: content_assets_html_is_whole_message only
    -- lets a row store HTML when it is a system email or a form reply, and
    -- the column default is 'outreach'.
    'system',
    $s$ملف طلب الموافقة المبدئية السريعة {{mortgage_reference}} من بازار$s$,
    $body$<p>تحية طيبة إلى فريق {{mortgage_bank}}،</p><p>وصلكم من {{mortgage_adviser}}، من فريق التمويل العقاري في بازار، طلب للموافقة المبدئية السريعة: ملخص منظّم و{{mortgage_document_count}}.</p><a data-email-button="" href="{{mortgage_package_url}}">فتح الملف</a><p>يعمل الرابط حتى <strong>{{mortgage_link_expires}}</strong>. ويُسجَّل كل فتح وكل تنزيل.</p><p>للتواصل مع {{mortgage_adviser}}، يكفي الرد على هذه الرسالة.</p><p>— فريق التمويل العقاري في بازار</p>$body$,
    $note$Sent to a partner bank's package inbox when an adviser sends it a Fast Pre-Approval file. Always sent in English. It names nothing about the applicant — no name, date of birth or salary — on purpose: the reference is all the email holds, and the details are behind the link, where every open and download is recorded. If the adviser's name is ever missing, {{mortgage_adviser}} reads "Bazar's mortgage team", so the opening line would name the team twice. Provisional wording: the copy for the mortgage emails is still being designed. Keep {{mortgage_reference}} and {{mortgage_package_url}} — the editor will not publish a version without them.$note$,
    'draft',
    1
  ),
  (
    $s$system-mortgage-bank-reminder$s$,
    $s$mortgage_bank_reminder$s$,
    'email',
    $s$Reminder to a partner bank$s$,
    'system',
    $s$Reminder: Fast Pre-Approval package {{mortgage_reference}}$s$,
    $body$<p>Hello to the team at {{mortgage_bank}},</p><p>A reminder that {{mortgage_adviser}} shared Fast Pre-Approval application {{mortgage_reference}} with you on {{mortgage_package_sent}}. We'd be grateful for your response.</p><p>Here's a fresh link, working until <strong>{{mortgage_link_expires}}</strong>.</p><a data-email-button="" href="{{mortgage_package_url}}">Open the package</a><p>Every open and download is recorded.</p><p>Reply to this email to reach {{mortgage_adviser}}.</p><p>— The Bazar mortgage team</p>$body$,
    'html',
    'system',
    $s$تذكير: ملف طلب الموافقة المبدئية السريعة {{mortgage_reference}}$s$,
    $body$<p>تحية طيبة إلى فريق {{mortgage_bank}}،</p><p>نذكّركم بطلب الموافقة المبدئية السريعة {{mortgage_reference}} الذي وصلكم من {{mortgage_adviser}} في {{mortgage_package_sent}}. ونتطلع إلى ردّكم.</p><p>إليكم رابطاً جديداً يعمل حتى <strong>{{mortgage_link_expires}}</strong>.</p><a data-email-button="" href="{{mortgage_package_url}}">فتح الملف</a><p>يُسجَّل كل فتح وكل تنزيل.</p><p>للتواصل مع {{mortgage_adviser}}، يكفي الرد على هذه الرسالة.</p><p>— فريق التمويل العقاري في بازار</p>$body$,
    $note$Sent to a partner bank that has not answered, when an adviser sends it a reminder. It carries a fresh link to the package: the first one is stored only as its hash, so it cannot be sent again. Always sent in English, and it names nothing about the applicant. Provisional wording: the copy for the mortgage emails is still being designed. Keep {{mortgage_reference}} and {{mortgage_package_url}} — the editor will not publish a version without them.$note$,
    'draft',
    1
  ),
  (
    $s$system-mortgage-decision-pre-approved$s$,
    $s$mortgage_decision_pre_approved$s$,
    'email',
    $s$Pre-approval confirmed$s$,
    'system',
    $s$An update on your Fast Pre-Approval application — {{mortgage_reference}}$s$,
    $body$<p>Hello {{lead_first_name}},</p><p>{{mortgage_adviser}} from Bazar's mortgage team has written about your Fast Pre-Approval application {{mortgage_reference}}.</p><p>{{mortgage_adviser_message}}</p><p>Your pre-approval letter from {{mortgage_bank}} is attached.</p><p>You can reply to this email to reach {{mortgage_adviser}} directly, or call the mortgage team on +971 2 632 2223.</p><p>— The Bazar mortgage team</p>$body$,
    'html',
    'system',
    $s$تحديث بشأن طلبك للموافقة المبدئية السريعة — {{mortgage_reference}}$s$,
    $body$<p>مرحباً {{lead_first_name}}،</p><p>وصلتك رسالة من {{mortgage_adviser}}، من فريق التمويل العقاري في بازار، بخصوص طلبك للموافقة المبدئية السريعة {{mortgage_reference}}.</p><p>{{mortgage_adviser_message}}</p><p>مرفق بهذه الرسالة خطاب موافقتك المبدئية الصادر عن {{mortgage_bank}}.</p><p>يمكنك الرد على هذه الرسالة للتواصل مع {{mortgage_adviser}} مباشرةً، أو الاتصال بفريق التمويل العقاري على ⁦+971 2 632 2223⁩.</p><p>— فريق التمويل العقاري في بازار</p>$body$,
    $note$Sent when an adviser confirms a Fast Pre-Approval in the CMS; the send path attaches the bank's pre-approval letter. {{mortgage_adviser_message}} is the adviser's own message, quoted exactly as they wrote it: plain text, never links or formatting. The subject is the same as a declined application's, so a phone's lock screen tells neither apart — keep the outcome out of it. Say nothing about the applicant beyond their first name. If the adviser's name is ever missing, {{mortgage_adviser}} reads "Bazar's mortgage team", so the opening line would name the team twice. Provisional wording: the copy for the mortgage emails is still being designed. Keep {{mortgage_adviser_message}} — the editor will not publish a version without it.$note$,
    'draft',
    1
  )
on conflict (slug) do nothing;
