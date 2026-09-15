/**
 * The words every property listing page shares — the eyebrow and heading above
 * each band on `/p/<slug>`, the enquiry card around the form, the lead-advisor
 * card's label and button, the questions shown on every listing, and the
 * similar-listings rail.
 *
 * ## Why a registry rather than literals in the page
 *
 * These strings were English literals spread across the listing page and six
 * of its components. On `/ar/p/<slug>` the listing's own content — title,
 * description, area, amenities — rendered Arabic, and the frame around it did
 * not: "Advisor's note", "Specification · The full detail.", "Ask anything
 * about BAZ-AD-09790.", "Own elsewhere in الغدير?", "More in · Nearby
 * Properties", and three of the six FAQ answers, whole. A page that is Arabic
 * in its content and English in its headings reads as broken, not as partly
 * translated.
 *
 * The literals were also the only prose on the page the client could not
 * change without a deploy — "Common questions, plainly answered." and the
 * mortgage answer's LTV figures included.
 *
 * ## Why ONE document rather than one per listing
 *
 * Same reasoning as `developer-page.ts` and `development-page.ts`: these are
 * the template, identical on every listing, and the only per-listing parts —
 * the reference, the title, the area, the advisor, the property type — arrive
 * as tokens. A listing's own words are on its record, in the property editor.
 *
 * ## What is deliberately NOT here
 *
 *  - The four FAQ entries written from the listing's own facts (what a
 *    `{beds}`-bed `{type}` includes, where it is, whether a non-resident can
 *    buy it, how to verify its permit). They branch on the tenure and the
 *    permit, and they carry bedroom and bathroom COUNTS — which a CMS text
 *    input cannot agree across Arabic's six plural categories. They live in
 *    `messages/*\/property.json`, per the rule in docs/I18N.md ("a string with
 *    a number in it stays in the message catalogue"). The questions that read
 *    the same on every listing are here, as `faq.items`.
 *  - Labels: the key-facts tiles, the specification rows, the breadcrumb, the
 *    Share / Call / WhatsApp buttons, the permit line. Those are interface,
 *    and they are in the catalogue.
 *  - The enquiry form's fields, button, confirmation and pre-filled message,
 *    which belong to the Forms Manager.
 *
 * ## Storage
 *
 * `pages.blocks` under `subpage/property/copy`. `property` is a sub-page kind
 * with no per-record documents — a listing's content is a `properties` row —
 * so, unlike `development`, no record can ever land on this slug.
 *
 * ## The Arabic
 *
 * Hand-declared in `defaults` beside each English sibling, as the developer
 * and project documents do. Four eyebrows moved here from the catalogue
 * (`pages.property.*`, `property.floorPlan.unitLayout`) and keep the Arabic
 * they already had, byte for byte. The rest is a first draft in the sense of
 * ADR-0008: the client's edit at `/admin/pages/sub/property` wins
 * structurally, because `mergeValues` never overwrites a twin that holds a
 * value. Glossary bindings (`lib/i18n/mt/glossary.ts`) are followed —
 * تمويل عقاري not رهن, تملك حر, رسوم الخدمات, إعلان عقاري.
 */

import { area, faqList, text } from "./fields";
import { fillTokens } from "./developer-page";
import type { FieldDef, MasterPageDef, MasterPageKey, SectionDef } from "./types";

export { fillTokens };

/** The document's key — the last segment of the slug. */
export const PROPERTY_PAGE_COPY_KEY = "copy";

/** Where an editor goes, and what the Pages index card links to. */
export const PROPERTY_PAGE_ADMIN_PATH = "/admin/pages/sub/property";

/**
 * Every token the strings below may carry.
 *
 * Exported because the editor's help text, the tests and the renderer must all
 * agree about the exact spelling — a token documented as `{reference}` and
 * substituted as `{ref}` is a silent no-op that only shows up on the public
 * page.
 */
export const PROPERTY_TOKENS = {
  reference: "{reference}",
  title: "{title}",
  area: "{area}",
  advisor: "{advisor}",
  type: "{type}",
} as const;

export type PropertyTokens = Record<keyof typeof PROPERTY_TOKENS, string>;

