/**
 * Token substitution for content assets.
 *
 * An asset body is copy with `{{placeholders}}`:
 *
 *   "Thank you for your enquiry about {{property_title}} ({{property_reference}})."
 *
 * Three rules the rest of the feature depends on:
 *
 *  1. The token vocabulary is CLOSED. `TOKENS` below is the whole list, the
 *     editor refuses to save an unknown one, and the picker in the enquiry
 *     composer only ever renders these. A typo'd `{{propery_ref}}` reaching a
 *     client is the failure mode this prevents.
 *
 *  2. A known token with no value falls back to neutral wording rather than
 *     leaving a hole. An enquiry with no property attached still produces a
 *     sendable sentence.
 *
 *  3. Fallbacks are a safety net, not a feature. `missingTokens()` reports
 *     which ones fired so the composer can warn the advisor *before* sending,
 *     with the resolved text on screen. Nobody should discover a fallback by
 *     reading it in a sent message.
 */

/**
 * The language an email is being written in or sent in.
 *
 * Narrower than `Locale` on purpose: this is about one email's copy, and an
 * import of the routing locale here would tie the send path to next-intl.
 */
export type EmailLocale = "en" | "ar";

export type TokenName =
  | "lead_first_name"
  | "lead_name"
  | "property_reference"
  | "property_title"
  | "advisor_name"
  | "advisor_phone"
  | "site_url"
  // System-email tokens. Only meaningful inside the system asset that
  // supplies them — see `scope` below and lib/content-assets/system.ts.
  | "property_line"
  | "enquiry_message"
  | "valuation_property"
  | "valuation_range"
  | "valuation_midpoint"
  | "valuation_final"
  | "valuation_initial_range"
  | "advisor_notes"
  | "verification_code"
  | "contact_url"
  | "insights_url"
  | "viewing_time"
  | "viewing_location"
  | "viewing_duration"
  | "confirm_url"
  | "unsubscribe_url"
  | "staff_name"
  | "sender_name"
  | "staff_role"
  | "password_url"
  | "link_valid_days"
  | "minutes_waiting"
  | "enquiry_url"
  | "permit_number"
  | "permit_expires_on"
  | "days_to_expiry"
  | "properties_url"
  | "listings_assigned"
  | "queue_url"
  | "form_name"
  | "form_surface"
  | "source_path"
  | "responses_url"
  | "mortgage_reference"
  | "mortgage_submitted"
  | "mortgage_due"
  | "mortgage_service"
  | "mortgage_owner"
  | "mortgage_remaining"
  | "mortgage_request_url"
  | "mortgage_consultation_when"
  | "mortgage_consultation_format"
  | "mortgage_consultation_duration"
  | "mortgage_adviser"
  | "mortgage_secure_url"
  | "mortgage_link_expires"
  | "mortgage_document"
  | "mortgage_files"
  | "mortgage_code_expires_in"
  | "mortgage_bank"
  | "mortgage_document_count"
  | "mortgage_package_sent"
  | "mortgage_package_url"
  // Block tokens: a whole pre-built panel, not a word. See `kind`.
  | "valuation_range_panel"
  | "valuation_report_panel"
  | "listing_references"
  | "health_errors"
  | "health_jobs"
  | "health_url"
  | "form_answers"
  | "mortgage_documents"
  | "mortgage_adviser_message";

/**
 * `shared` tokens describe a lead and are offered in every asset. `system`
 * tokens are only filled by one particular system email — `{{viewing_time}}`
 * has no value when an advisor writes a general follow-up, so offering it
 * there would be an invitation to a fallback in a sent message.
 */
export type TokenScope = "shared" | "system";

/**
 * What a token stands for once rendered.
 *
 *  · `text`  — words, dropped into a sentence.
 *  · `url`   — an address. Also text, but the only kind the rich-text editor
 *              offers as the target of a link or a button.
 *  · `block` — a pre-built panel: the valuation figure, the table of form
 *              answers. It is drawn by the same code the built-in email uses,
 *              so an editor who rewrites the words around it keeps the panel.
 *              Placed on a line of its own; its plain-text part is a few lines.
 */
