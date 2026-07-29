import type { MasterPageDef, SectionDef } from "./types";

/**
 * Sub-pages: templated pages that exist once per database record, rather than
 * once per route. Development detail pages are the first kind.
 *
 * They reuse the master-page machinery wholesale — same section documents,
 * same resolve/validate, same `pages.blocks` storage — with one difference:
 * the section *order* is fixed by the template. The development page carries an
 * anchor sub-nav whose links point at section ids in document order, so
 * shuffling sections would silently break those links. Sections can still be
 * switched off, and their copy and images edited.
 */

export const SUBPAGE_SLUG_PREFIX = "subpage/";

export type SubPageKind = "development";

/**
 * Sub-page kinds, rendered as blocks on the Pages index the same way master
 * pages are. Adding a kind here (area guides, developer profiles) is what makes
 * it appear — the registry, storage and editor are already generic.
 */
export type SubPageKindDef = {
  kind: SubPageKind;
  label: string;
  /** Public route the pages of this kind live under. */
  publicPath: string;
  description: string;
  /** Admin index for this kind. */
  adminPath: string;
  /** Noun for counts — "project page". */
  itemLabel: string;
};

export const SUBPAGE_KINDS: SubPageKindDef[] = [
  {
    kind: "development",
    label: "Developments",
    publicPath: "/developments",
    adminPath: "/admin/pages/sub/development",
    description:
      "One project page per development, built from a shared template.",
    itemLabel: "project page",
  },
];

export function getSubPageKind(kind: string): SubPageKindDef | null {
  return SUBPAGE_KINDS.find((k) => k.kind === kind) ?? null;
}

export function subPageSlug(kind: SubPageKind, recordSlug: string): string {
  return `${SUBPAGE_SLUG_PREFIX}${kind}/${recordSlug}`;
}

export function isSubPageSlug(slug: string): boolean {
  return slug.startsWith(SUBPAGE_SLUG_PREFIX);
}

const optionalText = (key: string, label: string, help: string) => ({
  key,
  label,
  kind: "text" as const,
  max: 160,
  optional: true,
  help,
});

const optionalBody = (key: string, label: string, help: string) => ({
  key,
  label,
  kind: "textarea" as const,
  max: 900,
  optional: true,
  help,
});

/**
 * Copy fields on a sub-page are *overrides*, not defaults: left blank, the
 * section renders whatever the template builds from the record (usually the
 * development's own name, area and numbers). That keeps a hundred-odd project
 * pages from having to carry a hundred copies of the same boilerplate.
 */
function section(
  key: string,
  label: string,
  description: string,
  extra: Partial<SectionDef> = {},
): SectionDef {
  return {
    key,
    label,
    description,
    fields: [
      optionalText("heading", "Heading", "Blank keeps the built-in heading."),
      optionalBody("intro", "Intro", "Blank keeps the built-in copy."),
    ],
    defaults: { heading: null, intro: null },
    ...extra,
  };
}

export const DEVELOPMENT_SECTIONS: SectionDef[] = [
  section("hero", "Hero", "Cover image, name, and headline stats.", {
    locked: true,
    dataNote:
      "The cover image and stats come from the development record — edit them in Page images below.",
    fields: [
      optionalText("heading", "Headline", "Blank uses the project name."),
      optionalBody("intro", "Standfirst", "Blank uses the tagline."),
    ],
  }),
  section("subnav", "Sub-navigation", "Sticky anchor links down the page.", {
    locked: true,
    dataNote: "Links are generated from the sections that are switched on.",
    fields: [],
    defaults: {},
  }),
  section("overview", "Overview", "Project summary and key facts."),
  section("master-plan", "Master plan", "Site plan image and description."),
  section("payment-plan", "Payment plan", "Instalment schedule and calculator.", {
    dataNote: "The schedule comes from the development record.",
  }),
  section("units", "Units", "Availability table.", {
    dataNote: "Rows come from the development's units.",
  }),
  section("floor-plans", "Floor plans", "Layouts, gated behind a lead form.", {
    dataNote: "Plans come from the development's floor-plan records.",
  }),
  section("renders", "Renders", "Gallery of project imagery.", {
    dataNote:
      "Leave the gallery empty to show the images attached to the development record (roles render/gallery).",
    fields: [
      optionalText("heading", "Heading", "Blank keeps the built-in heading."),
      optionalBody("intro", "Intro", "Blank keeps the built-in copy."),
      {
        key: "images",
        label: "Gallery",
        kind: "list",
        itemLabel: "image",
        max: 12,
        help: "Adding one takes over the whole gallery, in this order.",
        fields: [
          { key: "enabled", label: "Show this image", kind: "toggle" },
          { key: "image", label: "Image", kind: "image" },
          {
            key: "caption",
            label: "Caption",
            kind: "text",
            max: 120,
            optional: true,
          },
        ],
      },
    ],
    defaults: { heading: null, intro: null, images: [] },
  }),
  section("features", "Features", "Amenity and finish highlights."),
  section("location", "Location", "Map and surroundings."),
  section("nearby", "Nearby developments", "Map of other projects in the area.", {
    dataNote: "Projects come from the same area's published developments.",
  }),
  section("market-context", "Market context", "Link out to area market data."),
  section("developer", "Developer", "Profile of the developer behind it."),
  section("other-projects", "Other projects", "Siblings by the same developer.", {
    dataNote: "Cards come from the developer's other published projects.",
  }),
  section("faq", "FAQs", "Questions, with FAQPage schema for search."),
  section("advisor", "Advisor banner", "Lead advisor contact prompt."),
];

/**
 * A sub-page presented as a `MasterPageDef` so it can go straight through
 * `resolveSections` / `validateSections` without a parallel implementation.
 */
export function developmentPageDef(record: {
  name: string;
  slug: string;
}): MasterPageDef {
  return {
    key: "development" as unknown as MasterPageDef["key"],
    label: record.name,
    path: `/developments/${record.slug}`,
    description: `Project page for ${record.name}.`,
    sections: DEVELOPMENT_SECTIONS,
  };
}
