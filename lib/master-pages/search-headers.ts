/**
 * The search-results page headers — the eyebrow, headline and sub-title above
 * the filter bar on `/buy/search`, `/rent/search`, `/off-plan/search`,
 * `/commercial/search`, `/buy/ready` and `/buy/resale`, plus the title and
 * description each of them publishes to a search engine.
 *
 * ## Why a fifth registry rather than a message key
 *
 * These three lines used to be `search.mode.<mode>.*` and `search.form.<form>.*`
 * in `messages/`, which made them the only prose on the busiest six routes on
 * the site that the client could not change. Editing them meant a pull request.
 *
 * They do not belong to any of the four existing registries either:
 *
 *  - master pages   — `/buy` is the marketing LANDING; `/buy/search` is a
 *                     different route with a different job. Filing this under
 *                     `buy` would put two competing heroes in one document.
 *  - sub-pages      — those exist once per database record. A search header
 *                     exists once per *facet*, and a facet is not a row.
 *  - page builder   — open composition; these are five fixed fields.
 *  - section library — that is content one edit changes on EVERY surface. A
 *                     search header is the opposite: it is the one thing that
 *                     must differ per route, because /buy/ready and /buy/resale
 *                     sharing an h1 is the exact bug this project spent 27
 *                     migrations not noticing.
 *
 * So: its own registry, its own document per facet, addressed by the same
 * `(mode, form)` pair `SearchList` already computes.
 *
 * ## Why it reuses the master-page machinery wholesale
 *
 * A `SearchHeaderDef` wraps a plain `SectionDef`, so `resolveSections`,
 * `validateSections`, `mergeValues`, the shared field editor and — the reason
 * that matters — `withArabicTwinsDeep` all work with no new code. See
 * docs/I18N.md, "I added a new section": nothing to do.
 *
 * ## The Arabic, and where it comes from
 *
 * Hand-declared in `defaults` beside each English sibling rather than left to
 * `lib/master-pages/arabic/master.json`, which ADR-0008 §3 names as the home
 * for a machine draft. The deviation is deliberate and it is about keeping ONE
 * mechanism in one section: the three copy fields were moved here verbatim from
 * `messages/ar/search.json` — curated Arabic that predates this file and
 * outranks any draft — so storing only the other two would split five fields
 * across two sources and make "where does this string's Arabic live" a question
 * with two answers. Declaring in `defaults` keeps everything ADR-0008 §3
 * actually wants: reviewed as a pull-request diff with the English on the line
 * above, revertable with `git revert`, and checked in CI with no credentials.
 *
 * Provenance, since a per-entry `by`/`model`/`at` is what the store buys and
 * this does not:
 *
 *  - `eyebrow_ar`, `title_ar`, `subtitle_ar` — CURATED. Lifted verbatim from
 *    `search.mode.*` / `search.form.*` in `messages/ar/search.json` when those
 *    keys were retired.
 *  - `meta_title_ar`, `meta_description_ar` — MACHINE FIRST DRAFT (claude-opus-5,
 *    2026-08-21) under ADR-0008: the client edits them at
 *    /admin/pages/sub/search/<key> and their edit wins structurally, because
 *    `mergeValues` never overwrites a twin that already holds a value. They
 *    passed the structural gates in `lib/i18n/mt/validate.ts`; the semantic
 *    round trip was NOT run, so the client's review is the only real gate on
 *    them — which is ADR-0008's own stated position.
 *
 * Where a meta string repeats a copy string word for word — `/buy`'s title,
 * `/off-plan`'s description — the Arabic repeats too. One English, one Arabic,
 * which is `messages.test.ts`'s strongest assertion applied to content.
 *
 * ## Storage
 *
 * `pages.blocks` under `subpage/search/<key>`, via `subPageSlug("search", key)`.
 * Same jsonb column as every other registry here, no migration, and the
 * reserved slug prefix keeps the rows out of `/pages/[slug]` and out of the
 * Pages list.
 */

import type { PropertyForm, PropertyMode } from "@/lib/schemas/property";
import { area, text } from "./fields";
import type { FieldDef, MasterPageDef, MasterPageKey, SectionDef } from "./types";