export type TokenKind = "text" | "url" | "block";

export type TokenDef = {
  name: TokenName;
  label: string;
  /** Shown in the editor so copy can be judged in context. */
  sample: string;
  /**
   * The sample and the fallback in Arabic.
   *
   * A token has ONE value at send time — the lead's own name is not
   * translated — so these exist for the two strings the code itself supplies:
   * the neutral wording a missing value falls back to ("there" → "عزيزي
   * المتواصل"), and the example the editor previews against. Absent means the
   * English serves both, which is right for a reference, a code or a URL.
   */
  sampleAr?: string;
  fallbackAr?: string;
  /**
   * Used when the real value is absent at send time. An empty fallback makes
   * the token vanish — and a paragraph left with nothing in it is dropped from
   * a system email, which is how "For BAZ-AD-04891 · 3-bed" disappears from an
   * enquiry that never named a property.
   */
  fallback: string;
  scope: TokenScope;
  kind: TokenKind;
};

export const TOKENS: readonly TokenDef[] = [
  {
    name: "lead_first_name",
    label: "Lead first name",
    sample: "Amira",
    sampleAr: "أميرة",
    fallbackAr: "عزيزنا",
    fallback: "there",
    scope: "shared",
    kind: "text",
  },
  {
    name: "lead_name",
    label: "Lead full name",
    sample: "Amira Haddad",
    sampleAr: "أميرة حداد",
    fallbackAr: "عزيزنا",
    fallback: "there",
    scope: "shared",
    kind: "text",
  },
  {
    name: "property_reference",
    label: "Property reference",
    sample: "BAZ-AD-04891",
    fallbackAr: "طلبك",
    fallback: "your enquiry",
    scope: "shared",
    kind: "text",
  },
  {
    name: "property_title",
    label: "Property title",
    sample: "3-bed on Al Reem Island",
    sampleAr: "شقة بثلاث غرف في جزيرة الريم",
    fallbackAr: "العقار الذي سألت عنه",
    fallback: "the property you asked about",
    scope: "shared",
    kind: "text",
  },
  {
    name: "advisor_name",
    label: "Advisor name",
    sample: "Khalid Al Zaabi",
    sampleAr: "خالد الزعابي",
    fallbackAr: "مستشارك في بازار",
    fallback: "your Bazar advisor",
    scope: "shared",
    kind: "text",
  },
  {
    name: "advisor_phone",
    label: "Advisor phone",
    sample: "+971 54 737 0776",
    fallbackAr: "الرقم الوارد في التوقيع",
    fallback: "the number in my signature",
    scope: "shared",
    kind: "text",
  },
  {
    name: "site_url",
    label: "Site URL",
    sample: "https://www.bazarrealestate.ae",
    fallback: "https://www.bazarrealestate.ae",
    scope: "shared",
    kind: "url",
  },
  {
    name: "property_line",
    label: "Property line (only when a listing was named)",
    sample: "For BAZ-AD-04891 · 3-bed on Al Reem Island",
    sampleAr: "بخصوص BAZ-AD-04891 · شقة بثلاث غرف في جزيرة الريم",
    fallback: "",
    scope: "system",
    kind: "text",
  },
  {
    name: "enquiry_message",
    label: "What the lead wrote",
    sample: "Is the 3-bed still available for a September move?",
    sampleAr: "هل ما زالت الشقة متاحة للانتقال في سبتمبر؟",
    fallbackAr: "رسالتك",
    fallback: "your message",
    scope: "system",
    kind: "text",
  },
  {
    name: "valuation_property",
    label: "Valued property",
    sample: "Marina Heights · Al Reem Island",
    sampleAr: "مارينا هايتس · جزيرة الريم",
    fallbackAr: "عقارك",
    fallback: "your property",
    scope: "system",
    kind: "text",
  },
  {
    name: "valuation_range",
    label: "Instant valuation range",
    sample: "AED 2.1M – AED 2.6M",
    fallbackAr: "النطاق الوارد في تقريرك",
    fallback: "the range in your report",
    scope: "system",
    kind: "text",
  },
  {
    name: "valuation_midpoint",
    label: "Valuation midpoint",
    sample: "AED 2.3M",
    fallbackAr: "متوسط القيمة في تقريرك",
    fallback: "the midpoint in your report",
    scope: "system",
    kind: "text",
  },
  {
    name: "valuation_final",
    label: "Refined valuation",
    sample: "AED 2.45M",
    fallbackAr: "الرقم الوارد في تقريرك",
    fallback: "the figure in your report",
    scope: "system",
    kind: "text",
  },
  {
    name: "valuation_initial_range",
    label: "Initial instant range (only if there was one)",
    sample: "AED 2.1M–AED 2.6M",
    fallback: "",
    scope: "system",
    kind: "text",
  },
  {
    name: "advisor_notes",
    label: "Advisor's notes (only if written)",
    sample:
      "Two recent sales on the same floor closed at AED 2.4M and AED 2.5M.",
    sampleAr: "أُغلقت صفقتان في الطابق نفسه عند ٢٫٤ و٢٫٥ مليون درهم.",
    fallback: "",
    scope: "system",
    kind: "text",
  },
  {
    name: "verification_code",
    label: "One-time code",
    sample: "482913",
    fallbackAr: "الرمز الظاهر على الشاشة",
    fallback: "the code on screen",
    scope: "system",
    kind: "text",
  },
  {
    name: "contact_url",
    label: "Contact page link",
    sample: "https://www.bazarrealestate.ae/contact",
    fallback: "https://www.bazarrealestate.ae/contact",
    scope: "system",
    kind: "url",
  },
  {
    name: "insights_url",
    label: "Insights page link",
    sample: "https://www.bazarrealestate.ae/insights",
    fallback: "https://www.bazarrealestate.ae/insights",
    scope: "system",
    kind: "url",
  },
  {
    name: "viewing_time",
    label: "Viewing time",
    sample: "Thursday 4 September, 4:30 pm",
    sampleAr: "الخميس ١٨ سبتمبر، ٤:٣٠ مساءً",
    fallbackAr: "الموعد المتفق عليه",
    fallback: "the time we agreed",
    scope: "system",
    kind: "text",
  },
  {
    name: "viewing_location",
    label: "Viewing location",
    sample: "Marina Heights lobby, Al Reem Island",
    sampleAr: "بهو مارينا هايتس، جزيرة الريم",
    fallbackAr: "نقطة اللقاء التي أرسلناها إليك",
    fallback: "the meeting point we sent you",
    scope: "system",
    kind: "text",
  },
  {
    name: "viewing_duration",
    label: "Viewing duration",
    sample: "45 minutes",
    sampleAr: "٤٥ دقيقة",
    fallbackAr: "نحو ٤٥ دقيقة",
    fallback: "about 45 minutes",
    scope: "system",
    kind: "text",
  },
  {
    name: "confirm_url",
    label: "Confirm subscription link",
    sample: "https://www.bazarrealestate.ae/newsletter/confirm/9f2c…",
    fallback: "https://www.bazarrealestate.ae",
    scope: "system",
    kind: "url",
  },
  {
    name: "unsubscribe_url",
    label: "Unsubscribe link",
    sample: "https://www.bazarrealestate.ae/newsletter/unsubscribe/9f2c…",
    fallback: "https://www.bazarrealestate.ae",
    scope: "system",
    kind: "url",
  },
  {
    name: "staff_name",
    label: "Staff member's first name",
    sample: "Layla",
    sampleAr: "ليلى",
    fallbackAr: "زميلنا",
    fallback: "there",
    scope: "system",
    kind: "text",
  },
  {
    name: "sender_name",
    label: "Who sent it",
    sample: "Omar Farouk",
    sampleAr: "عمر فاروق",
    fallbackAr: "أحد المسؤولين",
    fallback: "An administrator",
    scope: "system",
    kind: "text",
  },
  {
    name: "staff_role",
    label: "Role",
    sample: "editor",
    sampleAr: "محرر",
    fallbackAr: "عضو في الفريق",
    fallback: "a team member",
    scope: "system",
    kind: "text",
  },
  {
    name: "password_url",
    label: "Set-password link",
    sample: "https://www.bazarrealestate.ae/staff-invite?token=…",
    fallback: "https://www.bazarrealestate.ae/forgot-password",
    scope: "system",
    kind: "url",
  },
  {
    name: "link_valid_days",
    label: "Days the link stays valid",
    sample: "14",
    fallbackAr: "عدة",
    fallback: "a few",
    scope: "system",
    kind: "text",
  },
  {
    name: "minutes_waiting",
    label: "Minutes unassigned",
    sample: "60",
    fallbackAr: "أكثر من ٦٠",
    fallback: "over 60",
    scope: "system",
    kind: "text",
  },
  {
    name: "enquiry_url",
    label: "Enquiry link (admin)",
    sample: "https://www.bazarrealestate.ae/admin/enquiries/5d1e…",
    fallback: "https://www.bazarrealestate.ae/admin/enquiries",
    scope: "system",
    kind: "url",
  },
  {
    name: "permit_number",
    label: "Permit number",
    sample: "71220458",
    fallbackAr: "التصريح",
    fallback: "the permit",
    scope: "system",
    kind: "text",
  },
  {
    name: "permit_expires_on",
    label: "Permit expiry date",
    sample: "2026-10-14",
    fallbackAr: "قريباً",
    fallback: "soon",
    scope: "system",
    kind: "text",
  },
  {
    name: "days_to_expiry",
    label: "Days to expiry",
    sample: "30",
    fallbackAr: "عدة",
    fallback: "a few",
    scope: "system",
    kind: "text",
  },
  {
    name: "properties_url",
    label: "Properties list link (admin)",
    sample: "https://www.bazarrealestate.ae/admin/properties?status=published",
    fallback: "https://www.bazarrealestate.ae/admin/properties",
    scope: "system",
    kind: "url",
  },
  {
    name: "listings_assigned",
    label: "Listings assigned (\"3 listings\")",
    sample: "3 listings",
    sampleAr: "٣ عقارات",
    fallbackAr: "عقارات جديدة",
    fallback: "new listings",
    scope: "system",
    kind: "text",
  },
  {
    name: "queue_url",
    label: "My queue link (admin)",
    sample: "https://www.bazarrealestate.ae/admin/properties?assigned=me",
    fallback: "https://www.bazarrealestate.ae/admin/properties",
    scope: "system",
    kind: "url",
  },
  {
    name: "form_name",
    label: "Form name",
    sample: "Mortgage pre-approval",
    sampleAr: "طلب موافقة مبدئية",
    fallbackAr: "أحد النماذج",
    fallback: "A form",
    scope: "system",
    kind: "text",
  },
  {
    name: "form_surface",
    label: "Where the form sits",
    sample: "Mortgage calculator",
    sampleAr: "حاسبة التمويل العقاري",
    fallbackAr: "الموقع",
    fallback: "Website",
    scope: "system",
    kind: "text",
  },
  {
    name: "source_path",
    label: "Page it was sent from (only when known)",
    sample: "/tools/mortgage",
    fallback: "",
    scope: "system",
    kind: "text",
  },
  {
    name: "responses_url",
    label: "All responses link (admin)",
    sample: "https://www.bazarrealestate.ae/admin/forms/mortgage_preapproval",
    fallback: "https://www.bazarrealestate.ae/admin/forms",
    scope: "system",
    kind: "url",
  },
  // The mortgage flow's confirmations. Times are Asia/Dubai, printed by
  // lib/mortgage-requests/format.ts exactly as the confirmation page prints
  // them, so the email and the screen the applicant just left agree. The
  // fallbacks are a net for a value the send path always has.
  {
    name: "mortgage_reference",
    label: "Mortgage request reference",
    sample: "BZM-26-0412",
    fallbackAr: "الرقم الظاهر في صفحة التأكيد",
    fallback: "the one on your confirmation page",
    scope: "system",
    kind: "text",
  },
  {
    name: "mortgage_submitted",
    label: "When the applicant submitted",
    sample: "Tue 22 Sep, 09:47",
    sampleAr: "الثلاثاء، 22 سبتمبر، 09:47",
    fallbackAr: "يوم إرساله",
    fallback: "the day you sent it",
    scope: "system",
    kind: "text",
  },
  {
    // The promise runs on WORKING hours (docs/mortgage/DECISIONS.md D11), so
    // this is rarely 24 clock hours after submission: a Tuesday 10:14
    // application is due Thursday 14:14. Copy around it says "working hours".
    name: "mortgage_due",
    label: "When we'll contact them by (24 working hours)",
    sample: "Thu 24 Sep, 14:14",
    sampleAr: "الخميس، 24 سبتمبر، 14:14",
    fallbackAr: "الموعد الظاهر في صفحة التأكيد",
    fallback: "the time on your confirmation page",
    scope: "system",
    kind: "text",
  },
  // The mortgage team's alerts (0144). They carry nothing about the
  // applicant — the reference, the service, the clock and a link to the
  // request in the CMS, where the team reads the rest — so the only name here
  // is a colleague's. The service's name is the one value with a language:
  // the context writes it in the language being drawn, as `property_line`'s
  // "For" is.
  {
    name: "mortgage_service",
    label: "Service (Fast Pre-Approval or Mortgage Consultancy)",
    sample: "Fast Pre-Approval",
    sampleAr: "الموافقة المبدئية السريعة",
    fallbackAr: "طلب تمويل عقاري",
    fallback: "mortgage request",
    scope: "system",
    kind: "text",
  },
  {
    // Null is a real value here, not a gap: a request nobody has claimed.
    name: "mortgage_owner",
    label: "Who owns the request (Unassigned when nobody does)",
    sample: "Rashid Khan",
    sampleAr: "راشد خان",
    fallbackAr: "غير مُسند",
    fallback: "Unassigned",
    scope: "system",
    kind: "text",
  },
  {
    // WORKING time, as sla.ts counts it: "1h 48m" at 18:30 on a Thursday is
    // not due by 20:18 that evening. The due time beside it is the instant.
    name: "mortgage_remaining",
    label: "Working time left on the promise",
    sample: "1h 48m",
    fallbackAr: "ساعات قليلة",
    fallback: "only a few hours",
    scope: "system",
    kind: "text",
  },
  {
    name: "mortgage_request_url",
    label: "Link to the request (admin)",
    sample: "https://www.bazarrealestate.ae/admin/mortgages/BZM-26-0412",
    fallback: "https://www.bazarrealestate.ae/admin/mortgages",
    scope: "system",
    kind: "url",
  },
  // The applicant's booking and invitation (0144). Times are Asia/Dubai,
  // printed by lib/mortgage-requests/format.ts like the confirmations'.
  {
    name: "mortgage_consultation_when",
    label: "Consultation day and time (UAE time)",
    sample: "Wed 23 Sep, 10:00",
    sampleAr: "الأربعاء، 23 سبتمبر، 10:00",
    fallbackAr: "الموعد الوارد في دعوة التقويم",
    fallback: "the time in your calendar invite",
    scope: "system",
    kind: "text",
  },
  {
    name: "mortgage_consultation_format",
    label: "Consultation format (phone, video or office)",
    sample: "Phone call",
    sampleAr: "مكالمة هاتفية",
    fallbackAr: "حسب الاتفاق",
    fallback: "as arranged",
    scope: "system",
    kind: "text",
  },
  {
    name: "mortgage_consultation_duration",
    label: "Consultation length",
    sample: "20 minutes",
    sampleAr: "20 دقيقة",
    fallbackAr: "كما في دعوة التقويم",
    fallback: "as in your calendar invite",
    scope: "system",
    kind: "text",
  },
  {
    name: "mortgage_adviser",
    label: "Mortgage adviser's name",
    sample: "Rashid Khan",
    sampleAr: "راشد خان",
    fallbackAr: "فريق التمويل العقاري في بازار",
    fallback: "Bazar's mortgage team",
    scope: "system",
    kind: "text",
  },
  {
    name: "mortgage_secure_url",
    label: "Secure link to apply (Fast Pre-Approval)",
    sample: "https://www.bazarrealestate.ae/mortgages/r/9f2c…",
    fallback: "https://www.bazarrealestate.ae",
    scope: "system",
    kind: "url",
  },
  {
    name: "mortgage_link_expires",
    label: "When the secure link expires",
    sample: "Wed 30 Sep, 10:00",
    sampleAr: "الأربعاء، 30 سبتمبر، 10:00",
    fallbackAr: "تاريخ انتهاء صلاحيته",
    fallback: "its expiry date",
    scope: "system",
    kind: "text",
  },
  // Reviewing the documents (0146): the re-upload request, the code that
  // opens a secure link, and the team's notice that the document is back.
  // The document's name is data — the send path passes it in the language
  // it sends in — while the counts are the code's own words, written in the
  // language being drawn.
  {
    name: "mortgage_document",
    label: "Document asked for (Last 1 year's bank statements)",
    sample: "Last 1 year's bank statements",
    sampleAr: "كشوف الحساب البنكية لآخر سنة",
    fallbackAr: "المستند المطلوب",
    fallback: "the requested document",
    scope: "system",
    kind: "text",
  },
  {
    name: "mortgage_files",
    label: "How many files the applicant sent (1 file, 3 files)",
    sample: "1 file",
    sampleAr: "ملف واحد",
    fallbackAr: "ملفات جديدة",
    fallback: "new files",
    scope: "system",
    kind: "text",
  },
  {
    name: "mortgage_code_expires_in",
    label: "How long the code works (10 minutes)",
    sample: "10 minutes",
    sampleAr: "10 دقائق",
    fallbackAr: "دقائق قليلة",
    fallback: "a few minutes",
    scope: "system",
    kind: "text",
  },
  // Partner banks and the pre-approval (0150). The bank's name is data, like
  // a reference: never translated. The count and the day are the code's own
  // words, written in the language being drawn. A bank email names no
  // applicant, so none of these describes one.
  {
    name: "mortgage_bank",
    label: "Partner bank's name",
    sample: "First Abu Dhabi Bank",
    fallbackAr: "البنك",
    fallback: "the bank",
    scope: "system",
    kind: "text",
  },
  {
    name: "mortgage_document_count",
    label: "How many documents the package holds (4 documents)",
    sample: "4 documents",
    sampleAr: "4 مستندات",
    fallbackAr: "مستنداته",
    fallback: "its documents",
    scope: "system",
    kind: "text",
  },
  {
    // Asia/Dubai, as every mortgage time is printed; a day, not a time.
    name: "mortgage_package_sent",
    label: "The day the package went to the bank",
    sample: "Wed 23 Sep",
    sampleAr: "الأربعاء، 23 سبتمبر",
    fallbackAr: "تاريخ سابق",
    fallback: "an earlier date",
    scope: "system",
    kind: "text",
  },
  {
    name: "mortgage_package_url",
    label: "Secure link to the package (for the bank)",
    sample: "https://www.bazarrealestate.ae/mortgages/p/9f2c…",
    fallback: "https://www.bazarrealestate.ae",
    scope: "system",
    kind: "url",
  },
  {
    name: "valuation_range_panel",
    label: "Instant range panel",
    sample: "[Instant range · AED 2.1M – AED 2.6M]",
    fallback: "",
    scope: "system",
    kind: "block",
  },
  {
    name: "valuation_report_panel",
    label: "Refined valuation panel",
    sample: "[Refined valuation · AED 2.45M]",
    fallback: "",
    scope: "system",
    kind: "block",
  },
  {
    name: "listing_references",
    label: "List of listing references",
    sample: "· BAZ-AD-04891\n· BAZ-AD-04902",
    sampleAr: "· BAZ-AD-04891\n· BAZ-AD-04902",
    fallback: "",
    scope: "system",
    kind: "block",
  },
  {
    name: "health_errors",
    label: "List of open errors",
    sample:
      "· cron/salesforce-lead-sync ×3 — REQUIRED_FIELD_MISSING: Email__c\n· forms/record — connection reset",
    sampleAr:
      "· cron/salesforce-lead-sync ×3 — REQUIRED_FIELD_MISSING: Email__c\n· forms/record — connection reset",
    fallback: "",
    scope: "system",
    kind: "block",
  },
  {
    name: "health_jobs",
    label: "List of late or failing jobs",
    sample: "· permit-expiry — last run 2d ago\n· meilisearch-sync — failing, 4 in a row",
    sampleAr: "· permit-expiry — last run 2d ago\n· meilisearch-sync — failing, 4 in a row",
    fallback: "",
    scope: "system",
    kind: "block",
  },
  {
    name: "health_url",
    label: "Link to the health page",
    sample: "https://www.bazarrealestate.ae/admin/settings/health",
    // Always resolvable — the site URL is known at send time — so this gets a
    // real fallback rather than the blank one a block token may use.
    fallback: "/admin/settings/health",
    scope: "system",
    kind: "text",
  },
  {
    name: "form_answers",
    label: "Table of answers",
    sample: "Name: Amira Haddad\nEmail: amira@example.com",
    sampleAr: "الاسم: أميرة حداد\nالبريد: amira@example.com",
    fallback: "",
    scope: "system",
    kind: "block",
  },
  {
    name: "mortgage_documents",
    label: "Documents received panel",
    sample: "· Emirates ID — 2 files\n· Passport copy — 1 file",
    sampleAr: "· الهوية الإماراتية — ملفان\n· نسخة جواز السفر — ملف واحد",
    fallback: "",
    scope: "system",
    kind: "block",
  },
  {
    // A panel so that every line of it is quoted, in both halves of the
    // email. The adviser's own words: escaped, never links or formatting,
    // and not translated — the Arabic preview quotes the same message.
    name: "mortgage_adviser_message",
    label: "The adviser's message, quoted",
    sample:
      "> Your statements cover September 2025 to May 2026.\n> For a full year, please add June, July and August 2026.",
    fallback: "",
    scope: "system",
    kind: "block",
  },
] as const;

