/**
 * The project page's own words — the eyebrow, heading and standfirst above
 * every band on `/developments/<slug>`, shared by every development in the
 * catalogue.
 *
 * ## The problem this solves
 *
 * `DEVELOPMENT_SECTIONS` in `./subpages.ts` gives each project page its own
 * copy fields, and every one of them ships `null`: they are OVERRIDES, and a
 * blank one falls through to wording hardcoded in
 * `app/[locale]/(public)/developments/[slug]/page.tsx` and its `_components/*`
 * as `?? "Overview"`, `?? "The site"`, `?? "What's left"` and twenty more.
 *
 * That is the right shape for copy that differs per project. It is the wrong
 * shape for these, and the cost landed on the two people it could:
 *
 *  - **The editor.** Opening a newly created project's page editor shows
 *    fourteen sections of empty Eyebrow and Heading boxes. Nothing says the
 *    page already reads well without them, so they get typed — once per
 *    project, forever, for words that are identical on all of them.
 *  - **The Arabic reader.** A literal behind `??` is not a message key and not
 *    a CMS value, so it is the one class of prose on this route that
 *    `/ar/developments/<slug>` cannot render in Arabic. It shipped English
 *    eyebrows over Arabic body copy.
 *
 * ## Why ONE document rather than defaults on the per-project fields
 *
 * Putting the strings in `DEVELOPMENT_SECTIONS`'s own `defaults` would prefill
 * the editor, which is the visible half of the ask — and would then write a
 * copy of all forty strings into `pages.blocks` for every project on its first
 * save. Changing "What's left" later would be one edit per development rather
 * than one edit. The whole point of the sentence "they are the same across all
 * developments" is that they should be stored that way.
 *
 * So this is the shape `lib/master-pages/developer-page.ts` already uses for
 * the wording all 32 `/developers/<slug>` pages share: one document, read by
 * every page, with the per-record part arriving as a TOKEN rather than as
 * typing. The per-project override fields stay exactly as they are and still
 * win — a project that wants its own heading gets one.
 *
 * ## Resolution order, per field
 *
 *   1. the project's own override   (`subpage/development/<slug>`, unchanged)
 *   2. this document                (`subpage/development-copy/shared`)
 *   3. the code defaults below
 *
 * Step 3 is never reached in normal operation — `getDevelopmentPageCopy` folds
 * the defaults in itself — but it is what renders when Supabase is unreachable.
 *
 * ## Where the defaults below come from — the client's own words, not the JSX
 *
 * Not the `?? "Overview"` literals this replaces. Measured against production
 * before writing them: 22 project documents, ~20 copy fields each in BOTH
 * languages, and every field byte-identical across all 22 except
 * `overview.heading`, which was `A Community Within <area>` /
 * `مجتمع متكامل في <area>` with the area SPELLED IN BY HAND on each one, in
 * each language. That pair is the clearest statement of why the moving part is
 * a TOKEN rather than concatenation: Arabic puts the preposition before the
 * name, English puts it after the noun.
 * The client had already answered "what should these say" twenty-two times, in
 * a house style the shipped literals do not match — "Discover the Community"
 * over "Overview", "Project Features" over "Named features", "Need Assistance?"
 * over "Lead advisor". Seeding this document from the JSX would have offered
 * them, as the new shared default, wording they had overridden on every page
 * they own.
 *
 * So the defaults are theirs, verbatim, down to the curly apostrophe in the
 * location standfirst. Two bands are the exception and say so where they are
 * declared: `units` and `floor-plans` have never been overridden on any
 * project, because no project carries unit inventory or an unfiled floor plan,
 * so the band has never rendered for an editor to react to. Those keep the
 * shipped wording.
 *
 * The consequence worth stating plainly: this changes nothing on the 22
 * existing pages, because their own overrides still win. It changes project 23
 * onward, which is where the ~440 keystrokes were going.
 *
 * ## Tokens
 *
 * `{name}`, `{area}`, `{developer}`, `{plan}`, `{available}` and `{total}` are
 * substituted per page by `fillTokens` (re-exported from `developer-page.ts` —
 * one implementation, so a token that works in one registry works in the
 * other). Substitution rather than concatenation because the token's POSITION
 * differs between the two languages: English writes "Within Saadiyat Lagoons",
 * Arabic writes the preposition first and the name last, and `${x} + " ..."`
 * cannot express that.
 *
 * A token an editor deletes is simply not substituted; the sentence renders
 * without it rather than erroring.
 *
 * ## The Arabic
 *
 * Hand-declared in `defaults` beside each English sibling, for the reason
 * `search-headers.ts` and `developer-page.ts` both set out: these are short UI
 * strings with a settled house rendering, and splitting them between `defaults`
 * and `lib/master-pages/arabic/master.json` would make "where does this
 * string's Arabic live" a question with two answers. `خطة السداد`,
 * `المطور العقاري` and `خطة السداد` are the glossary's bindings
 * (`lib/i18n/mt/glossary.ts`), not free choices; `الموقع` and
 * `الأسئلة الشائعة` are lifted from `messages/ar/pages.json` and
 * `messages/ar/area.json` so the same concept reads the same way on the card
 * and on the page.
 *
 * The Arabic below is the client's own, taken from those same 22 documents and
 * 22-times identical in every field — not a machine draft, and not mine. Where
 * it and the glossary disagree (`خطة الدفع` for the payment plan) the comment
 * at that entry says so.
 *
 * What this closes is narrower than it first looks, and worth stating
 * precisely: those 22 pages already render Arabic, because each carries its own
 * `_ar` twins. It is the CODE path that had none — the `?? "Overview"` literals
 * this replaces are neither a message key nor a CMS value, so a project WITHOUT
 * an override rendered an English eyebrow over Arabic body copy. Today that is
 * every project from the 23rd on.
 *
 * Under ADR-0008 what ships is a first draft the client proofreads at
 * `/admin/pages/sub/development/copy`; their edit wins structurally, because
 * `mergeValues` never overwrites a twin that already holds a value.
 *
 * ## Storage, and the namespace it deliberately avoids
 *
 * `pages.blocks` under `subpage/development-copy/shared` — the same jsonb
 * column as every other registry here, and no migration.
 *
 * NOT `subPageSlug("development", "copy")`. That namespace is written per
 * RECORD: `subpage/development/<slug>` is one project's own document, and a
 * project slugged `copy` would land on the identical row and clobber this one
 * — silently, in both directions, with no error and no audit trail saying
 * which write won. The route `/admin/pages/sub/development/copy` is safe from
 * the same problem because App Router resolves a static segment ahead of a
 * dynamic one (`new/` already relies on that); storage has no such rule.
 *
 * So the slug is built from `SUBPAGE_SLUG_PREFIX` and its own namespace, the
 * way `lib/master-pages/header-cta.ts` does for the same class of reason. The
 * prefix is the part that matters — it is what `lib/queries/pages.ts` filters
 * on to keep the row out of `/pages/[slug]` and out of the Pages list — and
 * `development-copy` is not a `SubPageKind`, so no record can ever be written
 * there.
 */

