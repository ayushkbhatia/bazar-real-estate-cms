/**
 * The developer profile page's own words — the crumb, the two section
 * headings, the two buttons, the empty state and the count line rendered by
 * `/developers/<slug>` for every developer in the catalogue.
 *
 * ## Why a registry rather than literals in the page
 *
 * These strings were English literals inside
 * `app/[locale]/(public)/developers/[slug]/page.tsx`, which made them the last
 * prose on that route the client could not change and — the reason this exists
 * now — the last prose on it that could not be Arabic. `/ar/developers/aldar`
 * rendered an Arabic eyebrow directly above `ALDAR Properties's projects.`,
 * which reads as a broken page rather than an untranslated one.
 *
 * ## Why ONE document rather than one per developer
 *
 * The other sub-page kinds exist once per record because their copy is about
 * that record: a project's overview is not another project's overview. These
 * seven strings are the opposite — they are the *template*, identical on all
 * 32 profiles, and the only per-developer part is the name, which arrives as a
 * token rather than as typing. One document keeps "rename the projects
 * heading" a single edit instead of 32, and it is why the entry sits beside
 * the developer list at `/admin/pages/sub/developer/copy` rather than inside
 * each developer's record.
 *
 * It is the same shape as `lib/master-pages/library.ts` — content owned by the
 * site rather than by one page — with the search-header registry's storage:
 * `pages.blocks` under `subpage/developer/copy`, via `subPageSlug`.
 *
 * ## The `{name}` token
 *
 * Three fields interpolate the developer's name and one interpolates the two
 * halves of the count. They are substituted at render time by `fillTokens`
 * below rather than by string concatenation in the page, because the token's
 * POSITION differs between the two languages: English puts the possessive
 * after the name and Arabic puts the noun before it. Concatenating
 * `${name} + "'s projects."` — which is what the page did — cannot express
 * that, so an Arabic heading built that way comes out backwards even when the
 * words are right.
 *
 * A token an editor deletes is simply not substituted; the sentence renders
 * without it rather than erroring, which is the behaviour a text input has to
 * have when the person typing into it cannot be assumed to know the syntax.
 *
 * ## The Arabic
 *
 * Hand-declared in `defaults` beside each English sibling, for the reason
 * `search-headers.ts` sets out at length: these are seven short UI strings
 * with a settled house rendering, and splitting them between `defaults` and
 * `lib/master-pages/arabic/master.json` would make "where does this string's
 * Arabic live" a question with two answers. `مطور عقاري` and `على الخارطة`
 * are the glossary's bindings (`lib/i18n/mt/glossary.ts`), not free choices.
 *
 * An editor's Arabic wins structurally — `mergeValues` never overwrites a twin
 * that already holds a value — which is ADR-0008's whole position: what ships
 * is a first draft the client proofreads at
 * `/admin/pages/sub/developer/copy`.
 */

import { area, link, text } from "./fields";
import type { FieldDef, MasterPageDef, MasterPageKey, SectionDef } from "./types";

/** Storage key for the one section in the document. Renaming it orphans it. */
export const DEVELOPER_PAGE_SECTION_KEY = "profile";

/** The document's key under `subpage/developer/…`. */
export const DEVELOPER_PAGE_COPY_KEY = "copy";

/** Where an editor goes, and what the index card links to. */
export const DEVELOPER_PAGE_ADMIN_PATH = "/admin/pages/sub/developer/copy";

/**
 * The token an editor may place anywhere in the three name-bearing fields.
 *
 * Exported because the editor help text, the tests and the renderer must all
 * agree about the exact spelling — a token documented as `{name}` and matched
 * as `{{name}}` is a silent no-op that only shows up on the public page.
 */
export const NAME_TOKEN = "{name}";

/**
 * Substitute `{token}` placeholders.
 *
 * Deliberately not a template engine: an unknown token is left alone rather
 * than blanked, so a typo shows up as itself on the page — visible, and
 * therefore fixable — instead of silently deleting the word around it.
 */
export function fillTokens(
  value: string,
  tokens: Record<string, string | number>,
): string {
  let out = value;
  for (const [key, replacement] of Object.entries(tokens)) {
    out = out.split(`{${key}}`).join(String(replacement));
  }
  return out;
}

const NAME_HELP = `Use ${NAME_TOKEN} where the developer's name should appear.`;

