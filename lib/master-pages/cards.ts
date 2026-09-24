/**
 * Cards — the card-shaped blocks that repeat across many pages, each edited
 * once at `/admin/pages/cards/<key>`.
 *
 * ## Why this exists when the words were already editable
 *
 * The advisor card at the foot of every `/developments/<slug>` page — "Need
 * Assistance?", the pull quote, the two buttons — became editable in #529, as
 * the last of fifteen sections on Pages → Sub-pages → Developments → Page copy.
 * Two days later the client asked for "backend editability" for that quote,
 * believing there was none. The feature existed; nobody could find it. A card
 * is a thing an editor looks at and recognises, not a band of a document, and
 * this is the place that is organised that way.
 *
 * ## A card is a LENS, not a second copy
 *
 * Each entry points at a section of a document that already exists and is
 * already read by the public page. Nothing here declares a field, and nothing
 * is stored under a new slug:
 *
 *   project-advisor  → `subpage/development-copy/copy`, section `advisor`
 *   listing-advisor  → `subpage/property/copy`,         section `advisor`
 *   listing-enquiry  → `subpage/property/copy`,         section `enquiry`
 *
 * So there is one source of truth per string, and the older screens keep
 * working: saving a card writes that one section back into its document and
 * leaves every other section as stored (`spliceCardSection`), and saving the
 * whole document from its own screen writes the card's section with it. Two
 * doors, one room.
 *
 * The alternative — moving the fields out into a `cards` document — would have
 * needed a read-through fallback for anything already typed, a second answer to
 * "where does this string live", and a data migration, all for a change of
 * menu. Not worth it for words the resolution chain already knows how to read.
 *
 * ## What a card adds over the document's own screen
 *
 *  - **A preview of the real component**, fed the editor's unsaved values and a
 *    real project's name and advisor, in either language. What the quote looks
 *    like beside a photograph is the question an editor is actually asking.
 *  - **The overrides that beat it.** A project may carry its own wording for
 *    any of these fields, and that wording wins. All 22 projects set up before
 *    the shared document existed carry "Need Assistance?" typed by hand — the
 *    same words as the card, so nothing looks wrong, and an edit to the card's
 *    eyebrow would change none of them. The card says so, names them, and can
 *    hand back the ones that match word for word (`releaseCardOverrides`).
 */
import { isolateForLocale, stripIsolates } from "@/lib/i18n/bidi";
import type { Locale } from "@/lib/i18n/locales";
import { resolveSections, str } from "./index";
import { applyLocale } from "./i18n";
import {
  DEVELOPMENT_PAGE_ADMIN_PATH,
  DEVELOPMENT_TOKENS,
  developmentPageCopyDef,
  fillTokens,
} from "./development-page";
import {
  PROPERTY_PAGE_ADMIN_PATH,
  PROPERTY_TOKENS,
  propertyPageCopyDef,
} from "./property-page";
import { arKey } from "./twins";
import type {
  FieldDef,
  MasterPageDef,
  SectionDef,
  SectionValues,
  StoredSection,
} from "./types";

export const CARDS_ADMIN_PATH = "/admin/pages/cards";

/** The documents a card can be a lens onto. */
export type CardSourceKey = "development-copy" | "property-copy";

export type CardSource = {
  key: CardSourceKey;
  /** What the document's own screen is called, for the "also edited at" line. */
  label: string;
  adminPath: string;
  def: () => MasterPageDef;
};

export const CARD_SOURCES: Record<CardSourceKey, CardSource> = {
  "development-copy": {
    key: "development-copy",
    label: "Project pages · shared copy",
    adminPath: DEVELOPMENT_PAGE_ADMIN_PATH,
    def: developmentPageCopyDef,
  },
  "property-copy": {
    key: "property-copy",
    label: "Property pages · shared copy",
    adminPath: PROPERTY_PAGE_ADMIN_PATH,
    def: propertyPageCopyDef,
  },
};

export type CardKey = "project-advisor" | "listing-advisor" | "listing-enquiry";

export type CardDef = {
  key: CardKey;
  label: string;
  /** One line: what the card is and where a visitor meets it. */
  description: string;
  source: CardSourceKey;
  /** The section of the source document this card edits. */
  sectionKey: string;
  /** Public surfaces the card renders on — the blast radius of a save. */
  usedOn: { label: string; href: string }[];
  /** Every token the card's fields may carry, spelled exactly. */
  tokens: readonly string[];
  /**
   * Whether the editor draws the real component beside the fields. Only
   * where the component can be rendered with nothing but props — the listing
   * cards embed the enquiry form and its dialog, which need a live form
   * definition and a submission endpoint, and a mock of them would be a second
   * implementation free to drift from the first.
   */
  preview: "project-advisor" | null;
  /**
   * The kind of record whose own document can override this card's wording,
   * or null when nothing can. Listing pages have no per-record document — a
   * listing's own words live on its `properties` row — so only projects do.
   */
  overriddenBy: "development" | null;
  /** What on the card is NOT wording, and where that is edited instead. */
  recordNote: string;
  recordLink: { label: string; href: string };
};