import { area, text } from "./fields";
import { fillTokens } from "./developer-page";
import type { FieldDef, MasterPageDef, MasterPageKey, SectionDef } from "./types";

export { fillTokens };

/** The document's key — the last segment of both the slug and the route. */
export const DEVELOPMENT_PAGE_COPY_KEY = "copy";

/**
 * The namespace the document is stored under, between `SUBPAGE_SLUG_PREFIX`
 * and the key. See "Storage" above for why it is not `development`.
 *
 * The slug itself is assembled in `lib/queries/development-page.ts`, which is
 * where `developerPageCopySlug` lives too: `subpages.ts` imports THIS module
 * for its editor help text, so importing `SUBPAGE_SLUG_PREFIX` back out of it
 * would close a cycle — and one whose failure mode is a module-level `const`
 * read in its temporal dead zone, which surfaces as a `ReferenceError` on
 * whichever of the two modules happens to load second.
 */
export const DEVELOPMENT_PAGE_COPY_NAMESPACE = "development-copy";

/** Where an editor goes, and what the index card links to. */
export const DEVELOPMENT_PAGE_ADMIN_PATH = "/admin/pages/sub/development/copy";

/**
 * Every token the strings below may carry.
 *
 * Exported because the editor's help text, the tests and the renderer must all
 * agree about the exact spelling — a token documented as `{name}` and
 * substituted as `{{name}}` is a silent no-op that only shows up on the public
 * page.
 */
