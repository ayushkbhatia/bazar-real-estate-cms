-- 0129_content_assets_arabic.sql
-- The Arabic half of every email the site sends.
--
-- WHAT WAS MISSING. The site serves Arabic, and `enquiries.locale` has
-- recorded which side a lead came from since 0100 — but every email the site
-- sends is English. A visitor who filled in an Arabic form, in Arabic, was
-- answered in English.
--
-- WHAT THIS ADDS.
--
--   1. `subject_ar` / `body_ar` on `content_assets`. The twin sits beside its
--      sibling, which is the rule docs/I18N.md states for every other
--      localised column in the schema. One row still carries one email; the
--      publish switch still decides whether it sends at all. What changes is
--      that a published row can now answer in the language the lead wrote in.
--
--   2. An Arabic FIRST DRAFT of all seventeen system emails, from
--      lib/content-assets/system-defaults-ar.ts — machine-drafted for the
--      client to edit, per ADR-0008, rather than an empty Arabic tab. Written
--      only where `subject_ar` is still null, so a later run never overwrites
--      an editor. Every row stays a draft, so this sends nothing.
--
--   3. `valuation_requests.locale`. The valuation tool is a form like any
--      other and its three emails must follow the same rule; the column is
--      what the acknowledgement, the report and the nurture crons read.
--      `enquiries.locale` (0100) and `newsletter_subscribers.locale` already
--      existed.
--
-- WHAT SENDS, AFTER THIS. Unchanged: every system row is still a draft, so
-- every email is still the built-in English template. Once a row is published:
-- an Arabic lead gets `subject_ar`/`body_ar` when both are written, and the
-- English otherwise — a half-translated email is never sent, and a missing
-- translation costs the language, never the email.

-- ───────────────────────────────────────────────────────────────
-- 1. The twin columns
-- ───────────────────────────────────────────────────────────────
alter table public.content_assets
  add column if not exists subject_ar text;
alter table public.content_assets
  add column if not exists body_ar text;

comment on column public.content_assets.subject_ar is
  'Arabic subject. Sent to a lead whose locale is ar when body_ar is written too; otherwise the English subject sends. Edited at /admin/content-assets?lang=ar.';
comment on column public.content_assets.body_ar is
  'Arabic body, same format as `body` (see body_format). Tokens are identical to the English — a translated {{token}} fills with nothing.';