export const CARDS: CardDef[] = [
  {
    key: "project-advisor",
    label: "Project advisor card",
    description:
      "The dark card at the foot of every project page — eyebrow, pull quote and the Call and Book-site-visit buttons — with the heading above it.",
    source: "development-copy",
    sectionKey: "advisor",
    usedOn: [
      { label: "every /developments/<slug> page", href: "/developments" },
    ],
    tokens: Object.values(DEVELOPMENT_TOKENS),
    preview: "project-advisor",
    overriddenBy: "development",
    recordNote:
      "The advisor's name, title and photograph come from the team record assigned to each project, and the buttons dial that record's numbers.",
    recordLink: { label: "Agents & team", href: "/admin/agents" },
  },
  {
    key: "listing-advisor",
    label: "Listing advisor card",
    description:
      "The advisor card at the top of the sidebar on every listing — its eyebrow and the enquiry button.",
    source: "property-copy",
    sectionKey: "advisor",
    usedOn: [{ label: "every /p/<slug> listing", href: "/buy/search" }],
    tokens: Object.values(PROPERTY_TOKENS),
    preview: null,
    overriddenBy: null,
    recordNote:
      "The name, photo, title, licence number, languages and contact details come from the advisor's profile.",
    recordLink: { label: "Agents & team", href: "/admin/agents" },
  },
  {
    key: "listing-enquiry",
    label: "Listing enquiry card",
    description:
      "The card around the enquiry form in a listing's sidebar, and the dialog “Send to advisor” opens.",
    source: "property-copy",
    sectionKey: "enquiry",
    usedOn: [{ label: "every /p/<slug> listing", href: "/buy/search" }],
    tokens: Object.values(PROPERTY_TOKENS),
    preview: null,
    overriddenBy: null,
    recordNote:
      "The form's own fields, button and confirmation are edited with the form.",
    recordLink: {
      label: "Forms → Enquire about this property",
      href: "/admin/forms/property_enquiry",
    },
  },
];

export function isCardKey(key: string): key is CardKey {
  return CARDS.some((c) => c.key === key);
}

export function getCard(key: string): CardDef | null {
  return CARDS.find((c) => c.key === key) ?? null;
}

export function cardAdminPath(card: Pick<CardDef, "key">): string {
  return `${CARDS_ADMIN_PATH}/${card.key}`;
}

/**
 * The section this card edits, as its source document declares it.
 *
 * Throws rather than returning null: a card pointing at a section its
 * document no longer has is a registry bug, and `cards.test.ts` fails on it
 * before anything renders.
 */
export function cardSection(card: CardDef): SectionDef {
  const section = CARD_SOURCES[card.source]
    .def()
    .sections.find((s) => s.key === card.sectionKey);
  if (!section) {
    throw new Error(
      `Card "${card.key}" points at section "${card.sectionKey}", which ${card.source} does not declare.`,
    );
  }
  return section;
}

/**
 * The source document narrowed to the card's one section.
 *
 * What validation and resolution run against. Narrowed rather than the whole
 * document because `validateSections` appends every section the client did
 * not send as an EMPTY one — handed the full definition and just this card, it
 * would return a document with every other band blanked, and writing that
 * would wipe them.
 */
export function cardPageDef(card: CardDef): MasterPageDef {
  const def = CARD_SOURCES[card.source].def();
  return { ...def, sections: [cardSection(card)] };
}

/**
 * Put one validated section back into its stored document.
 *
 * Every other section is kept exactly as stored — position, switch and values.
 * When nothing is stored yet, the other sections are written EMPTY, which
 * `mergeValues` reads as "use the code defaults" — the same thing an unsaved
 * document means, rather than a snapshot of today's defaults that would stop
 * tomorrow's from reaching it.
 */
export function spliceCardSection(
  sourceDef: MasterPageDef,
  stored: StoredSection[] | null,
  section: StoredSection,
): StoredSection[] {
  const base: StoredSection[] =
    stored && stored.length > 0
      ? stored
      : sourceDef.sections.map((s) => ({
          key: s.key,
          enabled: s.locked ? true : (s.defaultEnabled ?? true),
          values: {},
        }));
  const at = base.findIndex((s) => s.key === section.key);
  if (at === -1) return [...base, section];
  return base.map((s, i) => (i === at ? section : s));
}

/** The plain-text fields a card owns — every one is a string with a twin. */
export function cardTextFields(card: CardDef): FieldDef[] {
  return cardSection(card).fields.filter(
    (f) => f.kind === "text" || f.kind === "textarea",
  );
}

