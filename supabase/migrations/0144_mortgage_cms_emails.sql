-- 0144 · The mortgage CMS's five emails join the catalogue.
--
-- The mortgage team's work sends five more emails (docs/mortgage/SPEC.md §6).
--
-- To the request's owner and the Head of mortgages:
--
--   · mortgage_team_new_request — a Fast Pre-Approval or Mortgage Consultancy
--     request has arrived;
--   · mortgage_team_at_risk — a Fast Pre-Approval has 4 working hours or less
--     left on its promise (working hours: docs/mortgage/DECISIONS.md D11);
--   · mortgage_team_breached — a Fast Pre-Approval has passed its due time
--     with no decision.
--
--   These carry nothing about the applicant — no name, mobile, email or date
--   of birth. An email passes through a provider and waits in an inbox, so
--   they say only the reference, the service, the clock and where the
--   request is in the CMS; the team reads the rest there. Nothing in their
--   token scope could put the applicant's details in, either.
--
-- To the applicant:
--
--   · mortgage_consultation_booked — their consultation is booked: when, how,
--     with whom and for how long. The send path attaches the calendar invite
--     (.ics); the email says it is there;
--   · mortgage_preapproval_invite — an adviser's secure link to apply for Fast
--     Pre-Approval, when it expires, and that it asks for a code sent to their
--     mobile before anything is uploaded.
--
-- Seeded as DRAFTS, like every other system email: a draft sends nothing, and
-- the built-in templates in lib/email-templates.ts send until someone
-- publishes an override. The wording is provisional — the copy for every
-- mortgage email is an open design decision (D29).
--
-- Each row carries an Arabic machine first draft (ADR-0008), the team's three
-- included, as 0129 and 0135 gave the other team emails theirs. The team's
-- send paths take no language, so those three always go in English; their
-- Arabic tab opens on a sentence to correct, like every other email's.
--
-- Nothing here touches the mortgage tables. The rows are copy, and can be
-- applied before or after the CMS ships.
--
-- The allow-list below is the WHOLE list, not an addition: it replaces the one
-- 0142 wrote, so a later migration that rewrites it must carry these five.
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
    $s$system-mortgage-team-new-request$s$,
    $s$mortgage_team_new_request$s$,
    'email',
    $s$New mortgage request$s$,
    'system',
    $s$New {{mortgage_service}} · {{mortgage_reference}}$s$,
    $body$<p>A new mortgage request has arrived.</p><ul><li><p>Reference: <strong>{{mortgage_reference}}</strong></p></li><li><p>Service: {{mortgage_service}}</p></li><li><p>Received: {{mortgage_submitted}}</p></li><li><p>Owner: {{mortgage_owner}}</p></li></ul><a data-email-button="" href="{{mortgage_request_url}}">Open the request</a><p>The applicant's details are in the CMS, not in this email.</p><p>— Bazar CMS</p>$body$,
    'html',
    -- `role` is not decoration: content_assets_html_is_whole_message only
    -- lets a row store HTML when it is a system email or a form reply, and
    -- the column default is 'outreach'.
    'system',
    $s$طلب جديد · {{mortgage_service}} · {{mortgage_reference}}$s$,
    $body$<p>وصل طلب تمويل عقاري جديد.</p><ul><li><p>الرقم المرجعي: <strong>{{mortgage_reference}}</strong></p></li><li><p>الخدمة: {{mortgage_service}}</p></li><li><p>وقت الاستلام: {{mortgage_submitted}}</p></li><li><p>المسؤول عن الطلب: {{mortgage_owner}}</p></li></ul><a data-email-button="" href="{{mortgage_request_url}}">فتح الطلب</a><p>بيانات مقدّم الطلب في نظام بازار، وليست في هذه الرسالة.</p><p>— نظام بازار</p>$body$,
    $note$Sent to the request's owner and the Head of mortgages when a Fast Pre-Approval or Mortgage Consultancy request arrives. Always sent in English. It carries no applicant details — no name, mobile, email or date of birth — on purpose: the team reads those in the CMS. Provisional wording: the copy for the mortgage emails is still being designed. Keep {{mortgage_reference}} and {{mortgage_request_url}} — the editor will not publish a version without them.$note$,
    'draft',
    1
  ),
  (
    $s$system-mortgage-team-at-risk$s$,
    $s$mortgage_team_at_risk$s$,
    'email',
    $s$Pre-approval promise at risk$s$,
    'system',
    $s$At risk · {{mortgage_reference}} has {{mortgage_remaining}} left$s$,
    $body$<p>This request has <strong>{{mortgage_remaining}}</strong> of working time left before its promise to the applicant falls due.</p><ul><li><p>Reference: <strong>{{mortgage_reference}}</strong></p></li><li><p>Service: {{mortgage_service}}</p></li><li><p>Due: {{mortgage_due}}</p></li></ul><a data-email-button="" href="{{mortgage_request_url}}">Open the request</a><p>— Bazar CMS</p>$body$,
    'html',
    'system',
    $s$معرّض للتأخير · {{mortgage_reference}} · الوقت المتبقي {{mortgage_remaining}}$s$,
    $body$<p>تبقّى لهذا الطلب <strong>{{mortgage_remaining}}</strong> من وقت العمل قبل أن يحين الموعد الذي وعدنا به مقدّم الطلب.</p><ul><li><p>الرقم المرجعي: <strong>{{mortgage_reference}}</strong></p></li><li><p>الخدمة: {{mortgage_service}}</p></li><li><p>موعد الاستحقاق: {{mortgage_due}}</p></li></ul><a data-email-button="" href="{{mortgage_request_url}}">فتح الطلب</a><p>— نظام بازار</p>$body$,
    $note$Sent to the request's owner and the Head of mortgages when a Fast Pre-Approval has 4 working hours or less left on its promise. Always sent in English, with no applicant details. {{mortgage_remaining}} is working time, not clock time, so keep "working time" in the sentence around it; {{mortgage_due}} is the instant. Provisional wording: the copy for the mortgage emails is still being designed. Keep {{mortgage_reference}} and {{mortgage_request_url}} — the editor will not publish a version without them.$note$,
    'draft',
    1
  ),
  (
    $s$system-mortgage-team-breached$s$,
    $s$mortgage_team_breached$s$,
    'email',
    $s$Pre-approval promise missed$s$,
    'system',
    $s$Promise missed · {{mortgage_reference}}$s$,
    $body$<p>This request has missed its promise to the applicant, and there is no decision yet.</p><ul><li><p>Reference: <strong>{{mortgage_reference}}</strong></p></li><li><p>Service: {{mortgage_service}}</p></li><li><p>Was due: {{mortgage_due}}</p></li></ul><p>The applicant was told to expect contact by then. If the decision needs more time, let them know.</p><a data-email-button="" href="{{mortgage_request_url}}">Open the request</a><p>— Bazar CMS</p>$body$,
    'html',
    'system',
    $s$تجاوز المهلة الموعودة · {{mortgage_reference}}$s$,
    $body$<p>تجاوز هذا الطلب الموعد الذي وعدنا به مقدّم الطلب، ولا قرار بعد.</p><ul><li><p>الرقم المرجعي: <strong>{{mortgage_reference}}</strong></p></li><li><p>الخدمة: {{mortgage_service}}</p></li><li><p>كان موعد الاستحقاق: {{mortgage_due}}</p></li></ul><p>وُعد مقدّم الطلب بالتواصل قبل هذا الموعد. إن احتاج القرار إلى وقت أطول، فيُرجى إبلاغ مقدّم الطلب بذلك.</p><a data-email-button="" href="{{mortgage_request_url}}">فتح الطلب</a><p>— نظام بازار</p>$body$,
    $note$Sent to the request's owner and the Head of mortgages when a Fast Pre-Approval passes its due time with no decision. Always sent in English, with no applicant details. Provisional wording: the copy for the mortgage emails is still being designed. Keep {{mortgage_reference}} and {{mortgage_request_url}} — the editor will not publish a version without them.$note$,
    'draft',
    1
  ),
  (
    $s$system-mortgage-consultation-booked$s$,
    $s$mortgage_consultation_booked$s$,
    'email',
    $s$Mortgage consultation booked$s$,
    'system',
    $s$Your mortgage consultation is booked for {{mortgage_consultation_when}}$s$,
    $body$<p>Hello {{lead_first_name}},</p><p>Your mortgage consultation with {{mortgage_adviser}} is booked.</p><ul><li><p>When: <strong>{{mortgage_consultation_when}}</strong> (UAE time)</p></li><li><p>How: {{mortgage_consultation_format}}</p></li><li><p>Duration: {{mortgage_consultation_duration}}</p></li><li><p>Reference: {{mortgage_reference}}</p></li></ul><p>A calendar invite is attached — open it to add the consultation to your calendar.</p><p>If the time no longer suits you, reply to this email and we'll find another.</p><p>— The Bazar mortgage team</p>$body$,
    'html',
    'system',
    $s$موعد استشارتك في التمويل العقاري: {{mortgage_consultation_when}}$s$,
    $body$<p>مرحباً {{lead_first_name}}،</p><p>تم حجز استشارتك في التمويل العقاري مع {{mortgage_adviser}}.</p><ul><li><p>الموعد: <strong>{{mortgage_consultation_when}}</strong> (بتوقيت الإمارات)</p></li><li><p>الطريقة: {{mortgage_consultation_format}}</p></li><li><p>المدة: {{mortgage_consultation_duration}}</p></li><li><p>الرقم المرجعي: {{mortgage_reference}}</p></li></ul><p>دعوة التقويم مرفقة — افتحها لإضافة الاستشارة إلى تقويمك.</p><p>إن لم يعد الموعد مناسباً لك، يكفي الرد على هذه الرسالة وسنجد موعداً آخر.</p><p>— فريق التمويل العقاري في بازار</p>$body$,
    $note$Sent when an adviser books a consultation on a Mortgage Consultancy request. The send path attaches the calendar invite (.ics), so keep the sentence that says it is attached. Provisional wording: the copy for the mortgage emails is still being designed. Keep {{mortgage_consultation_when}} — the editor will not publish a version without it.$note$,
    'draft',
    1
  ),
  (
    $s$system-mortgage-preapproval-invite$s$,
    $s$mortgage_preapproval_invite$s$,
    'email',
    $s$Fast Pre-Approval invitation$s$,
    'system',
    $s$Your secure link to apply for Fast Pre-Approval$s$,
    $body$<p>Hello {{lead_first_name}},</p><p>{{mortgage_adviser}} has sent you a secure link to apply for Fast Pre-Approval with Bazar.</p><p>Your details carry over from your consultation request ({{mortgage_reference}}), so you'll only need to upload your documents.</p><a data-email-button="" href="{{mortgage_secure_url}}">Start your application</a><p>Before you upload, you'll be asked for a code we send to your mobile.</p><p>The link works until <strong>{{mortgage_link_expires}}</strong>. It's personal to you, so please don't forward this email.</p><p>— The Bazar mortgage team</p>$body$,
    'html',
    'system',
    $s$رابطك الآمن لتقديم طلب الموافقة المبدئية السريعة$s$,
    $body$<p>مرحباً {{lead_first_name}}،</p><p>وصلك من {{mortgage_adviser}} رابط آمن لتقديم طلب الموافقة المبدئية السريعة مع بازار.</p><p>تنتقل بياناتك من طلب الاستشارة ({{mortgage_reference}}) تلقائياً، فلن تحتاج إلا إلى رفع مستنداتك.</p><a data-email-button="" href="{{mortgage_secure_url}}">ابدأ طلبك</a><p>قبل الرفع، سيُطلب منك إدخال رمز نرسله إلى هاتفك المتحرك.</p><p>يعمل الرابط حتى <strong>{{mortgage_link_expires}}</strong>. وهو خاص بك، فيُرجى عدم إعادة توجيه هذه الرسالة.</p><p>— فريق التمويل العقاري في بازار</p>$body$,
    $note$Sent when an adviser sends a consultancy applicant a secure link to apply for Fast Pre-Approval. The link asks for a code sent to the applicant's mobile before anything is uploaded; the wording does not say how the code arrives, because that is still being decided. Provisional wording: the copy for the mortgage emails is still being designed. Keep {{mortgage_secure_url}} — the editor will not publish a version without it.$note$,
    'draft',
    1
  )
on conflict (slug) do nothing;