-- ───────────────────────────────────────────────────────────────
-- 2. The Arabic first draft, where nobody has written one
-- ───────────────────────────────────────────────────────────────
with draft(slug, subject_ar, body_ar) as (values
  ($s$system-enquiry-auto-reply$s$, $s$وصلنا طلبك$s$, $body$<p>مرحباً {{lead_first_name}}،</p><p>شكراً لتواصلك مع بازار.</p><p>{{property_line}}</p><p>سيتواصل معك أحد مستشارينا خلال <strong>ساعتين في أوقات العمل</strong>، وفي صباح اليوم التالي خارجها.</p><p>نص رسالتك:</p><blockquote><p>{{enquiry_message}}</p></blockquote><p>— بازار</p>$body$),
  ($s$system-mortgage-enquiry-ack$s$, $s$طلب التمويل العقاري وصل إلى فريقنا$s$, $body$<p>مرحباً {{lead_first_name}}،</p><p>شكراً لك — طلب الموافقة المبدئية أصبح لدى فريق التمويل العقاري في بازار.</p><p>سيعود إليك أحد المستشارين بما ستموّله البنوك الشريكة فعلياً وفق هذه الأرقام، وبما تحتاجه منك لتأكيد ذلك.</p><p>تفاصيل طلبك:</p><blockquote><p>{{enquiry_message}}</p></blockquote><p>— فريق التمويل العقاري في بازار</p>$body$),
  ($s$system-valuation-acknowledgement$s$, $s$تقييم عقارك قيد المراجعة$s$, $body$<p>مرحباً {{lead_first_name}}،</p><p>شكراً لمشاركتك تفاصيل <strong>{{valuation_property}}</strong>.</p><p>{{valuation_range_panel}}</p><p>سيراجع أحد كبار المستشارين هذا التقدير ويرسل لك الرقم النهائي خلال <strong>٢٤ ساعة</strong>. لا التزام عليك — ولا ضغط للإدراج.</p><p>— بازار</p>$body$),
  ($s$system-valuation-code$s$, $s$رمز تقييم بازار: {{verification_code}}$s$, $body$<p>رمز الدخول لمرة واحدة:</p><h2>{{verification_code}}</h2><p>ينتهي خلال ١٠ دقائق. إن لم تطلبه، يمكنك تجاهل هذه الرسالة.</p><p>— بازار العقارية</p>$body$),
  ($s$system-valuation-report-requested$s$, $s$تقرير التقييم في طريقه إليك$s$, $body$<p>شكراً لتأكيد بريدك.</p><p>سيراجع أحد مستشاري بازار تفاصيل عقارك، ويقارن التقدير الفوري بأحدث الصفقات المماثلة، ثم يرسل لك التقرير الكامل خلال ٢٤ ساعة.</p><p>لديك سؤال في هذه الأثناء؟ يكفي الرد على هذه الرسالة.</p><p>— بازار العقارية</p>$body$),
  ($s$system-valuation-report$s$, $s$تقييم بازار لعقارك: {{valuation_final}}$s$, $body$<p>مرحباً {{lead_first_name}}،</p><p>هذا هو التقييم النهائي لـ <strong>{{valuation_property}}</strong>.</p><p>{{valuation_report_panel}}</p><blockquote><p>{{advisor_notes}}</p></blockquote><p>إن رغبت بمناقشة الرقم أو ما سيبدو عليه الإدراج، يكفي الرد على هذه الرسالة أو <a href="{{contact_url}}">حجز مكالمة</a>.</p><p>— {{advisor_name}}، بازار العقارية</p>$body$),
  ($s$system-valuation-nurture-day7$s$, $s$كيف وجدت التقييم؟$s$, $body$<p>مرحباً {{lead_first_name}}،</p><p>مضى أسبوع على إرسال تقييم بازار لعقارك. بلغ تقدير مستشارنا {{valuation_midpoint}}.</p><p>إن أردت مناقشة الخطوة التالية — استراتيجية الإدراج، أو عروضاً خاصة خارج السوق، أو إعادة التقييم عند سعر مختلف — يكفي الرد هنا.</p><p><a href="{{contact_url}}">تحدّث إلى مستشار ←</a></p><p>— بازار</p>$body$),
  ($s$system-valuation-nurture-day30$s$, $s$تحديث السوق لوحدتك في أبوظبي$s$, $body$<p>مرحباً {{lead_first_name}}،</p><p>مضى شهر على تقييم عقارك — ننشر قراءة شهرية لسوق أبوظبي على <a href="{{insights_url}}">رؤى بازار</a>.</p><p>إن تغيّر رأيك في البيع، أو أردت تقييماً محدّثاً، يكفي الرد هنا.</p><p>— بازار</p>$body$),
  ($s$system-viewing-confirmation$s$, $s$موعد معاينة مبدئي · {{property_reference}}$s$, $body$<p>مرحباً {{lead_first_name}}،</p><p>حجزنا لك موعد معاينة مبدئياً في <strong>{{viewing_time}}</strong> (توقيت أبوظبي).</p><ul><li><p>العقار: {{property_reference}} · {{property_title}}</p></li><li><p>مكان اللقاء: {{viewing_location}}</p></li><li><p>المدة: {{viewing_duration}}</p></li></ul><p>دعوة التقويم مرفقة — اقبلها لإضافة الموعد إلى تقويمك.</p><p>إن لم يناسبك هذا الوقت، يكفي الرد وسنجد موعداً آخر.</p><p>— بازار العقارية</p>$body$),
  ($s$system-newsletter-confirmation$s$, $s$أكّد اشتراكك في نشرة بازار$s$, $body$<p>مرحباً،</p><p>تفصلك نقرة واحدة عن الاشتراك في <strong>نشرة بازار</strong> — موجزنا الأسبوعي عن سوق أبوظبي.</p><a data-email-button="" href="{{confirm_url}}">تأكيد الاشتراك</a><p>إن لم تطلب هذا الاشتراك، تجاهل الرسالة — لن نضيفك إلى القائمة.</p>$body$),
  ($s$system-newsletter-welcome$s$, $s$أهلاً بك في نشرة بازار$s$, $body$<h2>أهلاً بك في نشرة بازار.</h2><p>كل أربعاء نرسل رسالة واحدة قصيرة: رسم بياني عن السوق، وملاحظة من مستشارينا، وعرضاً خارج السوق يستحق النظر.</p><p>يمكنك <a href="{{unsubscribe_url}}">إلغاء الاشتراك</a> في أي وقت.</p>$body$),
  ($s$system-staff-invitation$s$, $s$دعوة للانضمام إلى بازار بصفة {{staff_role}}$s$, $body$<p>مرحباً {{staff_name}}،</p><p>دعاك <strong>{{sender_name}}</strong> إلى لوحة تحكم بازار العقارية بصفة <strong>{{staff_role}}</strong>.</p><a data-email-button="" href="{{password_url}}">اختر كلمة المرور</a><p>الرابط صالح لمدة {{link_valid_days}} يوماً.</p><p>— بازار</p>$body$),
  ($s$system-staff-password-reset$s$, $s$تعيين كلمة مرور جديدة لحسابك في لوحة بازار$s$, $body$<p>مرحباً {{staff_name}}،</p><p>أرسل لك <strong>{{sender_name}}</strong> رابطاً لتعيين كلمة مرور جديدة للوحة تحكم بازار.</p><a data-email-button="" href="{{password_url}}">تعيين كلمة مرور جديدة</a><p>صالح لمدة {{link_valid_days}} يوماً، ولمرة واحدة. إن لم تكن تتوقع هذه الرسالة، أبلغ المسؤول — كلمة مرورك الحالية تبقى صالحة حتى تختار غيرها.</p><p>— بازار</p>$body$),
  ($s$system-enquiry-escalation$s$, $s$تصعيد · طلب من {{lead_name}} دون مستشار منذ {{minutes_waiting}} دقيقة$s$, $body$<p>مرحباً {{staff_name}}،</p><p>طلب من <strong>{{lead_name}}</strong> ينتظر منذ <strong>{{minutes_waiting}} دقيقة</strong> دون مستشار مُسند.</p><p>{{property_line}}</p><a data-email-button="" href="{{enquiry_url}}">فتح الطلب</a><p>— محرّك العملاء في بازار</p>$body$),
  ($s$system-permit-expiry-warning$s$, $s$تصريح {{permit_number}} ({{property_reference}}) ينتهي خلال {{days_to_expiry}} يوماً$s$, $body$<p>مرحباً،</p><p>تصريح الإدراج {{permit_number}} للعقار <strong>{{property_reference}}</strong> ينتهي في <strong>{{permit_expires_on}}</strong> (خلال {{days_to_expiry}} يوماً).</p><p>سيُؤرشف الإدراج تلقائياً عند انتهاء التصريح ما لم يُجدَّد.</p><a data-email-button="" href="{{properties_url}}">فتح قائمة العقارات</a><p>— الالتزام في بازار</p>$body$),
  ($s$system-bulk-reassign-digest$s$, $s$أُسندت إليك {{listings_assigned}}$s$, $body$<p>مرحباً {{staff_name}}،</p><p>أسندنا إليك للتو <strong>{{listings_assigned}}</strong> في نظام بازار.</p><p>{{listing_references}}</p><a data-email-button="" href="{{queue_url}}">فتح قائمتي</a><p>— نظام بازار</p>$body$),
  ($s$system-form-submission-notification$s$, $s$طلب جديد من {{form_name}} · {{form_surface}}$s$, $body$<p><strong>{{form_name}}</strong></p><p>{{form_surface}}</p><p>{{form_answers}}</p><p><a href="{{enquiry_url}}">فتح الطلب</a> · <a href="{{responses_url}}">كل الردود</a></p>$body$)
)
update public.content_assets a
   set subject_ar = draft.subject_ar,
       body_ar = draft.body_ar
  from draft
 where a.slug = draft.slug
   and a.system_key is not null
   and a.subject_ar is null
   and a.body_ar is null;

-- ───────────────────────────────────────────────────────────────
-- 3. The language a valuation was requested in
-- ───────────────────────────────────────────────────────────────
alter table public.valuation_requests
  add column if not exists locale text not null default 'en';

alter table public.valuation_requests
  drop constraint if exists valuation_requests_locale_known;
alter table public.valuation_requests
  add constraint valuation_requests_locale_known
  check (locale in ('en', 'ar'));

comment on column public.valuation_requests.locale is
  'The locale the owner submitted /tools/valuation in. Read by the acknowledgement, the advisor-sent report and the two nurture crons so each answers in the language the owner used. Defaults to en, which is what every row before this migration was.';