/** Keys are storage. Renaming one orphans its document — add, never rename. */
export type SearchHeaderKey =
  | "buy"
  | "rent"
  | "off-plan"
  | "commercial"
  | "ready-new"
  | "resale"
  | "off-plan-sale";

export type SearchHeaderDef = {
  key: SearchHeaderKey;
  label: string;
  /** One line for the index card and the editor. */
  description: string;
  /**
   * Which search surface this header renders on, as the pair `SearchList`
   * already derives. `form` wins over `mode` there, so the three form facets
   * carry both and the four mode facets carry only a mode.
   */
  match: { mode: PropertyMode; form?: PropertyForm };
  /** Where an editor goes to see it — the "View page" link. */
  publicPath: string;
  /**
   * Route to invalidate after a save. Split from `publicPath` because
   * `revalidatePath` takes a path and `/buy/search?form=off_plan` is a path
   * plus a facet: revalidating the string with the query in it names a cache
   * key that does not exist and silently no-ops.
   */
  revalidatePath: string;
  /** The one editable section this entry owns. */
  section: SectionDef;
};

/** Storage key for the one section inside every header document. */
export const SEARCH_HEADER_SECTION_KEY = "header";

/**
 * The five fields, identical on all seven facets.
 *
 * `eyebrow` and `subtitle` are optional and the other three are not, and that
 * split is deliberate. A blank eyebrow or sub-title is a legible editorial
 * choice and the page simply drops the element; a blank h1 is a broken page, so
 * clearing it falls back to the shipped headline rather than rendering an empty
 * heading, and a blank snippet is a search result with no words in it.
 */
function headerFields(): FieldDef[] {
  return [
    text("eyebrow", "Eyebrow", {
      max: 60,
      optional: true,
      help: "The small uppercase label above the headline. Leave blank to drop it.",
    }),
    text("title", "Title", {
      max: 120,
      help: "The page's h1, above the filter bar. Cleared, the shipped headline comes back — a search page never renders an empty heading.",
    }),
    area("subtitle", "Sub-title", {
      max: 400,
      optional: true,
      help: "The line under the headline. Leave blank to drop it.",
    }),
    /*
     * The search-engine snippet, in the same document as the copy above it
     * rather than in `pages.seo`.
     *
     * `search_appearance` is keyed by `MasterPageKey` and stored on the
     * `master/<key>` row — it has no address for a facet of a search route,
     * and giving it one would mean a second storage shape for two strings.
     * The `compare` library section already holds its own `meta_title` and
     * `meta_description` as ordinary section fields for exactly this reason,
     * and this follows it.
     */
    text("meta_title", "Browser tab title", {
      max: 80,
      help: "Shown in the browser tab and in search results. “ · Bazar” is added after it.",
    }),
    area("meta_description", "Search description", {
      max: 320,
      optional: false,
      help: "The grey line under the link in search results.",
    }),
  ];
}

function headerSection(
  label: string,
  dataNote: string,
  defaults: Record<string, string>,
): SectionDef {
  return {
    key: SEARCH_HEADER_SECTION_KEY,
    label,
    description:
      "The eyebrow, headline and sub-title above the filter bar, and what the page publishes to a search engine.",
    // Nothing to hide it from: the section *is* the document, and the page is
    // structurally built around its heading.
    locked: true,
    dataNote,
    fields: headerFields(),
    defaults,
  };
}

/**
 * The shared note under every editor.
 *
 * Worth stating once per facet rather than once per registry: the thing an
 * editor will reach for next — the result count, the filter chips, the cards —
 * is not here, and finding that out by scrolling a form is the slow way.
 */
const DATA_NOTE =
  "Only this page's own words. The result count, the filter chips and the listings under them are drawn from the catalogue, and the filter labels are shared with the rest of the site.";

/*
 * Defaults are what these pages have published since they shipped: the copy
 * lifted verbatim from `search.mode.*` / `search.form.*` in `messages/` when
 * those keys were retired, and the snippet lifted verbatim from each route's
 * own `export const metadata`. An un-edited document therefore renders
 * byte-identically to before this existed — on `/en`, and on `/ar` for the copy.
 *
 * The one addition is `/ar`'s snippet, which did not exist: all six routes
 * declared an English literal and published it in both languages. That is the
 * failure `metadata-arabic.test.ts` calls worse than an untranslated page,
 * because an Arabic page carrying an English title into a search result looks
 * finished.
 */
