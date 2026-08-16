/**
 * /tools/mortgage — the mortgage calculator, section by section.
 *
 * The page opened as a masthead over a single two-column slab: every input on
 * a sticky rail, and four unrelated outputs — the monthly payment, the closing
 * table, the amortization chart and the scenario compare — stacked in one
 * column beside it. Everything the tool could say, said at once. This registry
 * is the version that arrives one idea at a time, and the split is what makes
 * each idea an editor's to move, rename or switch off.
 *
 * The order below is the order the page ships in. It is a DEFAULT, not a
 * layout: `resolveSections` takes the arrangement from storage whenever
 * anything is stored, so dragging `amortization` above `compare` in Pages &
 * blocks reorders the live page, and a section added here later lands at the
 * end of an already-arranged document rather than in the middle of it.
 *
 * Two things are deliberately NOT sections:
 *
 *  - the calculator's own figures — the opening scenario, the fee schedule,
 *    the LTV tiers, the DBR bands. They are arithmetic, they are shared by
 *    every section below, and they live in Settings → Mortgage.
 *  - the pre-approval form's fields, button and confirmation, which belong to
 *    the Forms Manager. `pre_approval` owns the words around it; `headingSource`
 *    on the form definition points back here so the manager links out.
 *
 * The `hero` and `pre_approval` sections carry hand-written `_ar` defaults,
 * because their English came out of the `tools` message catalogue already
 * translated — without the twins the fold hands /ar the English default and
 * Arabic that already existed is lost. The section heads added by the split
 * carry Arabic where the string they replaced had it.
 *
 * Every `defaults` value is the copy the page rendered before it became
 * editable, so an un-edited page reads as it always did.
 */
import type { MasterPageDef } from "../types";
import { area, eyebrow, heading, image, link, text, toggle } from "../fields";

/** Where the closing CTA jumps back to, and what the hero's form card anchors. */
export const MORTGAGE_FORM_ANCHOR = "pre-approval";