function copyFields(): FieldDef[] {
  return [
    text("back_label", "Back-link label", {
      max: 60,
      optional: true,
      help: "The crumb above the logo, linking to /developers. Blank drops the link.",
    }),
    text("projects_heading", "Projects heading", {
      max: 120,
      help: `The heading above this developer's projects. ${NAME_HELP}`,
    }),
    text("projects_cta_label", "Projects button", {
      max: 60,
      optional: true,
      help: "The button beside that heading. Blank drops the button.",
    }),
    link("projects_cta_href", "Projects button link"),
    area("projects_empty", "No-projects message", {
      max: 300,
      optional: false,
      help: `Shown when a developer has no published projects yet. ${NAME_HELP}`,
    }),
    text("projects_empty_cta_label", "No-projects button", {
      max: 80,
      optional: true,
      help: "The button under that message. Blank drops the button.",
    }),
    link("projects_empty_cta_href", "No-projects button link"),
    text("listings_heading", "Listings heading", {
      max: 120,
      help: "The heading above the listings filed under this developer.",
    }),
    text("listings_count", "Listings count line", {
      max: 80,
      optional: true,
      /*
       * Two tokens rather than one sentence per number: Arabic and English
       * disagree about where the numerals sit relative to the words, and the
       * count is not a plural — it is always "n of m", so no ICU category
       * applies. Blank drops the line.
       */
      help: "Shown when there are more listings than fit. Use {shown} and {total}.",
    }),
  ];
}

/**
 * The one section. `locked` because the page is structurally built around it —
 * there is no version of the developer profile with no headings — and hiding
 * it would leave the two grids unlabelled rather than switched off.
 */
export const DEVELOPER_PAGE_SECTION: SectionDef = {
  key: DEVELOPER_PAGE_SECTION_KEY,
  label: "Developer profile pages",
  description:
    "The headings, buttons and messages shared by every /developers/<slug> page.",
  locked: true,
  dataNote:
    "Only the page's own words. The developer's name, description and logo come from its record, and the project and listing cards come from the catalogue.",
  fields: copyFields(),
  /*
   * Defaults are what these pages have published since they shipped, lifted
   * verbatim from the JSX. An un-edited document therefore renders
   * byte-identically to before this file existed — on /en. On /ar it is the
   * first time any of them render in Arabic at all.
   */
  defaults: {
    back_label: "All developers",
    back_label_ar: "كل المطورين",
    // English puts the possessive after the name; Arabic puts the noun first.
    // This is the pair the token exists for.
    projects_heading: `${NAME_TOKEN}'s projects.`,
    projects_heading_ar: `مشاريع ${NAME_TOKEN}.`,
    projects_cta_label: "Browse all off-plan",
    projects_cta_label_ar: "تصفح كل المشاريع على الخارطة",
    projects_cta_href: "/off-plan",
    projects_empty: `No developments published for ${NAME_TOKEN} yet.`,
    projects_empty_ar: `لا توجد مشاريع منشورة لـ ${NAME_TOKEN} حتى الآن.`,
    projects_empty_cta_label: "Explore the wider off-plan market",
    projects_empty_cta_label_ar: "استكشف سوق المشاريع على الخارطة",
    projects_empty_cta_href: "/off-plan",
    listings_heading: "Properties from this developer.",
    // "مطور عقاري" is the glossary binding — a bare "مطور" is a software one.
    listings_heading_ar: "عقارات من هذا المطور العقاري.",
    listings_count: "Showing {shown} of {total}",
    listings_count_ar: "عرض {shown} من {total}",
  },
};

/**
 * The document presented as a `MasterPageDef`, so it goes straight through
 * `resolveSections` / `validateSections` and into the shared editor without a
 * parallel implementation — the same trick `searchHeaderPageDef` uses.
 */
export function developerPageCopyDef(): MasterPageDef {
  return {
    key: `developer/${DEVELOPER_PAGE_COPY_KEY}` as unknown as MasterPageKey,
    label: "Developer profile pages",
    path: "/developers",
    description:
      "The wording every developer profile shares — the crumb, both headings, both buttons and the empty state.",
    sections: [DEVELOPER_PAGE_SECTION],
  };
}

/** Exported for the guards that enumerate every registry's field lists. */
export function developerPageFieldLists(): {
  origin: string;
  fields: FieldDef[];
}[] {
  return [
    {
      origin: `developer-page:${DEVELOPER_PAGE_COPY_KEY}`,
      fields: DEVELOPER_PAGE_SECTION.fields,
    },
  ];
}
