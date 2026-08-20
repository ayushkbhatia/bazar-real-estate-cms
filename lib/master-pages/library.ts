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
export type LibrarySectionKey = "testimonials";

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
  /** The one editable section this library entry owns. */
  section: SectionDef;
};

/**
 * The reviews list.
 *
 * `max` is 12 rather than 3: the components take a `limit` and slice, so an
 * editor can keep a bench of approved quotes and rotate which three lead
 * without retyping the ones they are resting.
 */
function reviewList(): ListFieldDef {
  return {
    key: "items",
    label: "Reviews",
    kind: "list",
    itemLabel: "review",
    max: 12,
    help: "The home page shows the first three that are switched on. Drag is not available here — order is the order you add them in, and switching one off keeps it for later without showing it.",
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
  usedOn: [
    { label: "Home", href: "/" },
    { label: "Any landing page with the Testimonials block", href: "/admin/page-builder" },
  ],
  section: TESTIMONIALS_SECTION,
};

export const LIBRARY_SECTIONS: LibrarySectionDef[] = [TESTIMONIALS];

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