const REFERENCE = PROPERTY_TOKENS.reference;
const TITLE = PROPERTY_TOKENS.title;
const AREA = PROPERTY_TOKENS.area;
const ADVISOR = PROPERTY_TOKENS.advisor;
const TYPE = PROPERTY_TOKENS.type;

const TOKEN_HELP = {
  reference: `Use ${REFERENCE} where the listing's reference belongs.`,
  title: `Use ${TITLE} where the listing's title belongs.`,
  area: `Use ${AREA} where the listing's area belongs.`,
  advisor: `Use ${ADVISOR} where the advisor's name belongs.`,
} as const;

/**
 * An eyebrow is a label, not a sentence — 80 characters, and required: a band
 * whose eyebrow an editor clears is an unlabelled band rather than a tidier
 * one. Every field here is required for the same reason; the renderer falls
 * back to the shipped wording if a stored value is somehow blank.
 */
const eyebrowField = (help = ""): FieldDef =>
  text("eyebrow", "Eyebrow", { max: 80, help });

const headingField = (help = ""): FieldDef =>
  text("heading", "Heading", { max: 160, help });

function band(
  key: string,
  label: string,
  description: string,
  fields: FieldDef[],
  defaults: SectionDef["defaults"],
  extra: Pick<SectionDef, "dataNote" | "dataLink"> = {},
): SectionDef {
  return {
    key,
    label,
    description,
    // Locked throughout. Whether a band appears on a listing depends on what
    // the listing holds — no floor plan, no amenities — and a switch here
    // would read as a site-wide kill switch and behave as neither.
    locked: true,
    fields,
    defaults,
    ...extra,
  };
}

/**
 * One section per band, in the order the page draws them: the main column
 * top to bottom, then the sidebar, then the full-width bands under both.
 */