const TOKEN_NAMES = new Set<string>(TOKENS.map((t) => t.name));
const TOKEN_BY_NAME = new Map<string, TokenDef>(TOKENS.map((t) => [t.name, t]));

/** The definition for a known token. */
export function tokenDef(name: TokenName): TokenDef {
  return TOKEN_BY_NAME.get(name)!;
}

/** Tokens every asset may use, system or hand-written. */
export const SHARED_TOKENS: readonly TokenDef[] = TOKENS.filter(
  (t) => t.scope === "shared",
);

/**
 * Matches `{{token}}` with optional inner padding. Deliberately NOT global —
 * a /g regex carries lastIndex between calls and would skip every other match
 * when reused. Callers that need all matches build their own with matchAll.
 */
const TOKEN_RE = /\{\{\s*([a-z_]+)\s*\}\}/i;

/** A fresh global copy of the token pattern, for replace/matchAll. */
export function tokenPattern(): RegExp {
  return new RegExp(TOKEN_RE, "gi");
}

function allTokens(body: string): string[] {
  return [...body.matchAll(tokenPattern())].map((m) => m[1].toLowerCase());
}

export function isTokenName(value: string): value is TokenName {
  return TOKEN_NAMES.has(value);
}

/** Every `{{token}}` in the body that isn't in the vocabulary. Deduped. */
export function unknownTokens(body: string): string[] {
  return [...new Set(allTokens(body).filter((t) => !TOKEN_NAMES.has(t)))];
}