// ── Overrides ──────────────────────────────────────────────────────────────

/** One field a record carries its own wording for. */
export type CardOverride = {
  field: string;
  label: string;
  en: string | null;
  ar: string | null;
  /**
   * Both halves either blank or word-for-word the card's own, so handing the
   * field back changes nothing a visitor reads in English — and on `/ar` swaps
   * an English fallback for the card's Arabic at most.
   */
  matchesCard: boolean;
  /**
   * English typed, Arabic not: `/ar` renders this project's ENGLISH, because
   * `applyLocale` falls back to the override's own English before anything
   * gets a chance to fall through to the card.
   */
  arabicMissing: boolean;
};

function blank(v: unknown): boolean {
  return typeof v !== "string" || v.trim() === "";
}

/**
 * How two strings compare for "is this the same wording". Whitespace runs and
 * bidi isolates do not count — neither is visible, and a hand-typed override
 * never carries the isolates a token substitution adds.
 */
export function sameWording(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const norm = (s: string) => stripIsolates(s).replace(/\s+/g, " ").trim();
  return norm(a) === norm(b);
}

/**
 * The fields a record's own section overrides, compared against the card.
 *
 * @param card    the card's resolved values, bilingual — what renders for a
 *                project that overrides nothing.
 * @param record  the record's resolved section values, bilingual.
 */
export function findCardOverrides(
  fields: FieldDef[],
  card: SectionValues,
  record: SectionValues,
): CardOverride[] {
  const out: CardOverride[] = [];
  for (const f of fields) {
    const en = record[f.key];
    const ar = record[arKey(f.key)];
    if (blank(en) && blank(ar)) continue;
    const enOk = blank(en) || sameWording(en, card[f.key]);
    const arOk = blank(ar) || sameWording(ar, card[arKey(f.key)]);
    out.push({
      field: f.key,
      label: f.label,
      en: blank(en) ? null : (en as string),
      ar: blank(ar) ? null : (ar as string),
      matchesCard: enOk && arOk,
      arabicMissing: !blank(en) && blank(ar),
    });
  }
  return out;
}

/**
 * Clear the named fields, both languages, from a record's section values.
 * Everything else in the bag is returned untouched.
 */
export function releaseCardOverrides(
  values: SectionValues,
  fields: string[],
): SectionValues {
  const out: SectionValues = { ...values };
  for (const f of fields) {
    out[f] = null;
    out[arKey(f)] = null;
  }
  return out;
}

// ── Preview ────────────────────────────────────────────────────────────────

/** Where a previewed string came from. */
export type CardTextSource = "project" | "card";

export type CardText = { text: string | null; source: CardTextSource | null };

/**
 * The words one project's card would render, given the editor's UNSAVED
 * values — the same three steps the project page takes, in the same order:
 *
 *   1. the project's own override, drawn as typed (the page does not fill
 *      tokens in an override, so neither does this);
 *   2. the card, resolved exactly as `getDevelopmentPageCopyContent` resolves
 *      it — blanks normalised to null, `mergeValues` over the defaults, then
 *      folded to the language;
 *   3. the shipped wording, which step 2 already folds in.
 *
 * Resolved through `resolveSections` rather than re-implemented, so the
 * preview inherits every rule the live read has — including the one an
 * editor is most likely to be surprised by: an Arabic box cleared to nothing
 * falls back to the SHIPPED Arabic, not to the new English.
 *
 * @param projectValues the project's own section, bilingual; null previews the
 *   card as a project with no overrides would render it.
 */
export function previewCardText(
  card: CardDef,
  cardValues: SectionValues,
  projectValues: SectionValues | null,
  locale: Locale,
  tokens: Record<string, string>,
): (field: string) => CardText {
  const normalised: SectionValues = {};
  for (const [k, v] of Object.entries(cardValues)) {
    normalised[k] = typeof v === "string" && v.trim() === "" ? null : v;
  }
  const [resolved] = resolveSections(
    cardPageDef(card),
    [{ key: card.sectionKey, enabled: true, values: normalised }],
    locale,
  );
  const own = projectValues ? applyLocale(projectValues, locale).values : {};
  // The advisor tokens are isolated on the live page for the reason
  // `getDevelopmentPageCopy` gives — a Latin name inside an Arabic sentence.
  const filled: Record<string, string> = { ...tokens };
  for (const k of ["advisor", "advisor_first"]) {
    if (k in filled) filled[k] = isolateForLocale(filled[k], locale);
  }

  return (field) => {
    const override = str(own, field);
    if (override !== null) return { text: override, source: "project" };
    const value = str(resolved.values, field);
    return value === null
      ? { text: null, source: null }
      : { text: fillTokens(value, filled), source: "card" };
  };
}
