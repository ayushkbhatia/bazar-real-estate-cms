/**
 * The section library — content that belongs to the SITE rather than to a page.
 *
 * ## Why a fourth registry
 *
 * The three that exist all answer "what does *this page* say":
 *
 *  - master pages    — fixed composition, one document per route
 *  - sub-pages       — fixed composition, one document per record
 *  - page builder    — open composition, one document per campaign page
 *
 * Testimonials fit none of them. The same three quotes render on the home page
 * and on any landing page that places the block, so filing them under `home`
 * would make the home page the owner of copy two other surfaces read — and the
 * first time a marketing manager edited a quote on a landing page, the site
 * would carry two versions of the same client's words.
 *
 * So a library section is addressed by its own key, stored in its own document,
 * and *read* by whatever wants it. Editing happens in exactly one place.
 *
 * ## Why it reuses the master-page machinery wholesale
 *
 * A `LibrarySectionDef` wraps a plain `SectionDef`, which means `resolveSections`,
 * `validateSections`, `mergeValues`, `attachImageUrls`, the field editor and —
 * the reason that matters — `withArabicTwinsDeep` all work with no new code.
 * Every `text` and `textarea` field below gets its Arabic twin derived, stored
 * beside its English sibling, and folded at read time by `applyLocale`. See
 * docs/I18N.md, "I added a new section": nothing to do.
 *
 * ## Storage
 *
 * `pages.blocks` under `subpage/section/<key>`, via `subPageSlug("section", key)`.
 * Same jsonb column as everything else here, no migration, and the reserved
 * slug prefix keeps the row out of `/pages/[slug]` and out of the Pages list.
 */

import { SEED_TESTIMONIALS, type Testimonial } from "@/lib/seeds/awards";
import { area, text as textField } from "./fields";
import type {
  FieldDef,
  ItemValue,
  ListFieldDef,
  MasterPageDef,
  MasterPageKey,
  SectionDef,
  SectionValues,
} from "./types";

/** Keys are storage. Renaming one orphans its document — add, never rename. */
export type LibrarySectionKey = "testimonials" | "shortlist" | "compare";

export type LibrarySectionDef = {
  key: LibrarySectionKey;
  label: string;
  /** One line for the index card and the editor. */
  description: string;
  /** Singular noun for counts and empty states. */
  itemLabel: string;
  /**
   * Where the section renders today. Listed in the editor so an editor can see
   * what one edit changes before they make it — the whole hazard of shared
   * content is that its blast radius is invisible from the form.
   */
  usedOn: { label: string; href: string }[];
  /**
   * What the entry's index card counts.
   *
   * `list` sections own a repeating `items` list and the card says "3 of 12
   * reviews shown"; `fields` sections own a flat bag of copy and the card
   * says how many strings it holds. The index used to assume the first shape
   * for everything, so a copy section reported "0 of 0 … shown".
   */
  shape: "list" | "fields";
  /** Label for the editor's revert control — "Reset to the shipped reviews". */
  resetLabel: string;
  /** The one editable section this library entry owns. */
  section: SectionDef;
};

/**
 * The ceiling on the reviews list, and the number "show all" resolves to.
 *
 * Every reader of the list takes a `limit` and slices, and "all" has to be
 * expressible as a number because the page-builder loader collapses several
 * blocks into one request for the largest slice (`collectDataRequest`). Making
 * it the same constant the list is capped at means "all" and "the most that can
 * exist" are the same number by construction rather than by two people
 * remembering to change both.
 */
export const TESTIMONIALS_MAX = 24;

/**
 * A stored "How many to show" value, as a number of reviews to slice to.
 *
 * Three surfaces choose a count — the home page's master-page section, the
 * page-builder block, and `collectDataRequest`, which collapses several blocks
 * into one request for the largest slice — and all three used to parse the
 * string themselves with a hardcoded `|| 3` fallback. That fallback is what
 * made "all" unrepresentable: `Number.parseInt("all")` is NaN, so the option
 * would have silently meant three.
 *
 * Absent or unparseable resolves to the whole list rather than to three. An
 * editor who has never opened this field has not asked for a cap.
 */