const BUY: SearchHeaderDef = {
  key: "buy",
  label: "Buy · all results",
  description:
    "The umbrella sale search — every for-sale listing, before a completion form narrows it.",
  match: { mode: "buy" },
  publicPath: "/buy/search",
  revalidatePath: "/buy/search",
  section: headerSection("Buy · all results", DATA_NOTE, {
    eyebrow: "For sale",
    eyebrow_ar: "للبيع",
    title: "Properties for sale",
    title_ar: "شقق وفلل للبيع",
    subtitle:
      "Curated freehold and leasehold listings across the United Arab Emirates.",
    subtitle_ar:
      "تملك حر وحق انتفاع: قوائم عقارية منتقاة في الإمارات العربية المتحدة.",
    meta_title: "Properties for sale",
    // Same English as the headline, so the same Arabic. Diverging here would
    // give one string two translations on one page.
    meta_title_ar: "شقق وفلل للبيع",
    meta_description:
      "Curated freehold and leasehold properties for sale across the United Arab Emirates.",
    // "تملك حر" and "حق انتفاع", not "التملك الحر" — `lib/i18n/mt/glossary.ts`
    // holds the settled UAE-practice renderings and the check is a stem match.
    meta_description_ar:
      "عقارات منتقاة للبيع بنظام تملك حر وحق انتفاع في مختلف أنحاء الإمارات العربية المتحدة.",
  }),
};

const RENT: SearchHeaderDef = {
  key: "rent",
  label: "Rent",
  description: "The tenancy search.",
  match: { mode: "rent" },
  publicPath: "/rent/search",
  revalidatePath: "/rent/search",
  section: headerSection("Rent", DATA_NOTE, {
    eyebrow: "For rent",
    eyebrow_ar: "للإيجار",
    title: "Properties for rent",
    title_ar: "عقارات للإيجار",
    subtitle:
      "Long-let homes from advisor-vetted landlords. Furnished and unfurnished.",
    subtitle_ar:
      "منازل للإيجار طويل الأمد من ملاك موثوقين لدى مستشارينا. مفروشة وغير مفروشة.",
    meta_title: "Properties for rent",
    meta_title_ar: "عقارات للإيجار",
    meta_description:
      "Long-let homes from advisor-vetted landlords across the United Arab Emirates.",
    meta_description_ar:
      "منازل للإيجار طويل الأمد من ملاك موثوقين لدى مستشارينا في مختلف أنحاء الإمارات العربية المتحدة.",
  }),
};

const OFF_PLAN: SearchHeaderDef = {
  key: "off-plan",
  label: "Off-plan",
  description: "The developments search at /off-plan/search.",
  match: { mode: "off_plan" },
  publicPath: "/off-plan/search",
  revalidatePath: "/off-plan/search",
  section: headerSection("Off-plan", DATA_NOTE, {
    eyebrow: "Off-plan",
    eyebrow_ar: "على الخارطة",
    title: "New developments",
    title_ar: "شروع جديدة",
    subtitle:
      "Pre-launch and on-sale developments from Abu Dhabi's leading developers.",
    subtitle_ar: "مشاريع قبل الطرح وأخرى معروضة للبيع من أبرز مطوّري أبوظبي.",
    meta_title: "Off-plan developments",
    meta_title_ar: "مشاريع على الخارطة",
    // Word for word the sub-title above, so word for word the same Arabic.
    meta_description:
      "Pre-launch and on-sale developments from Abu Dhabi's leading developers.",
    meta_description_ar:
      "مشاريع قبل الطرح وأخرى معروضة للبيع من أبرز مطوّري أبوظبي.",
  }),
};

