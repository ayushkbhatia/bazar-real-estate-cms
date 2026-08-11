import type { FieldDef, MasterPageDef, SectionDef } from "./types";

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

export type SubPageKind = "development" | "area" | "developer";

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
    kind: "area",
    label: "Areas",
    publicPath: "/areas",
    adminPath: "/admin/pages/sub/area",
    description: "One community guide per area, built from a shared template.",
    itemLabel: "area page",
  },
  {
    kind: "development",
    label: "Developments",
    publicPath: "/developments",
    adminPath: "/admin/pages/sub/development",
    description:
      "One project page per development, built from a shared template.",
    itemLabel: "project page",
  },
  {
    kind: "developer",
    label: "Developers",
    publicPath: "/developers",
    adminPath: "/admin/pages/sub/developer",
    description:
      "One profile per developer partner — the catalogue every listing and project files under.",
    itemLabel: "developer",
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
 * A pick-and-order image list. Two of these make the renders split; keeping the
 * shape in one place is what stops the interior and exterior halves drifting
 * apart field by field.
 */
const gallery = (key: string, label: string, help: string): FieldDef => ({
  key,
  label,
  kind: "list" as const,
  itemLabel: "image",
  max: 12,
  help,
  fields: [
    { key: "enabled", label: "Show this image", kind: "toggle" },
    { key: "image", label: "Image", kind: "image" },
    { key: "caption", label: "Caption", kind: "text", max: 120, optional: true },
  ],
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

/**
 * A section whose eyebrow, heading and intro are all overridable — the shape
 * every block on a project page has. It sits alongside `section()` rather than
 * replacing it because the area template's page reads only heading and intro;
 * declaring an eyebrow there would put a third dead field in front of an
 * editor, which is the problem this whole run has been unpicking.
 *
 * `eyebrowDefault` is quoted back in the field's help text, so an editor can
 * see what they are replacing — including the ones the page assembles from the
 * record, written here with the moving part in angle brackets.
 */
function copySection(
  key: string,
  label: string,
  description: string,
  eyebrowDefault: string,
  opts: Partial<SectionDef> & { extraFields?: FieldDef[] } = {},
): SectionDef {
  const { extraFields = [], defaults = {}, ...rest } = opts;
  return section(key, label, description, {
    fields: [
      optionalText("eyebrow", "Eyebrow", `Blank keeps “${eyebrowDefault}”.`),
      optionalText("heading", "Heading", "Blank keeps the built-in heading."),
      optionalBody("intro", "Intro", "Blank keeps the built-in copy."),
      ...extraFields,
    ],
    defaults: { eyebrow: null, heading: null, intro: null, ...defaults },
    ...rest,
  });
}

export const DEVELOPMENT_SECTIONS: SectionDef[] = [
  section("hero", "Hero", "Banner image, name, headline stats and the brochure.", {
    locked: true,
    dataNote:
      "The headline stats come from the development record — edit them in Key facts above.",
    fields: [
      {
        key: "image",
        label: "Hero banner",
        kind: "image",
        // The cover image is composed for a card — roughly 4:3, subject in the
        // middle. The hero is a 640px-tall full-bleed band, so that same file
        // gets cropped to within an inch of its life. Leaving this empty keeps
        // the old behaviour rather than blanking the top of a live page.
        help: "The full-width band at the top of this project page. Landscape works best — 2400×960 or wider. Blank falls back to the cover image from Page images below.",
      },
      optionalText("heading", "Headline", "Blank uses the project name."),
      optionalBody("intro", "Standfirst", "Blank uses the tagline."),
      {
        key: "brochure",
        label: "Brochure PDF",
        kind: "file",
        help: "Opens in a new tab once someone completes the form. Leave empty and the button still captures the lead, telling them an advisor will send it.",
      },
      optionalText(
        "brochure_label",
        "Brochure button label",
        "Blank keeps “Download brochure”.",
      ),
      optionalText(
        "interest_label",
        "Interest button label",
        "Blank keeps “Register your interest”. Opens the enquiry form for this project.",
      ),
    ],
    defaults: {
      image: { media_id: null, alt: null, label: null },
      heading: null,
      intro: null,
      brochure: { media_id: null, alt: null, label: null },
      brochure_label: null,
      interest_label: null,
    },
  }),
  section("subnav", "Sub-navigation", "Sticky anchor links down the page.", {
    locked: true,
    dataNote: "Links are generated from the sections that are switched on.",
    fields: [],
    defaults: {},
  }),
  copySection(
    "overview",
    "Overview",
    "Project summary and key facts.",
    "Overview",
  ),
  copySection(
    "master-plan",
    "Master plan",
    "Site plan image and description.",
    "Master plan",
  ),
  copySection(
    "payment-plan",
    "Payment plan",
    "Instalment schedule and calculator.",
    "Payment plan · <plan name>",
    { dataNote: "The schedule comes from the development record." },
  ),
  copySection(
    "units",
    "Units",
    "Availability table.",
    "Available units · <n> of <total> remaining",
    { dataNote: "Rows come from the development's units." },
  ),
  copySection(
    "floor-plans",
    "Floor plans",
    "Layouts, gated behind a lead form.",
    "Floor plans",
    { dataNote: "Plans come from the development's floor-plan records." },
  ),
  copySection(
    "renders",
    "Renders",
    "Interior and exterior imagery, side by side in one section.",
    "The vision",
    {
      dataNote:
        "Leave the exterior gallery empty to show the images attached to the development record (roles render/gallery). A gallery with nothing in it drops its half of the split, and the other one spans the width.",
      extraFields: [
        optionalText(
          "interior_heading",
          "Interior column heading",
          "Blank keeps “Interior”.",
        ),
        gallery(
          "interior_images",
          "Interior renders",
          "Shown in the left half. Order here is order on the page.",
        ),
        optionalText(
          "exterior_heading",
          "Exterior column heading",
          "Blank keeps “Exterior”.",
        ),
        gallery(
          "exterior_images",
          "Exterior renders",
          "Shown in the right half. Adding one takes over from the development record's own media.",
        ),
      ],
      defaults: {
        interior_heading: null,
        interior_images: [],
        exterior_heading: null,
        exterior_images: [],
      },
    },
  ),
  copySection(
    "features",
    "Features",
    "Amenity and finish highlights.",
    "Within <project name>",
  ),
  copySection(
    "unit-plans",
    "Units & floor plans",
    "Unit-type buttons and the layouts under each.",
    "Units",
    {
      dataNote:
        "Types and layouts come from the project's unit types — edit them in “Units & floor plans” above. Up to four layouts show per type.",
    },
  ),
  copySection("location", "Location", "Map and surroundings.", "Location"),
  copySection(
    "nearby",
    "Future neighbours",
    "Other projects going up around this one.",
    "Future developments around · <area>",
    {
      dataNote:
        "Projects come from the neighbours picked in Page content — or, left empty, the same area's published developments.",
    },
  ),
  copySection(
    "developer",
    "Developer",
    "Profile of the developer behind it.",
    "Developer",
    {
      dataNote:
        "The card itself — name, founding year, profile copy — comes from the developer record.",
    },
  ),
  copySection(
    "other-projects",
    "Other projects",
    "Siblings by the same developer.",
    "Other projects by <developer>",
    { dataNote: "Cards come from the developer's other published projects." },
  ),
  copySection(
    "faq",
    "FAQs",
    "Questions, with FAQPage schema for search.",
    "FAQ",
  ),
  copySection(
    "advisor",
    "Advisor banner",
    "Lead advisor contact prompt.",
    "Lead advisor",
    {
      dataNote:
        "The banner — advisor, photo, pull quote — comes from the advisor's team record.",
    },
  ),
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

// ────────────────────────────────────────────────────────────────────────
// Areas — community guide pages under /areas/<slug>
// ────────────────────────────────────────────────────────────────────────
export const AREA_SECTIONS: SectionDef[] = [
  {
    key: "hero",
    label: "Hero",
    description: "Eyebrow, area name and the opening paragraph.",
    locked: true,
    dataNote:
      "Blank fields use the guide copy that ships with the area. The cover image is set in Page images below.",
    fields: [
      optionalText("eyebrow", "Eyebrow", "Blank keeps “Community guide · …”."),
      optionalText("heading", "Heading", "Blank uses the area name."),
      optionalBody("intro", "Intro", "Blank keeps the built-in copy."),
      optionalText("position", "Position line", "The small mono line below."),
    ],
    defaults: { eyebrow: null, heading: null, intro: null, position: null },
  },
  section("hero-image", "Cover image", "Wide image under the intro.", {
    dataNote: "Set the image in Page images below.",
    fields: [],
    defaults: {},
  }),
  section("map", "Map", "Interactive map focused on this area.", {
    dataNote: "Pins come from the area's coordinates and live listings.",
  }),
  section("stats", "Stats", "Median prices, yield and days on market."),
  section("schools", "Schools & amenities", "Nearby schools and facilities."),
  section("reports", "Market reports", "Rail linking to the area's reports.", {
    dataNote: "Reports come from the market-report records.",
  }),
  section("valuation", "Valuation prompt", "Lead capture for owners."),
  section("lifestyle", "Lifestyle dossier", "Commute chips, prose, dining."),
  section("listings", "Listings", "Properties for sale in this area.", {
    dataNote: "Cards come from published listings.",
  }),
  section("advisors", "Advisors", "Advisors who cover this area.", {
    dataNote: "Advisors come from the team records.",
  }),
  section("similar", "Similar areas", "Links to comparable communities."),
];

export function areaPageDef(record: {
  name: string;
  slug: string;
}): MasterPageDef {
  return {
    key: "area" as unknown as MasterPageDef["key"],
    label: record.name,
    path: `/areas/${record.slug}`,
    description: `Community guide for ${record.name}.`,
    sections: AREA_SECTIONS,
  };
}