export function testimonialLimitOf(raw: string | null | undefined): number {
  if (!raw || raw === "all") return TESTIMONIALS_MAX;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, TESTIMONIALS_MAX) : TESTIMONIALS_MAX;
}

/**
 * The reviews list.
 *
 * `max` is `TESTIMONIALS_MAX` rather than 3: the cards render as a carousel, so
 * the count is no longer bounded by what fits in a row. An editor can put the
 * whole approved bench on the page, or keep a longer bench than they show and
 * rotate which ones lead by switching the rest off.
 */
function reviewList(): ListFieldDef {
  return {
    key: "items",
    label: "Reviews",
    kind: "list",
    itemLabel: "review",
    max: TESTIMONIALS_MAX,
    help: "Every review switched on rides the carousel, in the order you add them — the home page is not capped at three any more. Drag is not available here; switching one off keeps it for later without showing it.",
    fields: [
      { key: "enabled", label: "Show this review", kind: "toggle" },
      {
        key: "quote",
        label: "Quote",
        kind: "textarea",
        max: 600,
        optional: false,
        help: "The client's own words. Quote marks are drawn by the card — don't type them.",
      },
      {
        key: "attribution",
        label: "Who said it",
        kind: "text",
        max: 120,
        help: "How the client is described — “Couple buying on Saadiyat Reserve”. The card draws their initials from this.",
      },
      {
        key: "context",
        label: "Context",
        kind: "text",
        max: 120,
        optional: true,
        help: "The small line under the name — “Off-market resale, 2025”.",
      },
    ],
  };
}

/**
 * Defaults are the three quotes the home page has rendered since it shipped,
 * read straight from the seed the components still fall back to. One copy, so
 * an un-edited document renders byte-identically to before this existed.
 */
const TESTIMONIAL_DEFAULTS = SEED_TESTIMONIALS.map((t) => ({
  enabled: true,
  quote: t.quote,
  attribution: t.attribution,
  context: t.context ?? null,
}));

export const TESTIMONIALS_SECTION: SectionDef = {
  key: "testimonials",
  label: "Testimonials",
  description:
    "The client reviews shown on the home page and anywhere the Testimonials block is placed.",
  // Nothing to hide it from: the section *is* the document. Whether it renders
  // is decided by the page that places it, not here.
  locked: true,
  dataNote:
    "The heading above the cards belongs to the page that places them — edit the home page's in Pages → Master pages → Home → Testimonials.",
  fields: [reviewList()],
  defaults: { items: TESTIMONIAL_DEFAULTS },
};

const TESTIMONIALS: LibrarySectionDef = {
  key: "testimonials",
  label: "Testimonials",
  description:
    "Client reviews, edited once and read by every surface that shows them.",
  itemLabel: "review",
  shape: "list",
  resetLabel: "Reset to the shipped reviews",
  usedOn: [
    { label: "Home", href: "/" },
    { label: "Any landing page with the Testimonials block", href: "/admin/page-builder" },
  ],
  section: TESTIMONIALS_SECTION,
};


/**
 * The shortlist card — the drawer that opens from the floating pill.
 *
 * ## Why its copy is here rather than in `messages/`
 *
 * The drawer is a client component in the public layout, so every string in it
 * used to be one of two things: a `common.shortlist.*` message, or an English
 * literal nobody had extracted. Neither is editable by the client, and the
 * second was not even translated — the card rendered "8 of 25 · saved to this
 * browser" and "Compare 4 side-by-side" in English on `/ar`.
 *
 * Moving the prose here fixes both at once: a library section gets its Arabic
 * twin derived (docs/I18N.md, "I added a new section"), so `/ar` renders Arabic
 * with nothing further to do, and the client can rewrite any of it at
 * /admin/pages/sub/section/shortlist.
 *
 * ## What deliberately did NOT move
 *
 * Anything carrying a count stays in the `common` catalogue as ICU — the
 * counts, the bed/bath line, the compare button. Arabic has six plural
 * categories and a CMS text input cannot express them; an editor typing
 * "{count} عقارات" would be wrong for one, two and eleven and nobody here could
 * see it. `savedCount` interpolates `storage_note` below, so the editable half
 * of that line is still editable and the numbers are still ICU's problem.
 */