export const DEVELOPMENT_TOKENS = {
  name: "{name}",
  area: "{area}",
  developer: "{developer}",
  plan: "{plan}",
  available: "{available}",
  total: "{total}",
} as const;

export type DevelopmentTokens = {
  name: string;
  area: string;
  developer: string;
  plan: string;
  available: number | string;
  total: number | string;
};

const NAME = DEVELOPMENT_TOKENS.name;
const AREA = DEVELOPMENT_TOKENS.area;
const DEVELOPER = DEVELOPMENT_TOKENS.developer;
const PLAN = DEVELOPMENT_TOKENS.plan;

/**
 * An eyebrow is a label, not a sentence — 80 characters rather than the
 * builder's 160, and required: a section whose eyebrow an editor clears is an
 * unlabelled band rather than a tidier one. Every field in this document is
 * required for the same reason, which is the difference between it and the
 * per-project override fields it backs: those are optional *because* this
 * exists to catch them.
 */
const sharedEyebrow = (help: string): FieldDef =>
  text("eyebrow", "Eyebrow", { max: 80, help });

const sharedHeading = (help: string): FieldDef =>
  text("heading", "Heading", { max: 160, help });

const sharedIntro = (help: string): FieldDef =>
  area("intro", "Standfirst", { max: 400, optional: false, help });

function copyBand(
  key: string,
  label: string,
  description: string,
  fields: FieldDef[],
  defaults: Record<string, string>,
  dataNote?: string,
): SectionDef {
  return {
    key,
    label,
    description,
    // Locked throughout. Whether a band appears on a given project is that
    // project's decision and lives in its own document; a switch here would
    // read as a site-wide kill switch and behave as neither.
    locked: true,
    ...(dataNote ? { dataNote } : {}),
    fields,
    defaults,
  };
}

const TOKEN_HELP = {
  name: `Use ${NAME} where the project's name belongs.`,
  area: `Use ${AREA} where the area's name belongs.`,
  developer: `Use ${DEVELOPER} where the developer's name belongs.`,
} as const;

/**
 * One section per band on the project page, keyed to match
 * `DEVELOPMENT_SECTIONS` — the same keys the per-project editor shows, in the
 * same order, so the two screens read as two views of one page rather than as
 * two unrelated forms.
 *
 * A band appears here only if the page has built-in wording for it. `subnav`
 * has none, and the intro fields that render only when someone writes one
 * (features, faq, developer, advisor) are deliberately absent: declaring an
 * empty-by-design field here would put prose on the page that has never been
 * there.
 */