/**
 * Known tokens the body uses that this asset is not allowed to use. A
 * `{{viewing_time}}` in a hand-written follow-up is spelled correctly and
 * still wrong — nothing on that send path fills it, so it would render as a
 * fallback every time. The rule the editor enforces is simply: a token you
 * can't insert is a token you can't save.
 */
export function outOfScopeTokens(
  body: string,
  allowed: readonly TokenName[],
): TokenName[] {
  const ok = new Set<string>(allowed);
  return usedTokens(body).filter((t) => !ok.has(t));
}

/** Every known token the body uses. Deduped, in first-appearance order. */
export function usedTokens(body: string): TokenName[] {
  return [...new Set(allTokens(body).filter(isTokenName))] as TokenName[];
}

export type TokenContext = Partial<Record<TokenName, string | null>>;

function hasValue(v: string | null | undefined): v is string {
  return v !== undefined && v !== null && v.trim() !== "";
}

/**
 * Known tokens the body uses that have no value in this context — i.e. the
 * ones that will render as a fallback. The composer surfaces these.
 */
export function missingTokens(body: string, ctx: TokenContext): TokenName[] {
  return usedTokens(body).filter((t) => !hasValue(ctx[t]));
}

/**
 * The value a token renders as: its context value, or its fallback. Unknown
 * names render as nothing.
 */