const SHORTLIST_SECTION: SectionDef = {
  key: "shortlist",
  label: "Shortlist card",
  description:
    "The panel that slides out when a visitor opens their saved listings.",
  locked: true,
  dataNote:
    "Lines with a number in them — “8 of 25”, “Compare 4 side-by-side”, “3b · 2ba” — are not here. Arabic changes the wording of a sentence depending on the number, so those are handled in code; the words around them are the fields below.",
  fields: [
    textField("trigger_label", "Button label", {
      max: 40,
      help: "The floating pill in the corner. The count is added after it — “Shortlist · 8”.",
    }),
    textField("title", "Panel heading", { max: 60 }),
    textField("storage_note", "Storage note", {
      max: 80,
      help: "Reads after the count: “8 of 25 · saved to this browser”. Write only the part after the dot.",
    }),
    area("empty", "Empty state", {
      max: 240,
      optional: false,
      help: "Shown when the saved listings can't be loaded.",
    }),
    area("pick_help", "Picking help", {
      max: 300,
      optional: false,
      help: "Shown under the compare button once the visitor has saved more than four. Explains that the table takes four and the rest stay saved.",
    }),
    textField("whatsapp_label", "WhatsApp button", { max: 80 }),
    textField("email_label", "Email button", { max: 80 }),
    textField("clear_label", "Clear link", { max: 60 }),
    textField("area_fallback", "Area fallback", {
      max: 80,
      help: "Printed under a listing whose area is missing from the catalogue.",
    }),
  ],
  defaults: {
    trigger_label: "Shortlist",
    title: "Your shortlist",
    storage_note: "saved to this browser",
    empty: "Nothing to show — try saving a few listings first.",
    pick_help:
      "Tick up to four to put side by side. Everything else stays on your shortlist.",
    whatsapp_label: "WhatsApp these to an advisor",
    email_label: "Email me these",
    clear_label: "Clear shortlist",
    area_fallback: "United Arab Emirates",
  },
};

const SHORTLIST: LibrarySectionDef = {
  key: "shortlist",
  label: "Shortlist card",
  description:
    "The saved-listings panel, which opens over whatever page the visitor is on.",
  itemLabel: "line of copy",
  shape: "fields",
  resetLabel: "Reset to the shipped wording",
  usedOn: [{ label: "Every public page", href: "/" }],
  section: SHORTLIST_SECTION,
};

/**
 * The compare page's narrative copy.
 *
 * Scoped to the words a marketer would rewrite: the heading, the two empty
 * states, the slot prompts, the search-result metadata. The attribute NAMES —
 * "Asking price", "Tenure", "Freehold" — stay in the `tools` catalogue,
 * because they are a vocabulary the table shares with the filter bar and the
 * property page rather than copy belonging to this one screen. Forking them
 * here would let /tools/compare call a villa something the rest of the site
 * does not.
 */
const COMPARE_SECTION: SectionDef = {
  key: "compare",
  label: "Compare page",
  description: "The side-by-side comparison table at /tools/compare.",
  locked: true,
  dataNote:
    "Row names (“Asking price”, “Tenure”) and the values in them come from the property vocabulary the whole site shares, not from this page — amenities are edited at Settings → Fields.",
  fields: [
    textField("heading", "Page heading", { max: 80 }),
    textField("meta_title", "Browser tab title", {
      max: 80,
      help: "Shown in the browser tab and when the link is shared.",
    }),
    area("meta_description", "Search description", {
      max: 320,
      optional: false,
      help: "The grey line under the link in search results.",
    }),
    textField("what_differs", "“What differs” heading", { max: 60 }),
    textField("full_comparison", "“Full comparison” heading", { max: 60 }),
    textField("best_fit", "Best-fit badge", {
      max: 60,
      help: "The tag on the first column.",
    }),
    textField("empty_eyebrow", "Empty page · eyebrow", { max: 40 }),
    textField("empty_heading", "Empty page · heading", { max: 120 }),
    area("empty_body", "Empty page · body", { max: 500, optional: false }),
    textField("empty_cta", "Empty page · button", { max: 60 }),
    textField("slot_title", "Empty column · heading", { max: 80 }),
    area("slot_body", "Empty column · body", { max: 200, optional: false }),
    textField("slot_cta", "Empty column · button", { max: 60 }),
    textField("unresolved_title", "Missing listing · heading", { max: 80 }),
    area("unresolved_body", "Missing listing · body", {
      max: 200,
      optional: false,
    }),
    textField("unresolved_cta", "Missing listing · button", { max: 60 }),
  ],
  defaults: {
    heading: "Side by side",
    meta_title: "Compare properties",
    meta_description:
      "Compare up to 4 Abu Dhabi properties side-by-side across price, specifications, location, amenities, and investment fundamentals. Share the URL to send the comparison to a partner or advisor.",
    what_differs: "What differs",
    full_comparison: "Full comparison",
    best_fit: "Best fit · advisor pick",
    empty_eyebrow: "Compare",
    empty_heading: "Stack properties side by side.",
    empty_body:
      "Pull two to four properties into a comparison and we'll line up price, specs, location, amenities, and investment fundamentals. Share the URL to send the same comparison to a partner or advisor.",
    empty_cta: "Browse the marketplace",
    slot_title: "Add another property",
    slot_body: "Pull one in from your shortlist, or go find another",
    slot_cta: "Add from shortlist",
    unresolved_title: "Couldn't load this property",
    unresolved_body: "It may be off-market or no longer published.",
    unresolved_cta: "Browse",
  },
};

