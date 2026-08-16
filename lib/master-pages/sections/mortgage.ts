/**
 * /tools/mortgage — the mortgage calculator, and the pre-approval band under it.
 *
 * The calculator itself is arithmetic, not copy: its inputs, the closing-cost
 * table and the affordability gauge are computed from `lib/mortgage.ts` against
 * assumptions an admin edits under Settings → Mortgage. What lives here is the
 * prose wrapped around it — the masthead, and the band that introduces the
 * pre-approval form.
 *
 * The form inside that band is NOT here. Its fields, its button and its
 * confirmation belong to the Forms Manager (`mortgage_preapproval`), which is
 * the same split every other master page draws: a page owns the words around a
 * form, the manager owns the form. `headingSource` on the form definition
 * points back at the `pre_approval` section below so the manager can link out
 * rather than offer a second writable copy of the heading.
 *
 * Both sections carry hand-written `_ar` defaults. Every other master page
 * ships English defaults and leaves Arabic to the editor, because its English
 * was hardcoded prose with no translation to inherit. This page's lived in the
 * `tools` message catalogue and was already translated, so the twins carry
 * that Arabic across — without them the fold would hand /ar the English
 * default and the page would lose Arabic it already had.
 *
 * Every `defaults` value is the copy the page rendered before it became
 * editable, so an un-edited page renders identically to before.
 */
import type { MasterPageDef } from "../types";
import { area, eyebrow, heading, link, text } from "../fields";

export const MORTGAGE_PAGE: MasterPageDef = {
  key: "mortgage",
  label: "Mortgage calculator",
  path: "/tools/mortgage",
  description:
    "The mortgage tool — its masthead, and the pre-approval band under the calculator.",
  sections: [
    {
      key: "hero",
      label: "Masthead",
      description: "The page title and the paragraph under it.",
      locked: true,
      dataNote:
        "The calculator's own numbers — the default price, rate and term, the closing-cost percentages, the Central Bank LTV tiers and the DBR thresholds — are set under Settings → Mortgage.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        text("title_emphasis", "Emphasised tail", {
          max: 60,
          optional: true,
          help: "Rendered in italic at the end of the headline.",
        }),
        area("intro", "Intro paragraph", { max: 400, optional: false }),
      ],
      defaults: {
        eyebrow: "For buyers and investors",
        eyebrow_ar: "المشترون والمستثمرون",
        title: "What will this property actually",
        title_ar: "ما الذي سيكلفك هذا العقار",
        title_emphasis: "cost you?",
        title_emphasis_ar: "فعليًا؟",
        intro:
          "The number you see on a listing is rarely the number you pay. This calculator includes everything: transfer fees, advisory, mortgage fees, and the full cash needed to close.",
        intro_ar:
          "الرقم الذي تراه في الإعلان العقاري نادراً ما يكون الرقم الذي تدفعه. تشمل هذه الحاسبة كل شيء: رسوم نقل الملكية، وأتعاب الاستشارة، ورسوم تمويل عقاري، وكامل المبلغ النقدي اللازم لإتمام الصفقة.",
      },
    },
    {
      key: "pre_approval",
      label: "Pre-approval band",
      description:
        "The tinted band at the foot of the page — the pitch, the scenario recap, and the two buttons beside the form.",
      dataNote:
        "The form's fields, button and confirmation are in Forms → Start your pre-approval. The scenario recap lists whatever the visitor built in the calculator above; only its label and footnote are editable here.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        area("sub", "Sub-headline", { max: 240, optional: false }),
        text("scenario_label", "Scenario recap · label", { max: 80 }),
        area("scenario_note", "Scenario recap · footnote", { max: 300 }),
        text("talk_label", "Line above the buttons", {
          max: 120,
          optional: true,
          help: "Only shown when the pre-approval form is switched on in Forms.",
        }),
        text("advisor_cta_label", "First button · label", { max: 60 }),
        link("advisor_cta_href", "First button · link"),
        text("whatsapp_cta_label", "Second button · label", {
          max: 60,
          help: "Opens WhatsApp with the visitor's scenario already written into the message.",
        }),
        text("fallback_cta_label", "Second button · label without WhatsApp", {
          max: 60,
          help: "Used when no WhatsApp number is configured, in which case the button goes to the contact page instead.",
        }),
      ],
      defaults: {
        eyebrow: "Ready to make it real?",
        eyebrow_ar: "حان وقت التنفيذ؟",
        title: "Get pre-approved with our preferred lenders.",
        title_ar: "احصل على موافقة مبدئية من الجهات المموّلة المعتمدة لدينا.",
        sub: "Soft credit pull · 24-hour response · 5 partner banks",
        sub_ar: "استعلام ائتماني مبدئي · رد خلال 24 ساعة · 5 بنوك شريكة",
        scenario_label: "Attached to your request",
        scenario_label_ar: "المرفق بطلبك",
        scenario_note:
          "Adjust anything above and this updates before you send — no need to retype your numbers.",
        scenario_note_ar:
          "عدّل أي شيء أعلاه وسيتم تحديث هذا قبل الإرسال — لا حاجة لإعادة إدخال أرقامك.",
        talk_label: "Rather talk it through first?",
        talk_label_ar: "تفضّل التحدث أولاً؟",
        advisor_cta_label: "Talk to advisor",
        advisor_cta_label_ar: "التحدث إلى مستشار",
        advisor_cta_href: "/contact",
        whatsapp_cta_label: "Pre-approval via WhatsApp",
        whatsapp_cta_label_ar: "الموافقة المبدئية عبر واتساب",
        fallback_cta_label: "Start pre-approval",
        fallback_cta_label_ar: "ابدأ الموافقة المبدئية",
      },
    },
  ],
};
