-- 0142 · The mortgage flow's two confirmation emails join the catalogue.
--
-- The mortgage application flow answers every submission with an email to the
-- applicant (docs/mortgage/SPEC.md §6):
--
--   · mortgage_consultancy_received — a Mortgage Consultancy request: the
--     reference, and that the mortgage team will be in touch;
--   · mortgage_preapproval_received — a Fast Pre-Approval application: the
--     reference, the time the team will contact them by (24 WORKING hours,
--     docs/mortgage/DECISIONS.md D11) and the documents received.
--
-- Every email the site sends is listed and rewritable at
-- /admin/content-assets, so these are system emails like the rest: the
-- gallery previews them, and the mortgage team can change a word without a
-- deploy. Left out, the gallery would claim a completeness it does not have.
--
-- Seeded as DRAFTS, like every other system email: a draft sends nothing, and
-- the built-in templates in lib/email-templates.ts send until someone
-- publishes an override. The wording is provisional — the copy for every
-- mortgage email is an open design decision (D29) — and the Arabic is a
-- machine first draft (ADR-0008), written beside the English as 0129 did for
-- the others, so the Arabic tab opens on a sentence to correct rather than an
-- empty box.
--
-- Nothing here touches the mortgage tables (0138–0140). The rows are copy, and
-- can be applied before or after the flow ships.
--
-- The allow-list below is the WHOLE list, not an addition: it replaces the one
-- 0135 wrote, so a later migration that rewrites it must carry these two.
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
    $s$system-mortgage-consultancy-received$s$,
    $s$mortgage_consultancy_received$s$,
    'email',
    $s$Mortgage Consultancy confirmation$s$,
    'system',
    $s$We've received your request — {{mortgage_reference}}$s$,
    $body$<p>Hello {{lead_first_name}},</p><p>Thank you for requesting a mortgage consultation with Bazar. We received your request on {{mortgage_submitted}}.</p><p>Your reference is <strong>{{mortgage_reference}}</strong>.</p><p>A member of our mortgage team will contact you shortly.</p><p>— The Bazar mortgage team</p>$body$,
    'html',
    -- `role` is not decoration: content_assets_html_is_whole_message only
    -- lets a row store HTML when it is a system email or a form reply, and
    -- the column default is 'outreach'.
    'system',
    $s$وصلنا طلبك — {{mortgage_reference}}$s$,
    $body$<p>مرحباً {{lead_first_name}}،</p><p>شكراً لطلبك استشارة في التمويل العقاري من بازار. استلمنا طلبك في {{mortgage_submitted}}.</p><p>رقمك المرجعي هو <strong>{{mortgage_reference}}</strong>.</p><p>سيتواصل معك أحد أعضاء فريق التمويل العقاري لدينا قريباً.</p><p>— فريق التمويل العقاري في بازار</p>$body$,
    $note$Sent the moment an applicant submits a Mortgage Consultancy request. Provisional wording: the copy for the mortgage emails is still being designed. Keep {{mortgage_reference}} — the editor will not publish a version without it.$note$,
    'draft',
    1
  ),
  (
    $s$system-mortgage-preapproval-received$s$,
    $s$mortgage_preapproval_received$s$,
    'email',
    $s$Fast Pre-Approval confirmation$s$,
    'system',
    $s$Your Fast Pre-Approval application — {{mortgage_reference}}$s$,
    $body$<p>Hello {{lead_first_name}},</p><p>Thank you for applying for Fast Pre-Approval with Bazar. Your details and documents have reached our mortgage team.</p><p>Your reference is <strong>{{mortgage_reference}}</strong>.</p><p>We'll contact you by <strong>{{mortgage_due}}</strong> — 24 working hours from when you submitted.</p><p>{{mortgage_documents}}</p><p>If we need anything else, we'll message you on WhatsApp with a secure link. You won't need to start again.</p><p>— The Bazar mortgage team</p>$body$,
    'html',
    'system',
    $s$طلبك للموافقة المبدئية السريعة — {{mortgage_reference}}$s$,
    $body$<p>مرحباً {{lead_first_name}}،</p><p>شكراً لتقديم طلب الموافقة المبدئية السريعة مع بازار. وصلت بياناتك ومستنداتك إلى فريق التمويل العقاري لدينا.</p><p>رقمك المرجعي هو <strong>{{mortgage_reference}}</strong>.</p><p>سنتواصل معك بحلول <strong>{{mortgage_due}}</strong> — أي بعد 24 ساعة عمل من تقديم طلبك.</p><p>{{mortgage_documents}}</p><p>إن احتجنا إلى أي شيء آخر، سنراسلك عبر واتساب برابط آمن. لن تحتاج إلى البدء من جديد.</p><p>— فريق التمويل العقاري في بازار</p>$body$,
    $note$Sent the moment an applicant submits a Fast Pre-Approval application. Provisional wording: the copy for the mortgage emails is still being designed. {{mortgage_due}} counts working hours, not clock hours, so keep "working hours" in the sentence around it — and change the "24" here if the promise changes. Keep {{mortgage_reference}} and {{mortgage_due}} — the editor will not publish a version without them.$note$,
    'draft',
    1
  )
on conflict (slug) do nothing;
