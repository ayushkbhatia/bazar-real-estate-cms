/**
 * The header's call-to-action button — the "List Your Property" pill in the
 * top bar, the short "List" button beside the hamburger on a phone, and the
 * full-width button pinned to the bottom of the mobile drawer.
 *
 * ## Why a registry rather than a message key
 *
 * Two of those three renderings were English literals inside
 * `components/brand/public-mega-nav.tsx` and
 * `public-mega-nav-mobile.tsx` — so `/ar` on a phone showed an Arabic menu
 * with `List` sitting in the header and `List Your Property` pinned across the
 * bottom of the drawer. The desktop pill did read `nav.listProperty`, which is
 * why the bug only ever showed up below `xl`.
 *
 * Moving all three onto one message key would have fixed the Arabic and left
 * the other half of the problem in place: this is the single most prominent
 * conversion control on the site, and its wording, its short form and its
 * destination were all things the client had to open a pull request to change.
 * A registry fixes both at once — the strings become Arabic AND editable, and
 * `link` fields are never translatable, so the destination stays one value for
 * both languages.
 *
 * ## Why its own document rather than a master-page section
 *
 * The nav is chrome: it renders above every route, so it belongs to no page.
 * It is not a megamenu tab either — it is not a tab, has no panel, and lives
 * outside the `megamenu_*` tables that model tabs, columns, items and tiles.
 * Adding three columns to `megamenu_settings` would have meant a migration, a
 * `grant select` and a public-read audit for what is one row of copy.
 *
 * So: the same shape as `lib/master-pages/developer-page.ts` — one document,
 * one section, site-owned content — with the same storage. `pages.blocks`
 * under `subpage/nav/cta`, which the `subpage/` prefix keeps out of
 * `/pages/[slug]` and out of the Pages list. No migration.
 *
 * ## The Arabic
 *
 * Hand-declared in `defaults` beside each English sibling, for the reason
 * `search-headers.ts` sets out: `أدرج عقارك` is the curated string lifted
 * verbatim from `nav.listProperty` in `messages/ar/nav.json`, and `أدرج` is
 * the reviewed short form already carried in
 * `lib/master-pages/arabic/master.json` under "List Your". Storing one here
 * and one there would make "where does this string's Arabic live" a question
 * with two answers.
 *
 * An editor's Arabic wins structurally — `mergeValues` never overwrites a twin
 * that already holds a value — which is ADR-0008's position: what ships is a
 * first draft the client proofreads, here at `/admin/megamenu/header-cta`.
 */

import { link, text } from "./fields";
import { SUBPAGE_SLUG_PREFIX } from "./subpages";
import type { FieldDef, MasterPageDef, MasterPageKey, SectionDef } from "./types";

/** Storage key for the one section in the document. Renaming it orphans it. */
export const HEADER_CTA_SECTION_KEY = "cta";

/**
 * The `pages.slug` this document lives at.
 *
 * Built from the prefix rather than from `subPageSlug()` on purpose: the
 * header button is not a sub-page, and widening `SubPageKind` to say it was
 * would put a card for it on the Pages and Sub-pages indexes, where an editor
 * looking for "the pages of this site" would have to read past it. The prefix
 * is what actually matters — it is the thing `lib/queries/pages.ts` filters on
 * to keep this row out of `/pages/[slug]`.
 */
export const HEADER_CTA_PAGE_SLUG = `${SUBPAGE_SLUG_PREFIX}nav/${HEADER_CTA_SECTION_KEY}`;

/** Where an editor goes. Linked from the megamenu index. */
export const HEADER_CTA_ADMIN_PATH = "/admin/megamenu/header-cta";

/** What the button renders when the document is missing or a field is blank. */
export const HEADER_CTA_FALLBACK_HREF = "/services/sell";

function ctaFields(): FieldDef[] {
  return [
    text("label", "Button label", {
      max: 40,
      help: "The pill in the top bar on a desktop, and the button across the bottom of the menu drawer on a phone.",
    }),
    text("short_label", "Short label", {
      // 16, not 40: this one sits beside the hamburger in a 72px bar and has
      // roughly four characters of room before it starts pushing the wordmark.
      // The cap is the only warning an editor gets, because the admin cannot
      // show them a 390px viewport.
      max: 16,
      help: "The compact version shown beside the menu button on a phone, where the full label will not fit. Keep it to a word or two.",
    }),
    link("href", "Button link", {
      optional: false,
      help: "Where the button goes. Internal path (/services/sell) or full URL.",
    }),
  ];
}

/**
 * The one section. `locked` because the header is structurally built around
 * the button — there is no version of the bar that renders without it, and
 * switching it off would leave a gap rather than a tidier nav.
 */
export const HEADER_CTA_SECTION: SectionDef = {
  key: HEADER_CTA_SECTION_KEY,
  label: "Header button",
  description:
    "The call-to-action button in the site header and at the foot of the mobile menu.",
  locked: true,
  dataNote:
    "Only the button. The tabs beside it, and the panels they open, are edited per tab on the Megamenu screen.",
  fields: ctaFields(),
  /*
   * Defaults are what the header has published since it shipped, lifted
   * verbatim from the JSX and from `nav.listProperty`. An un-edited document
   * therefore renders byte-identically to before this file existed — on /en.
   * On /ar it is the first time the two mobile renderings are Arabic at all.
   */
  defaults: {
    label: "List Your Property",
    label_ar: "أدرج عقارك",
    short_label: "List",
    short_label_ar: "أدرج",
    href: HEADER_CTA_FALLBACK_HREF,
  },
};

/**
 * The document presented as a `MasterPageDef`, so it goes straight through
 * `resolveSections` / `validateSections` and into the shared editor without a
 * parallel implementation — the same trick `developerPageCopyDef` uses.
 */
export function headerCtaDef(): MasterPageDef {
  return {
    key: `nav/${HEADER_CTA_SECTION_KEY}` as unknown as MasterPageKey,
    label: "Header button",
    path: "/",
    description:
      "The call-to-action button in the site header, in both of its sizes.",
    sections: [HEADER_CTA_SECTION],
  };
}

/** Exported for the guards that enumerate every registry's field lists. */
export function headerCtaFieldLists(): {
  origin: string;
  fields: FieldDef[];
}[] {
  return [
    {
      origin: `header-cta:${HEADER_CTA_SECTION_KEY}`,
      fields: HEADER_CTA_SECTION.fields,
    },
  ];
}