const COMMERCIAL: SearchHeaderDef = {
  key: "commercial",
  label: "Commercial",
  description: "The commercial search — offices, retail and industrial.",
  match: { mode: "commercial" },
  publicPath: "/commercial/search",
  revalidatePath: "/commercial/search",
  section: headerSection("Commercial", DATA_NOTE, {
    eyebrow: "Commercial",
    eyebrow_ar: "تجاري",
    title: "Commercial real estate",
    title_ar: "المشاريع العقارية التجارية",
    subtitle: "Office, retail, and industrial leases and freeholds.",
    subtitle_ar:
      "إيجارات وتملك حر للمكاتب والمحلات التجارية والوحدات الصناعية.",
    meta_title: "Commercial property for sale and lease",
    meta_title_ar: "عقارات تجارية للبيع والإيجار",
    meta_description:
      "Office, retail, and industrial leases and freeholds across the United Arab Emirates.",
    meta_description_ar:
      "إيجارات وتملك حر للمكاتب والمحلات التجارية والوحدات الصناعية في مختلف أنحاء الإمارات العربية المتحدة.",
  }),
};

/*
 * The three completion-form facets. They are separate documents rather than
 * one, because the whole reason `form` outranks `mode` in `SearchList` is that
 * /buy/ready and /buy/resale must never share an h1.
 *
 * `ready_new` is PROVENANCE, not age: it means the developer's first sale,
 * never previously owned. Never describe it as "recently built".
 */
const READY_NEW: SearchHeaderDef = {
  key: "ready-new",
  label: "Buy · ready (new)",
  description:
    "Completed homes on their first sale — the developer's own stock, never previously owned.",
  match: { mode: "buy", form: "ready_new" },
  publicPath: "/buy/ready",
  revalidatePath: "/buy/ready",
  section: headerSection("Buy · ready (new)", DATA_NOTE, {
    eyebrow: "Ready · new",
    eyebrow_ar: "جاهز · جديد",
    title: "Ready homes, never lived in",
    title_ar: "منازل جاهزة، لم تُسكن من قبل",
    subtitle:
      "Completed, handed over, and bought direct from the developer — a first sale with no previous owner on the title.",
    subtitle_ar:
      "مكتمل ومُسلَّم ومُشترى مباشرة من المطور العقاري — بيع أول دون مالك سابق في سند الملكية.",
    meta_title: "Ready homes, never lived in",
    meta_title_ar: "منازل جاهزة، لم تُسكن من قبل",
    meta_description:
      "Completed properties for sale direct from the developer — a first sale with no previous owner on the title, ready to move into.",
    meta_description_ar:
      "عقارات مكتملة للبيع مباشرة من المطور العقاري — بيع أول دون مالك سابق في سند الملكية، جاهزة للسكن.",
  }),
};

const RESALE: SearchHeaderDef = {
  key: "resale",
  label: "Buy · resale",
  description: "Previously owned homes, bought from the current owner.",
  match: { mode: "buy", form: "resale" },
  publicPath: "/buy/resale",
  revalidatePath: "/buy/resale",
  section: headerSection("Buy · resale", DATA_NOTE, {
    eyebrow: "Resale",
    eyebrow_ar: "إعادة بيع",
    title: "Resale homes",
    title_ar: "فلل وشقق إعادة بيع",
    subtitle:
      "Completed homes bought from the current owner, with established communities, real service-charge history and a negotiable price.",
    subtitle_ar:
      "منازل جاهزة بالشراء من المالك الحالي، في مجتمعات قائمة، مع سجل فعلي لرسوم الخدمات وسعر قابل للتفاوض.",
    meta_title: "Resale homes for sale",
    // "Resale homes for sale" doubles back on itself in Arabic — إعادة البيع
    // already carries "for sale". The compressed form is the faithful one.
    meta_title_ar: "عقارات إعادة البيع",
    meta_description:
      "Previously owned properties for sale across the United Arab Emirates — bought from the current owner, in established communities with a known service-charge history.",
    meta_description_ar:
      "عقارات مملوكة سابقاً معروضة للبيع في مختلف أنحاء الإمارات العربية المتحدة — تُشترى من المالك الحالي، في مجتمعات قائمة بسجل معروف لرسوم الخدمات.",
  }),
};

