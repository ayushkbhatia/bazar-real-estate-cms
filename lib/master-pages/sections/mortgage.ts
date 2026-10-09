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
import { area, eyebrow, faqList, heading, image, link, text, toggle } from "../fields";

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
        // While the online application is open (docs/mortgage), the hero's
        // right-hand side is its first step instead of the old form: two
        // choices that land the visitor on "Your details" with the service
        // already chosen.
        text("panel_step", "Application panel · step line", { max: 40 }),
        text("panel_title", "Application panel · heading", { max: 80 }),
        area("panel_sub", "Application panel · line under the heading", { max: 200 }),
        text("preapproval_title", "Application panel · Fast Pre-Approval · name", { max: 60 }),
        area("preapproval_desc", "Application panel · Fast Pre-Approval · description", { max: 200 }),
        text("consultancy_title", "Application panel · Mortgage Consultancy · name", { max: 60 }),
        area("consultancy_desc", "Application panel · Mortgage Consultancy · description", { max: 200 }),
        area("panel_note", "Application panel · note under the choices", { max: 240 }),
        text("sticky_text", "Start bar · line", {
          max: 100,
          help: "The bar that slides up from the foot of the screen once the visitor has scrolled past the hero.",
        }),
        text("sticky_cta", "Start bar · button", { max: 40 }),
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
        panel_step: "Step 1 of 3",
        panel_step_ar: "الخطوة 1 من 3",
        panel_title: "Start your application",
        panel_title_ar: "ابدأ طلبك",
        panel_sub: "Choose how we can help. You'll go straight on to your details.",
        panel_sub_ar: "اختر كيف يمكننا مساعدتك، وستنتقل مباشرةً إلى بياناتك.",
        preapproval_title: "Fast Pre-Approval",
        preapproval_title_ar: "الموافقة المبدئية السريعة",
        preapproval_desc: "Upload four documents and get a bank's answer within 24 working hours.",
        preapproval_desc_ar: "حمّل أربعة مستندات واحصل على رد البنك خلال 24 ساعة عمل.",
        consultancy_title: "Mortgage Consultancy",
        consultancy_title_ar: "استشارة التمويل العقاري",
        consultancy_desc: "No documents yet. A mortgage adviser calls you to talk it through.",
        consultancy_desc_ar: "لا حاجة إلى مستندات الآن. سيتصل بك مستشار التمويل العقاري لمناقشة خياراتك.",
        panel_note: "Online applications are for UAE nationals and residents.",
        panel_note_ar: "الطلبات عبر الإنترنت متاحة للمواطنين الإماراتيين والمقيمين في الدولة.",
        sticky_text: "Get a bank to confirm what you can borrow.",
        sticky_text_ar: "دع البنك يؤكد المبلغ الذي يمكنك اقتراضه.",
        sticky_cta: "Start pre-approval",
        sticky_cta_ar: "ابدأ الموافقة المبدئية",
      },
    },
    {
      key: "journey",
      label: "How it works",
      description:
        "The four stops from this page to a bank's answer, and a button to the first. Shows while the online application is open.",
      placeAfter: "hero",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        area("intro", "Intro", { max: 300 }),
        text("step1_title", "Stop 1 · title", { max: 60 }),
        area("step1_body", "Stop 1 · line", { max: 200 }),
        text("step2_title", "Stop 2 · title", { max: 60 }),
        area("step2_body", "Stop 2 · line", { max: 200 }),
        text("step3_title", "Stop 3 · title", { max: 60 }),
        area("step3_body", "Stop 3 · line", { max: 200 }),
        text("step4_title", "Stop 4 · title", { max: 60 }),
        area("step4_body", "Stop 4 · line", { max: 200 }),
        text("cta_label", "Button", { max: 40 }),
      ],
      defaults: {
        eyebrow: "How it works",
        eyebrow_ar: "كيف تتم العملية",
        title: "From this page to a bank's answer",
        title_ar: "من هذه الصفحة إلى رد البنك",
        intro: "Three short steps online. Then your adviser takes the file to our partner banks.",
        intro_ar: "ثلاث خطوات قصيرة عبر الإنترنت، ثم يتولى مستشارك عرض ملفك على البنوك الشريكة.",
        step1_title: "Choose a service",
        step1_title_ar: "اختر الخدمة",
        step1_body: "Fast Pre-Approval, or a consultation if you're still exploring.",
        step1_body_ar: "الموافقة المبدئية السريعة، أو استشارة إذا كنت لا تزال تستكشف خياراتك.",
        step2_title: "Tell us about you",
        step2_title_ar: "عرّفنا بنفسك",
        step2_body: "Residency, employment and how to reach you. Nothing is shared until you submit.",
        step2_body_ar: "الإقامة والعمل ووسيلة التواصل معك. لا نشارك أي شيء قبل أن ترسل طلبك.",
        step3_title: "Upload your documents",
        step3_title_ar: "حمّل مستنداتك",
        step3_body: "Emirates ID, passport and proof of income, as PDFs or photos.",
        step3_body_ar: "الهوية الإماراتية وجواز السفر وما يثبت دخلك، بصيغة PDF أو صور.",
        step4_title: "Hear back within 24 working hours",
        step4_title_ar: "تلقَّ الرد خلال 24 ساعة عمل",
        step4_body: "Your adviser reviews the file and comes back with the banks' answer.",
        step4_body_ar: "يراجع مستشارك ملفك ويعود إليك برد البنوك.",
        cta_label: "Start with step one",
        cta_label_ar: "ابدأ بالخطوة الأولى",
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
      key: "apply_bridge",
      label: "Estimate to pre-approval",
      description:
        "The step from the calculator's number to the application: the visitor's own monthly payment and loan amount, and the button that starts a pre-approval for it. Shows while the online application is open.",
      placeAfter: "scenario",
      fields: [
        heading({ key: "title", label: "Headline" }),
        area("body", "Line under the headline", {
          max: 300,
          help: "Write {monthly} and {loan} where the visitor's monthly payment and loan amount go.",
          placeholder: "{monthly} a month on a {loan} loan…",
        }),
        text("primary_label", "Main button", { max: 40 }),
        text("secondary_label", "Second button", { max: 40 }),
      ],
      defaults: {
        title: "Turn this estimate into a pre-approval",
        title_ar: "حوّل هذا التقدير إلى موافقة مبدئية",
        body: "{monthly} a month on a {loan} loan is our estimate. A pre-approval is a bank confirming it.",
        body_ar: "{monthly} شهريًا على تمويل بقيمة {loan} هو تقديرنا، أما الموافقة المبدئية فهي تأكيد البنك له.",
        primary_label: "Get pre-approved",
        primary_label_ar: "احصل على الموافقة المبدئية",
        secondary_label: "Talk to an adviser",
        secondary_label_ar: "تحدث إلى مستشار",
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
      key: "faq",
      label: "Questions",
      description: "What people ask before they apply.",
      placeAfter: "affordability",
      fields: [eyebrow(), heading({ key: "title", label: "Headline" }), faqList(8)],
      defaults: {
        eyebrow: "Questions",
        eyebrow_ar: "أسئلة",
        title: "Before you apply",
        title_ar: "قبل أن تتقدم بطلبك",
        items: [
          {
            q: "Who can apply online?",
            q_ar: "من يمكنه التقديم عبر الإنترنت؟",
            a: "UAE nationals and residents of the UAE. If you live abroad, contact us and an adviser will help you apply.",
            a_ar: "المواطنون الإماراتيون والمقيمون في دولة الإمارات. إذا كنت تقيم خارج الدولة، تواصل معنا وسيساعدك أحد مستشارينا في التقديم.",
          },
          {
            q: "How much can I borrow?",
            q_ar: "ما المبلغ الذي يمكنني اقتراضه؟",
            a: "On a first home under AED 5 million, banks lend up to 85% of the value to UAE nationals and 80% to residents. Your income sets the rest: monthly debt repayments are kept under half of your salary.",
            a_ar: "على المسكن الأول الذي تقل قيمته عن 5 ملايين درهم، تموّل البنوك حتى 85% من القيمة للمواطنين الإماراتيين و80% للمقيمين. ويحدد دخلك الباقي، إذ يجب ألا تتجاوز أقساط ديونك الشهرية نصف راتبك.",
          },
          {
            q: "Which documents will I need?",
            q_ar: "ما المستندات التي سأحتاج إليها؟",
            a: "Your Emirates ID and passport, plus a salary certificate and three months of bank statements if you're salaried, or a trade licence and a year of statements if you own a business. PDF, JPG or PNG.",
            a_ar: "هويتك الإماراتية وجواز سفرك، بالإضافة إلى شهادة راتب وكشوف حساب لثلاثة أشهر إذا كنت موظفًا، أو رخصة تجارية وكشوف حساب لعام كامل إذا كنت صاحب عمل. بصيغة PDF أو JPG أو PNG.",
          },
          {
            q: "How long does a pre-approval take?",
            q_ar: "كم تستغرق الموافقة المبدئية؟",
            a: "We come back within 24 working hours of receiving your documents. Working hours are Sunday to Thursday, 9:00 to 19:00, and Friday, 9:00 to 15:00.",
            a_ar: "نعود إليك خلال 24 ساعة عمل من استلام مستنداتك. ساعات العمل من الأحد إلى الخميس من 9:00 إلى 19:00، ويوم الجمعة من 9:00 إلى 15:00.",
          },
          {
            q: "Is a pre-approval a guarantee?",
            q_ar: "هل الموافقة المبدئية ضمان للتمويل؟",
            a: "No. It is the bank's answer in principle, based on your documents. The final approval follows the property's valuation and the bank's own checks.",
            a_ar: "لا. إنها رد البنك المبدئي بناءً على مستنداتك، وتأتي الموافقة النهائية بعد تقييم العقار وإجراءات التحقق الخاصة بالبنك.",
          },
        ],
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
        // Who can apply online (docs/mortgage DECISIONS D24): the application
        // takes UAE nationals and residents only, and the calculator also
        // prices for non-residents.
        area("flow_note", "Note under the buttons · while the online application is open", {
          max: 240,
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
        flow_note:
          "Online applications are for UAE nationals and residents of the UAE. Living abroad? Contact us and an advisor will help.",
        flow_note_ar:
          "طلبات التمويل عبر الإنترنت متاحة للمواطنين الإماراتيين والمقيمين في دولة الإمارات. تقيم خارج الدولة؟ تواصل معنا وسيساعدك أحد مستشارينا.",
      },
    },
  ],
};