export const MORTGAGE_PAGE: MasterPageDef = {
  key: "mortgage",
  label: "Mortgage calculator",
  path: "/tools/mortgage",
  description:
    "The mortgage tool — the hero and its pre-approval form, then the calculator and each of its outputs as its own section.",
  sections: [
    {
      key: "hero",
      label: "Hero",
      description:
        "Photograph, the pitch, and the pre-approval form beside it — the shape /services/manage opens with.",
      locked: true,
      dataNote:
        "The calculator's own numbers — the opening scenario, the closing-cost percentages, the Central Bank LTV tiers and the DBR thresholds — are set under Settings → Mortgage. The form's fields and button are in Forms → Start your pre-approval.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        text("title_emphasis", "Emphasised tail", {
          max: 60,
          optional: true,
          help: "Rendered in italic at the end of the headline.",
        }),
        area("sub", "Sub-headline", { max: 400, optional: false }),
        image(
          "image",
          "Background image",
          "Fills the hero behind the pitch and the form, with a dark scrim over it so the text stays legible. Landscape, at least 2000px wide. Leave unset to keep the plain background.",
        ),
        toggle(
          "show_form",
          "Show the pre-approval form here",
          "On: the form sits in the hero and the section at the foot of the page becomes a button that scrolls back up to it. Off: the hero is copy alone and the form renders at the foot. It is never drawn twice — two live copies of one form on one page is two sets of answers to reconcile.",
        ),
      ],
      defaults: {
        eyebrow: "For buyers and investors",
        eyebrow_ar: "المشترون والمستثمرون",
        title: "What will this property actually",
        title_ar: "ما الذي سيكلفك هذا العقار",
        title_emphasis: "cost you?",
        title_emphasis_ar: "فعليًا؟",
        sub: "The number you see on a listing is rarely the number you pay. This calculator includes everything: transfer fees, advisory, mortgage fees, and the full cash needed to close.",
        sub_ar:
          "الرقم الذي تراه في الإعلان العقاري نادراً ما يكون الرقم الذي تدفعه. تشمل هذه الحاسبة كل شيء: رسوم نقل الملكية، وأتعاب الاستشارة، ورسوم تمويل عقاري، وكامل المبلغ النقدي اللازم لإتمام الصفقة.",
        image: { media_id: null, alt: null, label: null },
        show_form: true,
      },
    },
    {
      key: "scenario",
      label: "Scenario selector",
      description:
        "The inputs, and the monthly payment they produce. The one section the whole page is really about.",
      locked: true,
      dataNote:
        "What the sliders and dropdowns open on — price, deposit, rate, term — is set under Settings → Mortgage, along with the deposit floors the 'below guidance' warning quotes.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        area("intro", "Intro", { max: 300 }),
      ],
      defaults: {
        eyebrow: "Scenario",
        eyebrow_ar: "السيناريو",
        title: "Build the deal you are actually looking at.",
        title_ar: "ابنِ الصفقة التي تنظر إليها فعلياً.",
        intro:
          "Drag the price and the deposit, pick a term, and the monthly payment moves with them.",
        intro_ar:
          "حرّك السعر والدفعة المقدّمة، واختر مدة التمويل، وسيتغيّر المبلغ الشهري تبعاً لذلك.",
      },
    },
    {
      key: "affordability",
      label: "Affordability (DBR)",
      description:
        "Annual income in, debt-burden ratio out — the check a bank runs before it quotes.",
      dataNote:
        "The comfortable line and the Central Bank cap are set under Settings → Mortgage; the sentence and the gauge both quote whatever is stored there.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        area("intro", "Intro", { max: 300 }),
      ],
      defaults: {
        eyebrow: "Affordability",
        eyebrow_ar: "القدرة على السداد",
        title: "What a lender checks before it quotes.",
        title_ar: "ما الذي تتحقّق منه الجهة المموّلة قبل أن تقدّم عرضها.",
        intro:
          "Enter what you earn in a year and the gauge shows the share of your monthly income this mortgage would take.",
        intro_ar:
          "أدخل دخلك السنوي وسيُظهر المؤشّر نسبة ما سيستهلكه هذا التمويل من دخلك الشهري.",
      },
    },
    {
      key: "compare",
      label: "Compare scenarios",
      description:
        "The same deal with one variable moved — more down, or a shorter term.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        area("intro", "Intro", { max: 300 }),
      ],
      defaults: {
        eyebrow: "Compare scenarios",
        eyebrow_ar: "مقارنة السيناريوهات",
        title: "What if you change one variable?",
        title_ar: "ماذا لو غيّرت متغيّرًا واحدًا؟",
        intro: null,
      },
    },
    {
      key: "amortization",
      label: "Amortization",
      description: "The year-by-year split of principal against interest.",
      fields: [
        eyebrow({
          help: "Write {years} where the loan term should appear — it is replaced with whatever term the visitor has selected.",
        }),
        heading({ key: "title", label: "Headline" }),
        area("intro", "Intro", { max: 300 }),
      ],
      defaults: {
        eyebrow: "Amortization · {years} years",
        eyebrow_ar: "الإطفاء · {years} سنة",
        title: "How interest tapers",
        title_ar: "كيفية تناقص الفائدة",
        intro: null,
      },
    },
    {
      key: "cash_to_close",
      label: "Cash to close",
      description:
        "Every fee between the offer and the keys, and the PDF of it.",
      dataNote:
        "The percentages and flat fees in this table are set under Settings → Mortgage.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        area("intro", "Intro", { max: 300 }),
      ],
      defaults: {
        eyebrow: "True cash to close",
        eyebrow_ar: "إجمالي المبلغ النقدي المطلوب عند الإغلاق",
        title: "What you actually wire",
        title_ar: "ما تحوّله فعلياً",
        intro: null,
      },
    },
    {
      key: "pre_approval",
      label: "Pre-approval band",
      description:
        "The closing band — the pitch, the scenario recap, and either the form itself or a button back up to it.",
      dataNote:
        "The form's fields, button and confirmation are in Forms → Start your pre-approval. Whether the form draws here or in the hero is the hero's 'Show the pre-approval form here' switch. The scenario recap lists whatever the visitor built above; only its label and footnote are editable.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        area("sub", "Sub-headline", { max: 240, optional: false }),
        text("scenario_label", "Scenario recap · label", { max: 80 }),
        area("scenario_note", "Scenario recap · footnote", { max: 300 }),
        text("talk_label", "Line above the buttons", {
          max: 120,
          optional: true,
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
        text("jump_cta_label", "Button label when the form is in the hero", {
          max: 60,
          help: "Scrolls back up to the form rather than opening anything.",
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
        jump_cta_label: "Start your pre-approval",
        jump_cta_label_ar: "ابدأ موافقتك المبدئية",
      },
    },
  ],
};