/**
 * The off-plan slice *of buy* — `/buy/search?form=off_plan`, not `/off-plan`.
 *
 * It has no route of its own: the facet is honoured on `/buy/search` only,
 * because "buy" is the umbrella that spans all three completion forms and it is
 * the one surface where narrowing on that second axis means anything. It gets
 * its own document all the same, so it cannot borrow the `/off-plan` heading.
 */
const OFF_PLAN_SALE: SearchHeaderDef = {
  key: "off-plan-sale",
  label: "Buy · off-plan",
  description:
    "The off-plan slice of the sale search, reached from the completion filter rather than from its own route.",
  match: { mode: "buy", form: "off_plan" },
  publicPath: "/buy/search?form=off_plan",
  revalidatePath: "/buy/search",
  section: headerSection("Buy · off-plan", DATA_NOTE, {
    eyebrow: "Off-plan · for sale",
    eyebrow_ar: "على الخارطة · للبيع",
    title: "Off-plan homes for sale",
    title_ar: "عقارات على الخارطة للبيع",
    subtitle:
      "Bought from the developer before handover — a purchase on a payment plan, with the longest run to completion and the earliest choice of unit.",
    subtitle_ar:
      "تُشترى من المطوّر قبل التسليم — عملية شراء بخطة سداد، بأطول مدة حتى الإنجاز وأسبقية في اختيار الوحدة.",
    meta_title: "Off-plan homes for sale",
    meta_title_ar: "عقارات على الخارطة للبيع",
    /*
     * The one snippet with no literal to lift: `/buy/search?form=off_plan` is a
     * facet of a route, so it published the umbrella's metadata. Written to the
     * shape of its five siblings.
     */
    meta_description:
      "Off-plan properties for sale across the United Arab Emirates — bought from the developer before handover, on a payment plan, with the earliest choice of unit.",
    meta_description_ar:
      "عقارات على الخارطة للبيع في مختلف أنحاء الإمارات العربية المتحدة — تُشترى من المطور العقاري قبل التسليم، بخطة السداد، مع أسبقية في اختيار الوحدة.",
  }),
};

export const SEARCH_HEADERS: SearchHeaderDef[] = [
  BUY,
  READY_NEW,
  RESALE,
  OFF_PLAN_SALE,
  RENT,
  OFF_PLAN,
  COMMERCIAL,
];

export function getSearchHeader(key: string): SearchHeaderDef | null {
  return SEARCH_HEADERS.find((h) => h.key === key) ?? null;
}

export function isSearchHeaderKey(key: string): key is SearchHeaderKey {
  return SEARCH_HEADERS.some((h) => h.key === key);
}

/**
 * The document a given search surface reads.
 *
 * Mirrors `SearchList`'s own precedence exactly — `form` wins over `mode` —
 * because the two must not be able to disagree about which header a route gets.
 * Falls back to the mode-only entry when a form arrives that nothing declares,
 * so a new `property_form` value renders the umbrella copy rather than nothing.
 */
export function searchHeaderFor(
  mode: PropertyMode,
  form?: PropertyForm | null,
): SearchHeaderDef {
  if (form) {
    const byForm = SEARCH_HEADERS.find(
      (h) => h.match.mode === mode && h.match.form === form,
    );
    if (byForm) return byForm;
  }
  const byMode = SEARCH_HEADERS.find(
    (h) => h.match.mode === mode && !h.match.form,
  );
  // `buy` is declared, so this is unreachable for any real mode; it exists so
  // the return type is not nullable and no caller has to branch on it.
  return byMode ?? BUY;
}

/**
 * A search header presented as a `MasterPageDef`, so it goes straight through
 * `resolveSections` / `validateSections` and into the shared editor without a
 * parallel implementation — the same trick `librarySectionPageDef` uses.
 */
export function searchHeaderPageDef(def: SearchHeaderDef): MasterPageDef {
  return {
    key: `search/${def.key}` as unknown as MasterPageKey,
    label: def.label,
    path: def.publicPath,
    description: def.description,
    sections: [def.section],
  };
}

/** Exported for the guards that enumerate every registry's field lists. */
export function searchHeaderFieldLists(): { origin: string; fields: FieldDef[] }[] {
  return SEARCH_HEADERS.map((h) => ({
    origin: `search-header:${h.key}`,
    fields: h.section.fields,
  }));
}
