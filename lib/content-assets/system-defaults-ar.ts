import { isolateLtr } from "@/lib/i18n/bidi";
import type { SystemAssetKey } from "./system";
import type { SystemEmailDefault } from "./system-defaults";

/**
 * The Arabic first draft of every system email.
 *
 * A machine first draft the client edits, per ADR-0008 — not hand-authored
 * copy, and not a claim that it is finished. It exists because the alternative
 * is an empty Arabic tab: an editor who opens the Arabic side of an email
 * should be correcting a sentence, not writing one from nothing.
 *
 * Every token is left exactly as it is in the English. A translated
 * `{{lead_first_name}}` fills with nothing, so the tokens are the one part of
 * these strings that must never be touched.
 *
 * Sentence order follows the English so the two can be read side by side, and
 * the tone is the formal register the site's Arabic already uses.
 */

/**
 * The mortgage team's number, a Latin run inside an Arabic sentence, so it is
 * isolated left to right: bare, its "+" and its groups reorder (lib/i18n/bidi).
 */
const MORTGAGE_TEAM_PHONE = isolateLtr("+971 2 632 2223");

export const SYSTEM_EMAIL_DEFAULTS_AR: Record<SystemAssetKey, SystemEmailDefault> = {
  enquiry_auto_reply: {
    subject: "وصلنا طلبك",
    body: [
      "<p>مرحباً {{lead_first_name}}،</p>",
      "<p>شكراً لتواصلك مع بازار.</p>",
      "<p>{{property_line}}</p>",
      "<p>سيتواصل معك أحد مستشارينا خلال <strong>ساعتين في أوقات العمل</strong>، وفي صباح اليوم التالي خارجها.</p>",
      "<p>نص رسالتك:</p>",
      "<blockquote><p>{{enquiry_message}}</p></blockquote>",
      "<p>— بازار</p>",
    ].join(""),
  },
  mortgage_enquiry_ack: {
    subject: "طلب التمويل العقاري وصل إلى فريقنا",
    body: [
      "<p>مرحباً {{lead_first_name}}،</p>",
      "<p>شكراً لك — طلب الموافقة المبدئية أصبح لدى فريق التمويل العقاري في بازار.</p>",
      "<p>سيعود إليك أحد المستشارين بما ستموّله البنوك الشريكة فعلياً وفق هذه الأرقام، وبما تحتاجه منك لتأكيد ذلك.</p>",
      "<p>تفاصيل طلبك:</p>",
      "<blockquote><p>{{enquiry_message}}</p></blockquote>",
      "<p>— فريق التمويل العقاري في بازار</p>",
    ].join(""),
  },
  // Figures in Western digits, as the dates these sentences carry are
  // printed (lib/i18n/dates.ts pins `nu-latn`) — "٢٤" beside "14:14" in one
  // sentence would read as two systems.
  mortgage_consultancy_received: {
    subject: "وصلنا طلبك — {{mortgage_reference}}",
    body: [
      "<p>مرحباً {{lead_first_name}}،</p>",
      "<p>شكراً لطلبك استشارة في التمويل العقاري من بازار. استلمنا طلبك في {{mortgage_submitted}}.</p>",
      "<p>رقمك المرجعي هو <strong>{{mortgage_reference}}</strong>.</p>",
      "<p>سيتواصل معك أحد أعضاء فريق التمويل العقاري لدينا قريباً.</p>",
      "<p>— فريق التمويل العقاري في بازار</p>",
    ].join(""),
  },
  mortgage_preapproval_received: {
    subject: "طلبك للموافقة المبدئية السريعة — {{mortgage_reference}}",
    body: [
      "<p>مرحباً {{lead_first_name}}،</p>",
      "<p>شكراً لتقديم طلب الموافقة المبدئية السريعة مع بازار. وصلت بياناتك ومستنداتك إلى فريق التمويل العقاري لدينا.</p>",
      "<p>رقمك المرجعي هو <strong>{{mortgage_reference}}</strong>.</p>",
      "<p>سنتواصل معك بحلول <strong>{{mortgage_due}}</strong> — أي بعد 24 ساعة عمل من تقديم طلبك.</p>",
      "<p>{{mortgage_documents}}</p>",
      "<p>إن احتجنا إلى أي شيء آخر، سنراسلك عبر واتساب برابط آمن. لن تحتاج إلى البدء من جديد.</p>",
      "<p>— فريق التمويل العقاري في بازار</p>",
    ].join(""),
  },
  // The adviser may be a man or a woman and the site does not record which,
  // so no verb here agrees with the adviser: the link "reaches you from" them
  // rather than "he sent" it.
  mortgage_consultation_booked: {
    subject: "موعد استشارتك في التمويل العقاري: {{mortgage_consultation_when}}",
    body: [
      "<p>مرحباً {{lead_first_name}}،</p>",
      "<p>تم حجز استشارتك في التمويل العقاري مع {{mortgage_adviser}}.</p>",
      "<ul>",
      "<li><p>الموعد: <strong>{{mortgage_consultation_when}}</strong> (بتوقيت الإمارات)</p></li>",
      "<li><p>الطريقة: {{mortgage_consultation_format}}</p></li>",
      "<li><p>المدة: {{mortgage_consultation_duration}}</p></li>",
      "<li><p>الرقم المرجعي: {{mortgage_reference}}</p></li>",
      "</ul>",
      "<p>دعوة التقويم مرفقة — افتحها لإضافة الاستشارة إلى تقويمك.</p>",
      "<p>إن لم يعد الموعد مناسباً لك، يكفي الرد على هذه الرسالة وسنجد موعداً آخر.</p>",
      "<p>— فريق التمويل العقاري في بازار</p>",
    ].join(""),
  },
  mortgage_preapproval_invite: {
    subject: "رابطك الآمن لتقديم طلب الموافقة المبدئية السريعة",
    body: [
      "<p>مرحباً {{lead_first_name}}،</p>",
      "<p>وصلك من {{mortgage_adviser}} رابط آمن لتقديم طلب الموافقة المبدئية السريعة مع بازار.</p>",
      "<p>تنتقل بياناتك من طلب الاستشارة ({{mortgage_reference}}) تلقائياً، فلن تحتاج إلا إلى رفع مستنداتك.</p>",
      '<a data-email-button="" href="{{mortgage_secure_url}}">ابدأ طلبك</a>',
      "<p>قبل الرفع، سنرسل إليك رمزاً للتأكد من هويتك.</p>",
      "<p>يعمل الرابط حتى <strong>{{mortgage_link_expires}}</strong>. وهو خاص بك، فيُرجى عدم إعادة توجيه هذه الرسالة.</p>",
      "<p>— فريق التمويل العقاري في بازار</p>",
    ].join(""),
  },
  // The re-upload request (0146). The adviser stays out of the verb again:
  // the document needs another look "at the request of" them.
  mortgage_reupload_request: {
    subject: "أحد مستنداتك يحتاج إلى نظرة أخرى — {{mortgage_reference}}",
    body: [
      "<p>مرحباً {{lead_first_name}}،</p>",
      "<p>بطلب من {{mortgage_adviser}}، يحتاج أحد مستندات طلبك {{mortgage_reference}} إلى نظرة أخرى: <strong>{{mortgage_document}}</strong>.</p>",
      "<p>{{mortgage_adviser_message}}</p>",
      "<p>طلبك متوقف مؤقتاً إلى أن يصلنا المستند. وتبقى المستندات التي سبق أن قبلناها مقبولة.</p>",
      '<a data-email-button="" href="{{mortgage_secure_url}}">ارفع مستندك</a>',
      "<p>قبل الرفع، سنرسل إليك رمزاً للتأكد من هويتك.</p>",
      "<p>يعمل الرابط حتى <strong>{{mortgage_link_expires}}</strong>. وهو خاص بك، فيُرجى عدم إعادة توجيه هذه الرسالة.</p>",
      "<p>— فريق التمويل العقاري في بازار</p>",
    ].join(""),
  },
  mortgage_code: {
    subject: "رمز التحقق من بازار",
    body: [
      "<p>مرحباً {{lead_first_name}}،</p>",
      "<p>استخدم هذا الرمز لفتح رابطك الآمن:</p>",
      "<h2>{{verification_code}}</h2>",
      "<p>تنتهي صلاحيته خلال {{mortgage_code_expires_in}}.</p>",
      "<p>إن لم تطلبه، يمكنك تجاهل هذه الرسالة — لا يمكن لأحد فتح طلبك من دون هذا الرمز.</p>",
      "<p>— فريق التمويل العقاري في بازار</p>",
    ].join(""),
  },
  // Partner banks (0150). Their send paths pass no language, so these go in
  // English; the Arabic is here because every system email has one, as the
  // team alerts' is. A bank is addressed in the plural, and the application
  // "reaches you from" the adviser, so no verb agrees with the adviser.
  mortgage_bank_package: {
    subject: "ملف طلب الموافقة المبدئية السريعة {{mortgage_reference}} من بازار",
    body: [
      "<p>تحية طيبة إلى فريق {{mortgage_bank}}،</p>",
      "<p>وصلكم من {{mortgage_adviser}}، من فريق التمويل العقاري في بازار، طلب للموافقة المبدئية السريعة: ملخص منظّم و{{mortgage_document_count}}.</p>",
      '<a data-email-button="" href="{{mortgage_package_url}}">فتح الملف</a>',
      "<p>يعمل الرابط حتى <strong>{{mortgage_link_expires}}</strong>. ويُسجَّل كل فتح وكل تنزيل.</p>",
      "<p>للتواصل مع {{mortgage_adviser}}، يكفي الرد على هذه الرسالة.</p>",
      "<p>— فريق التمويل العقاري في بازار</p>",
    ].join(""),
  },
  mortgage_bank_reminder: {
    subject: "تذكير: ملف طلب الموافقة المبدئية السريعة {{mortgage_reference}}",
    body: [
      "<p>تحية طيبة إلى فريق {{mortgage_bank}}،</p>",
      "<p>نذكّركم بطلب الموافقة المبدئية السريعة {{mortgage_reference}} الذي وصلكم من {{mortgage_adviser}} في {{mortgage_package_sent}}. ونتطلع إلى ردّكم.</p>",
      "<p>إليكم رابطاً جديداً يعمل حتى <strong>{{mortgage_link_expires}}</strong>.</p>",
      '<a data-email-button="" href="{{mortgage_package_url}}">فتح الملف</a>',
      "<p>يُسجَّل كل فتح وكل تنزيل.</p>",
      "<p>للتواصل مع {{mortgage_adviser}}، يكفي الرد على هذه الرسالة.</p>",
      "<p>— فريق التمويل العقاري في بازار</p>",
    ].join(""),
  },
  // The decision (0148, 0150). No verb agrees with the adviser: a message
  // "reaches you from" them. Both outcomes share one subject, "an update",
  // so a lock screen tells neither apart.
  mortgage_decision_pre_approved: {
    subject: "تحديث بشأن طلبك للموافقة المبدئية السريعة — {{mortgage_reference}}",
    body: [
      "<p>مرحباً {{lead_first_name}}،</p>",
      "<p>وصلتك رسالة من {{mortgage_adviser}}، من فريق التمويل العقاري في بازار، بخصوص طلبك للموافقة المبدئية السريعة {{mortgage_reference}}.</p>",
      "<p>{{mortgage_adviser_message}}</p>",
      "<p>مرفق بهذه الرسالة خطاب موافقتك المبدئية الصادر عن {{mortgage_bank}}.</p>",
      `<p>يمكنك الرد على هذه الرسالة للتواصل مع {{mortgage_adviser}} مباشرةً، أو الاتصال بفريق التمويل العقاري على ${MORTGAGE_TEAM_PHONE}.</p>`,
      "<p>— فريق التمويل العقاري في بازار</p>",
    ].join(""),
  },
  mortgage_decision_declined: {
    subject: "تحديث بشأن طلبك للموافقة المبدئية السريعة — {{mortgage_reference}}",
    body: [
      "<p>مرحباً {{lead_first_name}}،</p>",
      "<p>وصلتك رسالة من {{mortgage_adviser}}، من فريق التمويل العقاري في بازار، بخصوص طلبك للموافقة المبدئية السريعة {{mortgage_reference}}.</p>",
      "<p>{{mortgage_adviser_message}}</p>",
      `<p>يمكنك الرد على هذه الرسالة للتواصل مع {{mortgage_adviser}} مباشرةً، أو الاتصال بفريق التمويل العقاري على ${MORTGAGE_TEAM_PHONE}.</p>`,
      "<p>— فريق التمويل العقاري في بازار</p>",
    ].join(""),
  },
  valuation_request_ack: {
    subject: "تقييم عقارك قيد المراجعة",
    body: [
      "<p>مرحباً {{lead_first_name}}،</p>",
      "<p>شكراً لمشاركتك تفاصيل <strong>{{valuation_property}}</strong>.</p>",
      "<p>{{valuation_range_panel}}</p>",
      "<p>سيراجع أحد كبار المستشارين هذا التقدير ويرسل لك الرقم النهائي خلال <strong>٢٤ ساعة</strong>. لا التزام عليك — ولا ضغط للإدراج.</p>",
      "<p>— بازار</p>",
    ].join(""),
  },
  valuation_code: {
    subject: "رمز تقييم بازار: {{verification_code}}",
    body: [
      "<p>رمز الدخول لمرة واحدة:</p>",
      "<h2>{{verification_code}}</h2>",
      "<p>ينتهي خلال ١٠ دقائق. إن لم تطلبه، يمكنك تجاهل هذه الرسالة.</p>",
      "<p>— بازار العقارية</p>",
    ].join(""),
  },
  valuation_report_requested: {
    subject: "تقرير التقييم في طريقه إليك",
    body: [
      "<p>شكراً لتأكيد بريدك.</p>",
      "<p>سيراجع أحد مستشاري بازار تفاصيل عقارك، ويقارن التقدير الفوري بأحدث الصفقات المماثلة، ثم يرسل لك التقرير الكامل خلال ٢٤ ساعة.</p>",
      "<p>لديك سؤال في هذه الأثناء؟ يكفي الرد على هذه الرسالة.</p>",
      "<p>— بازار العقارية</p>",
    ].join(""),
  },
  valuation_report: {
    subject: "تقييم بازار لعقارك: {{valuation_final}}",
    body: [
      "<p>مرحباً {{lead_first_name}}،</p>",
      "<p>هذا هو التقييم النهائي لـ <strong>{{valuation_property}}</strong>.</p>",
      "<p>{{valuation_report_panel}}</p>",
      "<blockquote><p>{{advisor_notes}}</p></blockquote>",
      '<p>إن رغبت بمناقشة الرقم أو ما سيبدو عليه الإدراج، يكفي الرد على هذه الرسالة أو <a href="{{contact_url}}">حجز مكالمة</a>.</p>',
      "<p>— {{advisor_name}}، بازار العقارية</p>",
    ].join(""),
  },
  valuation_nurture_day7: {
    subject: "كيف وجدت التقييم؟",
    body: [
      "<p>مرحباً {{lead_first_name}}،</p>",
      "<p>مضى أسبوع على إرسال تقييم بازار لعقارك. بلغ تقدير مستشارنا {{valuation_midpoint}}.</p>",
      "<p>إن أردت مناقشة الخطوة التالية — استراتيجية الإدراج، أو عروضاً خاصة خارج السوق، أو إعادة التقييم عند سعر مختلف — يكفي الرد هنا.</p>",
      '<p><a href="{{contact_url}}">تحدّث إلى مستشار ←</a></p>',
      "<p>— بازار</p>",
    ].join(""),
  },
  valuation_nurture_day30: {
    subject: "تحديث السوق لوحدتك في أبوظبي",
    body: [
      "<p>مرحباً {{lead_first_name}}،</p>",
      '<p>مضى شهر على تقييم عقارك — ننشر قراءة شهرية لسوق أبوظبي على <a href="{{insights_url}}">رؤى بازار</a>.</p>',
      "<p>إن تغيّر رأيك في البيع، أو أردت تقييماً محدّثاً، يكفي الرد هنا.</p>",
      "<p>— بازار</p>",
    ].join(""),
  },
  newsletter_confirmation: {
    subject: "أكّد اشتراكك في نشرة بازار",
    body: [
      "<p>مرحباً،</p>",
      "<p>تفصلك نقرة واحدة عن الاشتراك في <strong>نشرة بازار</strong> — موجزنا الأسبوعي عن سوق أبوظبي.</p>",
      '<a data-email-button="" href="{{confirm_url}}">تأكيد الاشتراك</a>',
      "<p>إن لم تطلب هذا الاشتراك، تجاهل الرسالة — لن نضيفك إلى القائمة.</p>",
    ].join(""),
  },
  newsletter_welcome: {
    subject: "أهلاً بك في نشرة بازار",
    body: [
      "<h2>أهلاً بك في نشرة بازار.</h2>",
      "<p>كل أربعاء نرسل رسالة واحدة قصيرة: رسم بياني عن السوق، وملاحظة من مستشارينا، وعرضاً خارج السوق يستحق النظر.</p>",
      '<p>يمكنك <a href="{{unsubscribe_url}}">إلغاء الاشتراك</a> في أي وقت.</p>',
    ].join(""),
  },
  staff_invitation: {
    subject: "دعوة للانضمام إلى بازار بصفة {{staff_role}}",
    body: [
      "<p>مرحباً {{staff_name}}،</p>",
      "<p>دعاك <strong>{{sender_name}}</strong> إلى لوحة تحكم بازار العقارية بصفة <strong>{{staff_role}}</strong>.</p>",
      '<a data-email-button="" href="{{password_url}}">اختر كلمة المرور</a>',
      "<p>الرابط صالح لمدة {{link_valid_days}} يوماً.</p>",
      "<p>— بازار</p>",
    ].join(""),
  },
  staff_password_reset: {
    subject: "تعيين كلمة مرور جديدة لحسابك في لوحة بازار",
    body: [
      "<p>مرحباً {{staff_name}}،</p>",
      "<p>أرسل لك <strong>{{sender_name}}</strong> رابطاً لتعيين كلمة مرور جديدة للوحة تحكم بازار.</p>",
      '<a data-email-button="" href="{{password_url}}">تعيين كلمة مرور جديدة</a>',
      "<p>صالح لمدة {{link_valid_days}} يوماً، ولمرة واحدة. إن لم تكن تتوقع هذه الرسالة، أبلغ المسؤول — كلمة مرورك الحالية تبقى صالحة حتى تختار غيرها.</p>",
      "<p>— بازار</p>",
    ].join(""),
  },
  enquiry_escalation: {
    subject: "تصعيد · طلب من {{lead_name}} دون مستشار منذ {{minutes_waiting}} دقيقة",
    body: [
      "<p>مرحباً {{staff_name}}،</p>",
      "<p>طلب من <strong>{{lead_name}}</strong> ينتظر منذ <strong>{{minutes_waiting}} دقيقة</strong> دون مستشار مُسند.</p>",
      "<p>{{property_line}}</p>",
      '<a data-email-button="" href="{{enquiry_url}}">فتح الطلب</a>',
      "<p>— محرّك العملاء في بازار</p>",
    ].join(""),
  },
  // The mortgage team's alerts. Their send paths pass no language, so these
  // always go in English; the Arabic is here because every system email has
  // one, and so the Arabic tab opens on a sentence like the others do.
  mortgage_team_new_request: {
    subject: "طلب جديد · {{mortgage_service}} · {{mortgage_reference}}",
    body: [
      "<p>وصل طلب تمويل عقاري جديد.</p>",
      "<ul>",
      "<li><p>الرقم المرجعي: <strong>{{mortgage_reference}}</strong></p></li>",
      "<li><p>الخدمة: {{mortgage_service}}</p></li>",
      "<li><p>وقت الاستلام: {{mortgage_submitted}}</p></li>",
      "<li><p>المسؤول عن الطلب: {{mortgage_owner}}</p></li>",
      "</ul>",
      '<a data-email-button="" href="{{mortgage_request_url}}">فتح الطلب</a>',
      "<p>بيانات مقدّم الطلب في نظام بازار، وليست في هذه الرسالة.</p>",
      "<p>— نظام بازار</p>",
    ].join(""),
  },
  mortgage_team_at_risk: {
    subject: "معرّض للتأخير · {{mortgage_reference}} · الوقت المتبقي {{mortgage_remaining}}",
    body: [
      "<p>تبقّى لهذا الطلب <strong>{{mortgage_remaining}}</strong> من وقت العمل قبل أن يحين الموعد الذي وعدنا به مقدّم الطلب.</p>",
      "<ul>",
      "<li><p>الرقم المرجعي: <strong>{{mortgage_reference}}</strong></p></li>",
      "<li><p>الخدمة: {{mortgage_service}}</p></li>",
      "<li><p>موعد الاستحقاق: {{mortgage_due}}</p></li>",
      "</ul>",
      '<a data-email-button="" href="{{mortgage_request_url}}">فتح الطلب</a>',
      "<p>— نظام بازار</p>",
    ].join(""),
  },
  mortgage_team_breached: {
    subject: "تجاوز المهلة الموعودة · {{mortgage_reference}}",
    body: [
      "<p>تجاوز هذا الطلب الموعد الذي وعدنا به مقدّم الطلب، ولا قرار بعد.</p>",
      "<ul>",
      "<li><p>الرقم المرجعي: <strong>{{mortgage_reference}}</strong></p></li>",
      "<li><p>الخدمة: {{mortgage_service}}</p></li>",
      "<li><p>كان موعد الاستحقاق: {{mortgage_due}}</p></li>",
      "</ul>",
      "<p>وُعد مقدّم الطلب بالتواصل قبل هذا الموعد. إن احتاج القرار إلى وقت أطول، فيُرجى إبلاغ مقدّم الطلب بذلك.</p>",
      '<a data-email-button="" href="{{mortgage_request_url}}">فتح الطلب</a>',
      "<p>— نظام بازار</p>",
    ].join(""),
  },
  mortgage_team_reupload_received: {
    subject: "وصل المستند المطلوب · {{mortgage_reference}}",
    body: [
      "<p>وصل مستند أُعيد رفعه.</p>",
      "<ul>",
      "<li><p>الرقم المرجعي: <strong>{{mortgage_reference}}</strong></p></li>",
      "<li><p>الخدمة: {{mortgage_service}}</p></li>",
      "<li><p>المستند: {{mortgage_document}}</p></li>",
      "<li><p>الملفات المرفوعة: {{mortgage_files}}</p></li>",
      "</ul>",
      "<p>عاد الطلب إلى المراجعة، واستُؤنف احتساب المهلة التي وعدنا بها مقدّم الطلب.</p>",
      '<a data-email-button="" href="{{mortgage_request_url}}">فتح الطلب</a>',
      "<p>— نظام بازار</p>",
    ].join(""),
  },
  permit_expiry_warning: {
    subject: "تصريح {{permit_number}} ({{property_reference}}) ينتهي خلال {{days_to_expiry}} يوماً",
    body: [
      "<p>مرحباً،</p>",
      "<p>تصريح الإدراج {{permit_number}} للعقار <strong>{{property_reference}}</strong> ينتهي في <strong>{{permit_expires_on}}</strong> (خلال {{days_to_expiry}} يوماً).</p>",
      "<p>سيُؤرشف الإدراج تلقائياً عند انتهاء التصريح ما لم يُجدَّد.</p>",
      '<a data-email-button="" href="{{properties_url}}">فتح قائمة العقارات</a>',
      "<p>— الالتزام في بازار</p>",
    ].join(""),
  },
  health_digest: {
    subject: "حالة بازار · هناك ما يستدعي المراجعة",
    body: [
      "<p>أظهرت آخر ٢٤ ساعة ما يلي.</p>",
      "<p><strong>الأخطاء</strong></p>",
      "<p>{{health_errors}}</p>",
      "<p><strong>المهام</strong></p>",
      "<p>{{health_jobs}}</p>",
      '<a data-email-button="" href="{{health_url}}">افتح صفحة الحالة</a>',
      "<p>— نظام بازار</p>",
    ].join(""),
  },
  bulk_reassign_digest: {
    subject: "أُسندت إليك {{listings_assigned}}",
    body: [
      "<p>مرحباً {{staff_name}}،</p>",
      "<p>أسندنا إليك للتو <strong>{{listings_assigned}}</strong> في نظام بازار.</p>",
      "<p>{{listing_references}}</p>",
      '<a data-email-button="" href="{{queue_url}}">فتح قائمتي</a>',
      "<p>— نظام بازار</p>",
    ].join(""),
  },
  form_submission_notification: {
    subject: "طلب جديد من {{form_name}} · {{form_surface}}",
    body: [
      "<p><strong>{{form_name}}</strong></p>",
      "<p>{{form_surface}}</p>",
      "<p>{{form_answers}}</p>",
      '<p><a href="{{enquiry_url}}">فتح الطلب</a> · <a href="{{responses_url}}">كل الردود</a></p>',
    ].join(""),
  },
};