export const PROPERTY_PAGE_COPY_SECTIONS: SectionDef[] = [
  band(
    "advisor-note",
    "Advisor's note",
    "The quoted note at the top of the description column.",
    [eyebrowField()],
    {
      eyebrow: "Advisor's note",
      eyebrow_ar: "ملاحظة المستشار",
    },
    {
      dataNote:
        "The note is the listing's short description, and the name under it is the advisor assigned to the listing — both from the property's record.",
    },
  ),
  band(
    "description",
    "Description",
    "The listing's full description.",
    [eyebrowField()],
    {
      eyebrow: "Why this one",
      eyebrow_ar: "لماذا هذا العقار",
    },
    { dataNote: "The description itself is on the property's record." },
  ),
  band(
    "floor-plan",
    "Floor plan",
    "The uploaded plan and the three facts under it.",
    [eyebrowField(), headingField()],
    {
      eyebrow: "Floor plan",
      eyebrow_ar: "المخطط الطابقي",
      heading: "Unit layout",
      heading_ar: "تخطيط الوحدة",
    },
    {
      dataNote:
        "The plan is uploaded on the property's record. The gallery tab of the same name is an interface label and is not edited here.",
    },
  ),
  band(
    "amenities",
    "Features & amenities",
    "The amenity list.",
    [eyebrowField()],
    {
      eyebrow: "Features & amenities",
      eyebrow_ar: "المزايا والمرافق",
    },
    {
      dataNote:
        "The amenities are ticked on the property's record; their names and Arabic are in Settings → Property fields.",
      dataLink: { label: "Property fields", href: "/admin/settings/fields" },
    },
  ),
  band(
    "location",
    "Location",
    "The map and the address under it.",
    [eyebrowField()],
    {
      eyebrow: "Location",
      eyebrow_ar: "الموقع",
    },
    {
      dataNote:
        "The heading is the listing's area, the pin is its coordinates and the line under the map is its address — all from the property's record.",
    },
  ),
  band(
    "specification",
    "Specification",
    "The table of everything the listing stores beyond the key facts.",
    [eyebrowField(), headingField()],
    {
      eyebrow: "Specification",
      eyebrow_ar: "المواصفات",
      heading: "The full detail.",
      heading_ar: "التفاصيل كاملة.",
    },
    {
      dataNote:
        "The rows are the listing's own facts, and a row with nothing in it is left out. Their labels, and the permit line under the table, are interface text rather than copy.",
    },
  ),
  band(
    "advisor",
    "Lead advisor card",
    "The advisor card at the top of the sidebar.",
    [
      eyebrowField(),
      text("enquire_label", "Enquiry button", {
        max: 80,
        help: TOKEN_HELP.reference,
      }),
    ],
    {
      eyebrow: "Lead advisor",
      eyebrow_ar: "المستشار المسؤول",
      enquire_label: `Enquire about ${REFERENCE}`,
      enquire_label_ar: `استفسر عن العقار ${REFERENCE}`,
    },
    {
      dataNote:
        "The name, photo, title, licence number, languages and contact details come from the advisor's profile in Agents & team, in both languages.",
      dataLink: { label: "Agents & team", href: "/admin/agents" },
    },
  ),
  band(
    "enquiry",
    "Enquiry card and dialog",
    "The words around the enquiry form — in the sidebar card, and in the dialog “Send to advisor” opens.",
    [
      eyebrowField(),
      headingField(TOKEN_HELP.reference),
      text("dialog_title", "Dialog heading", {
        max: 160,
        help: TOKEN_HELP.title,
      }),
      area("dialog_note", "Dialog note, with an advisor", {
        max: 300,
        optional: false,
        help: `Shown when the listing has an assigned advisor. ${TOKEN_HELP.reference} ${TOKEN_HELP.advisor}`,
      }),
      area("dialog_note_no_advisor", "Dialog note, without an advisor", {
        max: 300,
        optional: false,
        help: `Shown when nobody is assigned. ${TOKEN_HELP.reference}`,
      }),
      text("valuation_prompt", "Valuation prompt", {
        max: 120,
        help: `The line above the valuation button, under the form. ${TOKEN_HELP.area}`,
      }),
      text("valuation_cta", "Valuation button", { max: 80 }),
    ],
    {
      eyebrow: "Enquire about this property",
      eyebrow_ar: "استفسر عن هذا العقار",
      heading: `Ask anything about ${REFERENCE}.`,
      heading_ar: `اسأل عن أي تفاصيل تخص العقار ${REFERENCE}.`,
      dialog_title: `Enquire about ${TITLE}`,
      dialog_title_ar: `استفسر عن ${TITLE}`,
      dialog_note: `Reference ${REFERENCE} · goes straight to ${ADVISOR}, the advisor on this listing.`,
      dialog_note_ar: `المرجع ${REFERENCE} · يصل مباشرةً إلى ${ADVISOR}، المستشار المسؤول عن هذا الإعلان العقاري.`,
      dialog_note_no_advisor: `Reference ${REFERENCE} · an advisor replies within 2 hours during office hours.`,
      dialog_note_no_advisor_ar: `المرجع ${REFERENCE} · يردّ عليك أحد المستشارين خلال ساعتين في أوقات العمل.`,
      valuation_prompt: `Own elsewhere in ${AREA}?`,
      valuation_prompt_ar: `هل تملك عقاراً آخر في ${AREA}؟`,
      valuation_cta: "Get a free valuation report",
      valuation_cta_ar: "احصل على تقرير تقييم مجاني",
    },
    {
      dataNote:
        "The form's fields, button, confirmation and pre-filled message are in Forms → Enquire about this property. The valuation dialog's own wording is in Forms → Get the full advisor report.",
      dataLink: { label: "Enquiry form", href: "/admin/forms/property_enquiry" },
    },
  ),
  band(
    "faq",
    "FAQ",
    "The questions under the listing, and the FAQPage data search engines read.",
    [
      eyebrowField(),
      headingField(),
      {
        ...faqList(8),
        label: "Questions shown on every listing",
        itemLabel: "question",
      },
    ],
    {
      eyebrow: "FAQ",
      eyebrow_ar: "الأسئلة الشائعة",
      heading: "Common questions, plainly answered.",
      heading_ar: "أسئلة شائعة، بإجابات واضحة.",
      // The three answers that were English literals in the component, word
      // for word, with `${propertyType}` / `${reference}` now tokens.
      items: [
        {
          q: "What does the transfer process look like?",
          q_ar: "كيف تجري عملية نقل الملكية؟",
          a: `DLD-registered ${TYPE} transfers follow the standard MoU → 10% deposit → trustee booking → title-deed issuance sequence. Bazar's in-house conveyancing desk handles every step; transfer typically completes 30 – 45 days from accepted offer.`,
          a_ar: `تمرّ عمليات نقل ملكية ${TYPE} المسجّلة لدى دائرة الأراضي والأملاك بالتسلسل المعتاد: مذكرة التفاهم ← دفعة مقدّمة بنسبة 10% ← حجز موعد لدى أمين التسجيل ← إصدار سند الملكية. ويتولّى مكتب نقل الملكية لدى بازار كل خطوة، وتكتمل عملية النقل عادةً خلال 30 إلى 45 يوماً من قبول العرض.`,
        },
        {
          q: "What are the service charges?",
          q_ar: "ما هي رسوم الخدمات؟",
          a: "Service charge is set per community and billed by the master developer or the building OA. Exact AED/ft² varies by tower — your Bazar advisor will share the current schedule, the 5-year history, and what's included before you make an offer.",
          a_ar: "تُحدَّد رسوم الخدمات لكل مجتمع، ويُصدر فواتيرها المطوّر الرئيسي أو جمعية ملاك المبنى. ويختلف المبلغ الدقيق بالدرهم لكل قدم مربعة من برج لآخر — وسيشاركك مستشارك في بازار الجدول الحالي وسجلّ السنوات الخمس الماضية وما تشمله الرسوم قبل أن تقدّم عرضك.",
        },
        {
          q: `Is ${REFERENCE} mortgageable?`,
          q_ar: `هل يمكن شراء العقار ${REFERENCE} بتمويل عقاري؟`,
          a: "Most Abu Dhabi banks lend on freehold residential property at up to 80% LTV for residents (60% for non-residents). Bazar's mortgage desk can run a pre-approval before viewings so you know your envelope.",
          a_ar: "تقدّم معظم البنوك في أبوظبي تمويلاً عقارياً للعقارات السكنية بنظام التملك الحر بنسبة تصل إلى 80% من قيمة العقار للمقيمين (و60% لغير المقيمين). ويمكن لمكتب التمويل العقاري لدى بازار استخراج موافقة مبدئية قبل المعاينات لتعرف ميزانيتك مسبقاً.",
        },
      ],
    },
    {
      dataNote: `These questions appear on every listing, after the ones written from the listing's own facts — what a home of its size and type includes, where it is, whether a non-resident can buy it and how to verify its permit. Those four branch on the listing's tenure and permit and carry its bedroom and bathroom counts, so they are written in code in both languages. Use ${REFERENCE}, ${TITLE}, ${AREA} and ${TYPE} in the questions here.`,
    },
  ),
  band(
    "similar",
    "Nearby listings",
    "The rail of other listings in the same area, under the FAQ.",
    [eyebrowField(TOKEN_HELP.area), headingField()],
    {
      eyebrow: `More in ${AREA}`,
      eyebrow_ar: `المزيد في ${AREA}`,
      heading: "Nearby Properties",
      heading_ar: "العقارات القريبة",
    },
    { dataNote: "The cards are the four newest listings in the same area." },
  ),
];

/**
 * The document presented as a `MasterPageDef`, so it goes straight through
 * `resolveSections` / `validateSections` and into the shared editor without a
 * parallel implementation — the same trick `developerPageCopyDef` uses.
 */
export function propertyPageCopyDef(): MasterPageDef {
  return {
    key: `property/${PROPERTY_PAGE_COPY_KEY}` as unknown as MasterPageKey,
    label: "Property pages",
    path: "/p",
    description:
      "The eyebrows, headings, enquiry wording and shared questions every /p/<slug> listing page carries.",
    sections: PROPERTY_PAGE_COPY_SECTIONS,
  };
}

/** Exported for the guards that enumerate every registry's field lists. */
export function propertyPageFieldLists(): {
  origin: string;
  fields: FieldDef[];
}[] {
  return PROPERTY_PAGE_COPY_SECTIONS.map((s) => ({
    origin: `property-page:${s.key}`,
    fields: s.fields,
  }));
}