export const DEVELOPMENT_PAGE_COPY_SECTIONS: SectionDef[] = [
  copyBand(
    "hero",
    "Hero",
    "The two buttons under the headline stats.",
    [
      text("brochure_label", "Brochure button", { max: 60 }),
      text("interest_label", "Interest button", { max: 60 }),
    ],
    {
      brochure_label: "Download Brochure",
      brochure_label_ar: "تحميل ملف المشروع",
      interest_label: "Register Your Interest",
      interest_label_ar: "سجّل اهتمامك",
    },
    "The headline itself is the project's name and the standfirst is its tagline — both come from the record.",
  ),
  copyBand(
    "overview",
    "Overview",
    "The summary beside the key facts.",
    [
      sharedEyebrow(""),
      sharedHeading(TOKEN_HELP.area),
      text("heading_no_area", "Heading without an area", {
        max: 160,
        help: "Used instead when the project has no area on its record.",
      }),
    ],
    {
      eyebrow: "Discover the Community",
      eyebrow_ar: "اكتشف المجتمع",
      // The token is the whole point of this entry: all 22 projects had this
      // sentence typed out with the area spelled in by hand.
      heading: `A Community Within ${AREA}`,
      heading_ar: `مجتمع متكامل في ${AREA}`,
      heading_no_area: "About This Development",
      heading_no_area_ar: "عن هذا المشروع",
    },
    "The body is the project's own vision statement, from its record.",
  ),
  copyBand(
    "master-plan",
    "Master plan",
    "The site plan and its pins.",
    [sharedEyebrow(""), sharedHeading("")],
    {
      eyebrow: "Explore the Project",
      eyebrow_ar: "استكشف المشروع",
      heading: "Master Plan",
      heading_ar: "المخطط الرئيسي",
    },
  ),
  copyBand(
    "payment-plan",
    "Payment plan",
    "The instalment schedule and its calculator.",
    [sharedEyebrow(`Use ${PLAN} where the plan's name belongs.`), sharedHeading("")],
    {
      eyebrow: "Plan Your Purchase",
      eyebrow_ar: "خطط لعملية الشراء",
      heading: "Payment Plan",
      // The client's published wording. `lib/i18n/mt/glossary.ts` binds
      // "payment plan" to خطة السداد, which is what a machine draft would
      // produce — but this is curated copy already live on 22 pages, and the
      // glossary governs generation, not what the client has decided to say.
      heading_ar: "خطة الدفع",
    },
    "The schedule itself comes from the project's record.",
  ),
  copyBand(
    "units",
    "Units",
    "The availability table.",
    [
      sharedEyebrow(
        `Use ${DEVELOPMENT_TOKENS.available} and ${DEVELOPMENT_TOKENS.total} for the two counts.`,
      ),
      sharedHeading(""),
    ],
    {
      /*
       * The two bands nobody has overridden on any project, so these are the
       * wording the page shipped with rather than the client's. No project in
       * the catalogue carries unit inventory or an unfiled floor plan, so the
       * band has never appeared in front of an editor — inventing house-style
       * copy for it here would be writing for a screen nobody has seen.
       */
      eyebrow: `Available units · ${DEVELOPMENT_TOKENS.available} of ${DEVELOPMENT_TOKENS.total} remaining`,
      eyebrow_ar: `الوحدات المتاحة · ${DEVELOPMENT_TOKENS.available} من ${DEVELOPMENT_TOKENS.total} متبقية`,
      heading: "What's left",
      heading_ar: "ما تبقّى",
    },
    "The rows come from the project's units.",
  ),
  copyBand(
    "floor-plans",
    "Floor plans",
    "Layouts filed under no unit type.",
    [sharedEyebrow(""), sharedHeading("")],
    {
      eyebrow: "Floor plans",
      eyebrow_ar: "المخططات الطابقية",
      heading: "How the units lay out",
      heading_ar: "توزيع الوحدات",
    },
  ),
  copyBand(
    "renders",
    "Renders",
    "Interior and exterior imagery, side by side.",
    [
      sharedEyebrow(""),
      sharedHeading(""),
      text("interior_heading", "Interior column heading", { max: 60 }),
      text("exterior_heading", "Exterior column heading", { max: 60 }),
    ],
    {
      eyebrow: "Explore the Project",
      eyebrow_ar: "استكشف المشروع",
      heading: "Project Images",
      heading_ar: "صور المشروع",
      interior_heading: "Interior Renders",
      interior_heading_ar: "تصاميم داخلية",
      exterior_heading: "Exterior Renders",
      exterior_heading_ar: "تصاميم خارجية",
    },
  ),
  copyBand(
    "features",
    "Features",
    "Amenity and finish highlights.",
    [sharedEyebrow(TOKEN_HELP.name), sharedHeading("")],
    {
      eyebrow: "Discover More",
      eyebrow_ar: "اكتشف المزيد",
      heading: "Project Features",
      heading_ar: "مميزات المشروع",
    },
  ),
  copyBand(
    "unit-plans",
    "Units & floor plans",
    "Unit-type buttons and the layouts under each.",
    [sharedEyebrow(""), sharedHeading(""), sharedIntro(TOKEN_HELP.name)],
    {
      eyebrow: "Browse the Options",
      eyebrow_ar: "تصفح الخيارات",
      heading: "Units & Floor Plans",
      heading_ar: "الوحدات ومخططات الطوابق",
      intro: "Choose the layout that best suits your lifestyle.",
      intro_ar: "اختر المخطط الذي يناسب أسلوب حياتك.",
    },
  ),
  copyBand(
    "location",
    "Location",
    "The map and its surroundings.",
    [sharedEyebrow(""), sharedHeading(TOKEN_HELP.name), sharedIntro("")],
    {
      eyebrow: "Explore the Area",
      eyebrow_ar: "استكشف المنطقة",
      heading: "Location",
      heading_ar: "الموقع",
      // The curly apostrophe is the client's, kept byte-for-byte: this string
      // is already published on 22 pages and a straight quote here would show
      // up as a diff on all of them.
      intro: "See where the community is located and what’s nearby.",
      intro_ar: "تعرّف على موقع المجتمع وما يحيط به.",
    },
  ),
  copyBand(
    "nearby",
    "Nearby developments",
    "Other projects going up around this one.",
    [
      sharedEyebrow(TOKEN_HELP.area),
      sharedHeading(""),
      sharedIntro(TOKEN_HELP.area),
    ],
    {
      eyebrow: "Nearby Opportunities",
      eyebrow_ar: "فرص قريبة",
      heading: "Nearby Developments",
      heading_ar: "المشاريع القريبة",
      intro: "Explore a selection of developments located nearby.",
      intro_ar: "استكشف مجموعة من المشاريع القريبة.",
    },
    "The cards come from the neighbours picked on the project, or from the same area's published projects.",
  ),
  copyBand(
    "developer",
    "Developer",
    "The label and heading above the developer's card.",
    [sharedEyebrow(""), sharedHeading("")],
    {
      eyebrow: "Behind the Project",
      eyebrow_ar: "وراء المشروع",
      heading: "Developer",
      // The glossary binding. A bare مطور is a software one.
      heading_ar: "المطور العقاري",
    },
    "The card itself — name, founding year, profile copy — comes from the developer's record.",
  ),
  copyBand(
    "other-projects",
    "Other projects",
    "Siblings by the same developer.",
    [sharedEyebrow(TOKEN_HELP.developer), sharedHeading("")],
    {
      eyebrow: "Explore More",
      eyebrow_ar: "استكشف المزيد",
      heading: "Other Projects",
      heading_ar: "مشاريع أخرى",
    },
  ),
  copyBand(
    "faq",
    "FAQs",
    "Questions, with FAQPage schema for search.",
    [sharedEyebrow(""), sharedHeading("")],
    {
      eyebrow: "Need to Know",
      eyebrow_ar: "معلومات تهمك",
      heading: "FAQs",
      heading_ar: "الأسئلة الشائعة",
    },
  ),
  copyBand(
    "advisor",
    "Advisor banner",
    "The label and heading on the lead-advisor prompt.",
    [sharedEyebrow(""), sharedHeading("")],
    {
      eyebrow: "Need Assistance?",
      eyebrow_ar: "هل تحتاج إلى مساعدة؟",
      heading: "Speak With an Advisor",
      heading_ar: "تحدث مع مستشار عقاري",
    },
    "The banner — advisor, photo, pull quote — comes from the advisor's team record.",
  ),
];

