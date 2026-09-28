-- 0146 · Reviewing the documents: three more mortgage emails join the catalogue.
--
-- Phase 5 of the mortgage module (docs/mortgage/PLAN.md) reviews a Fast
-- Pre-Approval's documents, and three emails come with it (SPEC §6):
--
--   · mortgage_reupload_request — to the applicant, when an adviser asks them
--     to replace or add to one document (C4 → W8): which document, the
--     adviser's own message quoted, and a secure link to upload it that asks
--     for a code first. The application is on hold until it arrives; the
--     documents already accepted stay accepted. The message is plain text
--     the adviser typed, so it is a panel ({{mortgage_adviser_message}}):
--     escaped, its line breaks kept, never links or formatting, and quoted
--     line by line in both halves of the email;
--   · mortgage_code — to the applicant, the 6-digit code that opens a secure
--     link (a re-upload request or a Fast Pre-Approval invitation). Codes go
--     by email until WhatsApp is connected (D5). The code is never in the
--     subject, which a phone shows on its lock screen;
--   · mortgage_team_reupload_received — to the request's owner and the Head
--     of mortgages, when the applicant sends it: the reference, the service,
--     the document and how many files, and that the request is back in
--     review with its promise clock resumed. Like the other team alerts
--     (0144) it carries nothing about the applicant — no name, mobile, email
--     or date of birth — and always sends in English.
--
-- Seeded as DRAFTS, like every other system email: a draft sends nothing, and
-- the built-in templates in lib/email-templates.ts send until someone
-- publishes an override. The wording is provisional — the copy for every
-- mortgage email is an open design decision (D29). Each row carries an Arabic
-- machine first draft (ADR-0008), the team's included, as 0144 gave its
-- alerts theirs.
--
-- Nothing here touches the mortgage tables (0145 and before). The rows are
-- copy, and can be applied before or after the review flow ships.
--
-- The allow-list below is the WHOLE list, not an addition: it replaces the one
-- 0144 wrote, so a later migration that rewrites it must carry these three.
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
    $s$system-mortgage-reupload-request$s$,
    $s$mortgage_reupload_request$s$,
    'email',
    $s$Re-upload request$s$,
    'system',
    $s$One document needs another look — {{mortgage_reference}}$s$,
    $body$<p>Hello {{lead_first_name}},</p><p>{{mortgage_adviser}} has asked for another look at one document for your application {{mortgage_reference}}: <strong>{{mortgage_document}}</strong>.</p><p>{{mortgage_adviser_message}}</p><p>Your application is on hold until the document arrives. Any documents we've already accepted stay accepted.</p><a data-email-button="" href="{{mortgage_secure_url}}">Upload your document</a><p>Before you upload, we'll send you a code to confirm it's you.</p><p>The link works until <strong>{{mortgage_link_expires}}</strong>. It's personal to you, so please don't forward this email.</p><p>— The Bazar mortgage team</p>$body$,
    'html',
    -- `role` is not decoration: content_assets_html_is_whole_message only
    -- lets a row store HTML when it is a system email or a form reply, and
    -- the column default is 'outreach'.
    'system',
    $s$أحد مستنداتك يحتاج إلى نظرة أخرى — {{mortgage_reference}}$s$,
    $body$<p>مرحباً {{lead_first_name}}،</p><p>بطلب من {{mortgage_adviser}}، يحتاج أحد مستندات طلبك {{mortgage_reference}} إلى نظرة أخرى: <strong>{{mortgage_document}}</strong>.</p><p>{{mortgage_adviser_message}}</p><p>طلبك متوقف مؤقتاً إلى أن يصلنا المستند. وتبقى المستندات التي سبق أن قبلناها مقبولة.</p><a data-email-button="" href="{{mortgage_secure_url}}">ارفع مستندك</a><p>قبل الرفع، سنرسل إليك رمزاً للتأكد من هويتك.</p><p>يعمل الرابط حتى <strong>{{mortgage_link_expires}}</strong>. وهو خاص بك، فيُرجى عدم إعادة توجيه هذه الرسالة.</p><p>— فريق التمويل العقاري في بازار</p>$body$,
    $note$Sent when an adviser asks a Fast Pre-Approval applicant to replace or add to one document. {{mortgage_adviser_message}} is the adviser's own message, quoted exactly as typed: plain text, never links or formatting. The secure link asks for a code before anything is uploaded; the wording does not say how the code arrives, because that changes when WhatsApp is connected. Provisional wording: the copy for the mortgage emails is still being designed. Keep {{mortgage_secure_url}} — the editor will not publish a version without it.$note$,
    'draft',
    1
  ),
  (
    $s$system-mortgage-code$s$,
    $s$mortgage_code$s$,
    'email',
    $s$Secure link code$s$,
    'system',
    $s$Your Bazar verification code$s$,
    $body$<p>Hello {{lead_first_name}},</p><p>Use this code to open your secure link:</p><h2>{{verification_code}}</h2><p>It expires in {{mortgage_code_expires_in}}.</p><p>If you didn't ask for it, you can ignore this email — nobody can open your application without the code.</p><p>— The Bazar mortgage team</p>$body$,
    'html',
    'system',
    $s$رمز التحقق من بازار$s$,
    $body$<p>مرحباً {{lead_first_name}}،</p><p>استخدم هذا الرمز لفتح رابطك الآمن:</p><h2>{{verification_code}}</h2><p>تنتهي صلاحيته خلال {{mortgage_code_expires_in}}.</p><p>إن لم تطلبه، يمكنك تجاهل هذه الرسالة — لا يمكن لأحد فتح طلبك من دون هذا الرمز.</p><p>— فريق التمويل العقاري في بازار</p>$body$,
    $note$Sent when an applicant opening a secure link — a re-upload request or a Fast Pre-Approval invitation — asks for the one-time code that unlocks it. Codes go by email until WhatsApp is connected. Keep the code out of the subject line: a phone shows the subject on its lock screen. Provisional wording: the copy for the mortgage emails is still being designed. Keep {{verification_code}} — the editor will not publish a version without it.$note$,
    'draft',
    1
  ),
  (
    $s$system-mortgage-team-reupload-received$s$,
    $s$mortgage_team_reupload_received$s$,
    'email',
    $s$Re-upload received$s$,
    'system',
    $s$Re-upload received · {{mortgage_reference}}$s$,
    $body$<p>A re-upload has arrived.</p><ul><li><p>Reference: <strong>{{mortgage_reference}}</strong></p></li><li><p>Service: {{mortgage_service}}</p></li><li><p>Document: {{mortgage_document}}</p></li><li><p>Uploaded: {{mortgage_files}}</p></li></ul><p>The request is back in review, and the clock on its promise to the applicant has resumed.</p><a data-email-button="" href="{{mortgage_request_url}}">Open the request</a><p>— Bazar CMS</p>$body$,
    'html',
    'system',
    $s$وصل المستند المطلوب · {{mortgage_reference}}$s$,
    $body$<p>وصل مستند أُعيد رفعه.</p><ul><li><p>الرقم المرجعي: <strong>{{mortgage_reference}}</strong></p></li><li><p>الخدمة: {{mortgage_service}}</p></li><li><p>المستند: {{mortgage_document}}</p></li><li><p>الملفات المرفوعة: {{mortgage_files}}</p></li></ul><p>عاد الطلب إلى المراجعة، واستُؤنف احتساب المهلة التي وعدنا بها مقدّم الطلب.</p><a data-email-button="" href="{{mortgage_request_url}}">فتح الطلب</a><p>— نظام بازار</p>$body$,
    $note$Sent to the request's owner and the Head of mortgages when a Fast Pre-Approval applicant sends the document they were asked for. Always sent in English. It carries no applicant details — no name, mobile, email or date of birth — on purpose: the team reads those in the CMS. Provisional wording: the copy for the mortgage emails is still being designed. Keep {{mortgage_reference}} and {{mortgage_request_url}} — the editor will not publish a version without them.$note$,
    'draft',
    1
  )
on conflict (slug) do nothing;