const COMPARE: LibrarySectionDef = {
  key: "compare",
  label: "Compare page",
  description:
    "The comparison table's own wording — the heading, the empty states and the column prompts.",
  itemLabel: "line of copy",
  shape: "fields",
  resetLabel: "Reset to the shipped wording",
  usedOn: [{ label: "Compare", href: "/tools/compare" }],
  section: COMPARE_SECTION,
};

export const LIBRARY_SECTIONS: LibrarySectionDef[] = [
  TESTIMONIALS,
  SHORTLIST,
  COMPARE,
];

export function getLibrarySection(key: string): LibrarySectionDef | null {
  return LIBRARY_SECTIONS.find((s) => s.key === key) ?? null;
}

export function isLibrarySectionKey(key: string): key is LibrarySectionKey {
  return LIBRARY_SECTIONS.some((s) => s.key === key);
}

/**
 * A library section presented as a `MasterPageDef`, so it goes straight through
 * `resolveSections` / `validateSections` and into the shared editor without a
 * parallel implementation — the same trick `developmentPageDef` uses.
 */
export function librarySectionPageDef(def: LibrarySectionDef): MasterPageDef {
  return {
    key: `section/${def.key}` as unknown as MasterPageKey,
    label: def.label,
    path: def.usedOn[0]?.href ?? "/",
    description: def.description,
    sections: [def.section],
  };
}

// ── reading ──────────────────────────────────────────────────────────────

type Item = Record<string, ItemValue>;

function text(item: Item, key: string): string {
  const v = item[key];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Section values → the shape the testimonial components already take.
 *
 * An empty list falls back to the seed rather than rendering nothing, matching
 * every other list field in this codebase: "the editor has never touched this"
 * and "the editor deliberately emptied this" are indistinguishable in storage,
 * and blanking a live section is the more expensive of the two readings.
 *
 * Ids are synthesised from position because a stored review has none — they are
 * React keys within one list, never a reference anything else holds.
 */
export function testimonialsFrom(
  values: SectionValues,
  limit?: number,
): Testimonial[] {
  const raw = Array.isArray(values.items) ? (values.items as Item[]) : [];
  const items = raw
    .filter((item) => item && typeof item === "object" && item.enabled !== false)
    .map((item, i) => ({
      id: `review-${i}`,
      quote: text(item, "quote"),
      attribution: text(item, "attribution"),
      context: text(item, "context") || undefined,
    }))
    // A card an editor added and then blanked out is not a review.
    .filter((t) => t.quote !== "");

  const out: Testimonial[] = items.length > 0 ? items : SEED_TESTIMONIALS;
  return typeof limit === "number" ? out.slice(0, limit) : out;
}

/** Exported for the guards that enumerate every registry's field lists. */
export function libraryFieldLists(): { origin: string; fields: FieldDef[] }[] {
  return LIBRARY_SECTIONS.map((s) => ({
    origin: `library:${s.key}`,
    fields: s.section.fields,
  }));
}