/**
 * The document presented as a `MasterPageDef`, so it goes straight through
 * `resolveSections` / `validateSections` and into the shared editor without a
 * parallel implementation — the same trick `developerPageCopyDef` uses.
 */
export function developmentPageCopyDef(): MasterPageDef {
  return {
    key: `development/${DEVELOPMENT_PAGE_COPY_KEY}` as unknown as MasterPageKey,
    label: "Project pages",
    path: "/developments",
    description:
      "The eyebrows, headings and standfirsts every /developments/<slug> page shares.",
    sections: DEVELOPMENT_PAGE_COPY_SECTIONS,
  };
}

/** Exported for the guards that enumerate every registry's field lists. */
export function developmentPageFieldLists(): {
  origin: string;
  fields: FieldDef[];
}[] {
  return DEVELOPMENT_PAGE_COPY_SECTIONS.map((s) => ({
    origin: `development-page:${s.key}`,
    fields: s.fields,
  }));
}

/**
 * The shipped English wording for one field, or null if this document does not
 * carry it.
 *
 * Exists so `DEVELOPMENT_SECTIONS` in `./subpages.ts` can quote the shared
 * default in the per-project editor's help text without retyping it. That help
 * text used to hold its own copy of every string here — `Blank keeps
 * “Overview”.` beside `?? "Overview"` in the page — which is three copies of
 * one word and two of them free to drift. This is the one.
 */
export function developmentPageCopyDefault(
  sectionKey: string,
  field: string,
): string | null {
  const section = DEVELOPMENT_PAGE_COPY_SECTIONS.find(
    (s) => s.key === sectionKey,
  );
  const value = section?.defaults[field];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