export function tokenValue(
  name: string,
  ctx: TokenContext,
  locale: EmailLocale = "en",
): string {
  const key = name.toLowerCase();
  if (!isTokenName(key)) return "";
  const value = ctx[key];
  // The value itself is never translated: a lead's name, a reference and a
  // figure are the same in both languages. Only the wording the CODE supplies
  // when there is no value has a language.
  if (hasValue(value)) return value;
  const def = TOKEN_BY_NAME.get(key);
  if (!def) return "";
  return locale === "ar" ? (def.fallbackAr ?? def.fallback) : def.fallback;
}

/**
 * Substitute tokens. Known tokens take their context value or fallback;
 * unknown tokens are stripped rather than sent as literal braces — the editor
 * blocks them at save, so anything reaching here is a bug, and a gap in a
 * sentence embarrasses less than `{{propery_ref}}`.
 */
export function renderTokens(
  body: string,
  ctx: TokenContext,
  locale: EmailLocale = "en",
): string {
  return body.replace(tokenPattern(), (_match, rawName: string) =>
    tokenValue(rawName, ctx, locale),
  );
}

/** Preview substitution using the sample values, for the editor. */
export function renderSample(body: string, locale: EmailLocale = "en"): string {
  return renderTokens(
    body,
    Object.fromEntries(
      TOKENS.map((t) => [t.name, locale === "ar" ? (t.sampleAr ?? t.sample) : t.sample]),
    ) as TokenContext,
    locale,
  );
}

/** The sample this token previews with, in the language being edited. */
export function tokenSample(def: TokenDef, locale: EmailLocale = "en"): string {
  return locale === "ar" ? (def.sampleAr ?? def.sample) : def.sample;
}
