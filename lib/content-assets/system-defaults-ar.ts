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
  viewing_confirmation: {
    subject: "موعد معاينة مبدئي · {{property_reference}}",
    body: [
      "<p>مرحباً {{lead_first_name}}،</p>",
      "<p>حجزنا لك موعد معاينة مبدئياً في <strong>{{viewing_time}}</strong> (توقيت أبوظبي).</p>",
      "<ul><li><p>العقار: {{property_reference}} · {{property_title}}</p></li><li><p>مكان اللقاء: {{viewing_location}}</p></li><li><p>المدة: {{viewing_duration}}</p></li></ul>",
      "<p>دعوة التقويم مرفقة — اقبلها لإضافة الموعد إلى تقويمك.</p>",
      "<p>إن لم يناسبك هذا الوقت، يكفي الرد وسنجد موعداً آخر.</p>",
      "<p>— بازار العقارية</p>",
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
