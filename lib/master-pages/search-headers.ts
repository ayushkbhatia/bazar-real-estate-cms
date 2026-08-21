/**
 * The search-results page headers — the eyebrow, headline and sub-title that
 * sit above the filter bar on `/buy/search`, `/rent/search`, `/off-plan/search`,
 * `/commercial/search`, `/buy/ready` and `/buy/resale`.
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
 *  - page builder   — open composition; these are three fixed fields.
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
 * docs/I18N.md, "I added a new section": nothing to do. The Arabic defaults
 * below are hand-declared rather than left to the store because they already
 * existed, curated, in `messages/ar/search.json`; they were moved here verbatim
 * when the catalogue keys were retired, so `/ar` renders exactly what it did.
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
 * The three fields, identical on all seven facets.
 *
 * `eyebrow` and `subtitle` are optional and `title` is not, and that split is
 * deliberate. A blank eyebrow or sub-title is a legible editorial choice and
 * the page simply drops the element; a blank h1 is a broken page, so clearing
 * it falls back to the shipped headline rather than rendering an empty heading.
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
    description: "The eyebrow, headline and sub-title above the filter bar.",
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
  "Only these three lines. The result count, the filter chips and the listings under them are drawn from the catalogue, and the filter labels are shared with the rest of the site.";

/*
 * Defaults are the copy these pages have rendered since they shipped, lifted
 * verbatim from `search.mode.*` / `search.form.*` in `messages/` when those
 * keys were retired — English and Arabic both, so an un-edited document renders
 * byte-identically to before this existed on `/en` and on `/ar`.
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
