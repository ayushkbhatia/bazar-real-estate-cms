import type {
  FieldDef,
  MasterPageDef,
  SectionDef,
  SimpleFieldDef,
  ToggleFieldDef,
} from "./types";

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

export type SubPageKind =
  | "development"
  | "area"
  | "developer"
  | "section"
  | "search";

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
  /**
   * What the index card prints in place of `<publicPath>/…`.
   *
   * Every record-backed kind owns a route prefix, so the path *is* the useful
   * label. A library section owns none — it renders inside other people's
   * pages — and printing "//…" for it would be worse than saying so.
   */
  pathLabel?: string;
};

export const SUBPAGE_KINDS: SubPageKindDef[] = [
  {
    kind: "section",
    label: "Sections",
    // Not a route. `pathLabel` is what actually renders; this is only here
    // because the shape is shared and a null path would spread through both
    // index pages for one entry's benefit.
    publicPath: "/",
    pathLabel: "Reused across pages",
    adminPath: "/admin/pages/sub/section",
    description:
      "Content that belongs to the site rather than to one page — edited once, rendered everywhere it is placed.",
    itemLabel: "section",
  },
  {
    kind: "search",
    label: "Search results",
    // Six routes and seven facets, so no single prefix describes it — the
    // `pathLabel` names the shape instead, the way the library entry does.
    publicPath: "/",
    pathLabel: "The six search routes",
    adminPath: "/admin/pages/sub/search",
    description:
      "The eyebrow, headline and sub-title above the filter bar on each search page, and the snippet it publishes to a search engine.",
    itemLabel: "search page",
  },
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
    "Nearby Developments",
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

/**
 * Shorthands for the area template's list fields. They are declared here
 * rather than in `./fields` because the area guide wants its own lengths —
 * a market-statistic caption ("Off-Plan Apartment Sale Index — Jun 2026")
 * runs past what the marketing pages' `statList` allows.
 */
const optionalLink = (
  key: string,
  label: string,
  help?: string,
): SimpleFieldDef => ({
  key,
  label,
  kind: "link",
  max: 240,
  optional: true,
  help: help ?? "Internal path (/buy/search?area=…) or full URL.",
});

const showToggle = (label: string): ToggleFieldDef => ({
  key: "enabled",
  label,
  kind: "toggle",
});

const footnote = (help: string): SimpleFieldDef => ({
  key: "footnote",
  label: "Footnote",
  kind: "textarea",
  max: 400,
  optional: true,
  help,
});

/**
 * A section whose heading and intro are overridable, plus whatever else it
 * declares. Every band on the guide has this floor.
 */
function areaSection(
  key: string,
  label: string,
  description: string,
  extra: Partial<SectionDef> & { extraFields?: FieldDef[] } = {},
): SectionDef {
  const { extraFields = [], defaults = {}, fields, ...rest } = extra;
  return {
    key,
    label,
    description,
    fields: fields ?? [
      optionalText("heading", "Heading", "Blank keeps the built-in heading."),
      optionalBody("intro", "Intro", "Blank keeps the built-in copy."),
      ...extraFields,
    ],
    defaults: { heading: null, intro: null, ...defaults },
    ...rest,
  };
}

/**
 * The thirteen bands of a Bazar area guide, in the order they render.
 *
 * Copy is an **override**, never a default: a field left blank falls back to
 * what the page builds from the area record and its guide seed, so a newly
 * created area gets a working page before anyone writes a word. Per-area copy
 * lives in the section document (`pages.blocks` under `subpage/area/<slug>`),
 * which is what the CMS editor reads and writes — that is why the defaults
 * below are all null.
 *
 * The six sections after `final-cta` predate this structure. They still render
 * and are still editable, but ship switched off so a new area follows the
 * thirteen-band template unless someone opts back in.
 */
export const AREA_SECTIONS: SectionDef[] = [
  // 1 ── Hero
  {
    key: "hero",
    label: "Hero",
    description:
      "Eyebrow, the vibe inside it, area name, the opening paragraph and the position line.",
    locked: true,
    dataNote:
      "Blank fields use the guide copy that ships with the area. The cover image is set in Page images below.",
    fields: [
      optionalText("eyebrow", "Eyebrow", "Blank keeps “Community guide · …”."),
      optionalText(
        "vibe",
        "Vibe",
        "The two or three words after “Community guide · ” — “Emerging, waterfront, active-lifestyle”. Blank keeps the vibe that ships with the area.",
      ),
      optionalText("heading", "Heading", "Blank uses the area name."),
      optionalBody("intro", "Intro", "Blank keeps the built-in copy."),
      optionalText(
        "position",
        "Position line",
        "The small mono line below — “Located 15–20 minutes from Downtown Abu Dhabi.”",
      ),
    ],
    defaults: { eyebrow: null, vibe: null, heading: null, intro: null, position: null },
  },

  // 2 ── Cover image
  areaSection("hero-image", "Cover image", "Wide image under the intro.", {
    dataNote:
      "Pick the image in Page images above — it is the area record's cover, shared with the /areas grid.",
    fields: [
      {
        key: "brief",
        label: "Image brief",
        kind: "textarea",
        max: 400,
        optional: true,
        help: "Not shown on the page. A note for whoever sources the photo — “wide aerial showing the coastline, waterfront and skyline behind”.",
      },
    ],
    defaults: { brief: null },
  }),

  // 3 ── Property market statistics
  areaSection(
    "stats",
    "Property market statistics",
    "Headline index figures for the area.",
    {
      dataNote:
        "Leave the list empty and the band falls back to the medians on the area's guide record.",
      extraFields: [
        {
          key: "stats",
          label: "Figures",
          kind: "list",
          itemLabel: "figure",
          max: 8,
          help: "Each tile is a value and its caption — “AED 1,713 / sq. ft.” over “Property Sale Price Index”.",
          fields: [
            showToggle("Show this figure"),
            { key: "value", label: "Value", kind: "text", max: 48 },
            { key: "label", label: "Caption", kind: "text", max: 90 },
          ],
        },
        footnote("Dated the figures — “Sale data: June 2026 | Rental data: May 2026.”"),
      ],
      defaults: { stats: [], footnote: null },
    },
  ),

  // 4 ── Map
  areaSection("map", "Map", "Interactive map focused on this area.", {
    dataNote: "Pins come from the area's coordinates and live listings.",
    extraFields: [
      optionalBody(
        "detail",
        "Location detail",
        "The line under the intro — how the area sits against the rest of the city.",
      ),
    ],
    defaults: { detail: null },
  }),

  // 5 ── Landmarks & attractions
  areaSection(
    "landmarks",
    "Landmarks & attractions",
    "The destinations that define the area, each with a photo.",
    {
      extraFields: [
        {
          key: "items",
          label: "Landmarks",
          kind: "list",
          itemLabel: "landmark",
          max: 12,
          help: "Switch one off to hide it without losing the entry.",
          fields: [
            showToggle("Show this landmark"),
            { key: "name", label: "Name", kind: "text", max: 90 },
            {
              key: "image",
              label: "Photo",
              kind: "image",
              help: "Falls back to the placeholder caption below.",
            },
            {
              key: "img",
              label: "Placeholder caption",
              kind: "text",
              max: 80,
              optional: true,
            },
            optionalLink("href", "Link"),
          ],
        },
        footnote(
          "The supporting line under the grid — “53.5 km of coastline, 16 km of beaches…”.",
        ),
      ],
      defaults: { items: [], footnote: null },
    },
  ),

  // 6 ── Communities / developments
  areaSection(
    "communities",
    "Communities & developments",
    "The residential communities inside this area.",
    {
      extraFields: [
        {
          key: "items",
          label: "Communities",
          kind: "list",
          itemLabel: "community",
          max: 16,
          help: "Point one at its project page and the card becomes a link.",
          fields: [
            showToggle("Show this community"),
            { key: "name", label: "Name", kind: "text", max: 90 },
            {
              key: "desc",
              label: "Description",
              kind: "textarea",
              max: 240,
              optional: true,
            },
            optionalLink("href", "Link"),
            {
              key: "image",
              label: "Image",
              kind: "image",
              help: "Falls back to the placeholder caption below.",
            },
            {
              key: "img",
              label: "Placeholder caption",
              kind: "text",
              max: 80,
              optional: true,
            },
          ],
        },
        footnote("The supporting line under the grid."),
      ],
      defaults: { items: [], footnote: null },
    },
  ),

  // 7 ── Properties for sale
  areaSection(
    "listings",
    "Properties for sale",
    "Live sale stock in this area, with a link to the full search.",
    {
      dataNote: "Cards come from published listings for sale — they aren't picked here.",
      extraFields: [
        {
          key: "cta_label",
          label: "CTA label",
          kind: "text",
          max: 60,
          optional: true,
          help: "Blank keeps “View all properties for sale”.",
        },
        optionalLink("cta_href", "CTA link", "Blank links to the area's sale search."),
      ],
      defaults: { cta_label: null, cta_href: null },
    },
  ),

  // 8 ── Properties for rent
  areaSection(
    "rentals",
    "Properties for rent",
    "Live rental stock in this area, with a link to the full search.",
    {
      dataNote: "Cards come from published rental listings — they aren't picked here.",
      extraFields: [
        {
          key: "cta_label",
          label: "CTA label",
          kind: "text",
          max: 60,
          optional: true,
          help: "Blank keeps “View all properties for rent”.",
        },
        optionalLink("cta_href", "CTA link", "Blank links to the area's rental search."),
        optionalBody(
          "empty_body",
          "Copy when nothing is listed",
          "Shown instead of the cards while the area has no published rentals — “Speak with our team about current and upcoming availability.”",
        ),
      ],
      defaults: { cta_label: null, cta_href: null, empty_body: null },
    },
  ),

  // 9 ── Nearby destinations
  areaSection(
    "nearby",
    "Nearby destinations",
    "Drive times to the places buyers ask about.",
    {
      extraFields: [
        {
          key: "items",
          label: "Destinations",
          kind: "list",
          itemLabel: "destination",
          max: 10,
          fields: [
            showToggle("Show this destination"),
            { key: "name", label: "Destination", kind: "text", max: 90 },
            {
              key: "time",
              label: "Distance / time",
              kind: "text",
              max: 60,
              optional: true,
              help: "“approx. 20 min”, “directly opposite the island”.",
            },
            optionalLink("href", "Link"),
          ],
        },
        footnote("Any caveat — “travel times vary by starting point and traffic”."),
      ],
      defaults: { items: [], footnote: null },
    },
  ),

  // 10 ── Why choose this area
  areaSection(
    "why",
    "Why choose this area",
    "The five reasons to live or invest here.",
    {
      extraFields: [
        {
          key: "items",
          label: "Reasons",
          kind: "list",
          itemLabel: "reason",
          max: 8,
          fields: [
            showToggle("Show this reason"),
            { key: "name", label: "Title", kind: "text", max: 90 },
            {
              key: "desc",
              label: "Description",
              kind: "textarea",
              max: 300,
              optional: true,
            },
          ],
        },
      ],
      defaults: { items: [] },
    },
  ),

  // 11 ── Lead generation form
  areaSection(
    "lead-form",
    "Lead generation form",
    "Consultation request, stamped with this area.",
    {
      dataNote:
        "The fields themselves — name, phone, email, intent, property type, budget, message — aren't editable here.",
      extraFields: [
        {
          key: "cta_label",
          label: "Submit button label",
          kind: "text",
          max: 60,
          optional: true,
          help: "Blank keeps “Request a free consultation”.",
        },
      ],
      defaults: { cta_label: null },
    },
  ),

  // 12 ── FAQs
  areaSection("faq", "FAQs", "Questions, with FAQPage schema for search.", {
    extraFields: [
      {
        key: "items",
        label: "Questions",
        kind: "list",
        itemLabel: "question",
        max: 12,
        fields: [
          { key: "q", label: "Question", kind: "text", max: 200 },
          {
            key: "a",
            label: "Answer",
            kind: "textarea",
            max: 1200,
            optional: false,
          },
        ],
      },
    ],
    defaults: { items: [] },
  }),

  // 13 ── Final CTA
  areaSection("final-cta", "Final CTA", "The closing band at the foot of the guide.", {
    extraFields: [
      {
        key: "cta_label",
        label: "First button label",
        kind: "text",
        max: 60,
        optional: true,
        help: "Blank keeps “Explore properties”.",
      },
      optionalLink("cta_href", "First button link"),
      {
        key: "cta2_label",
        label: "Second button label",
        kind: "text",
        max: 60,
        optional: true,
        help: "Blank keeps “Get a free consultation”.",
      },
      optionalLink("cta2_href", "Second button link"),
    ],
    defaults: {
      cta_label: null,
      cta_href: null,
      cta2_label: null,
      cta2_href: null,
    },
  }),

  /*
   * ── Older bands, kept and still editable, but off unless switched on ──
   *
   * Four of the six drew their CONTENT from `lib/seeds/areas.ts` and had only
   * a heading and an intro here, so the schools, the amenities, the commute
   * chips, the prose and the dining picks were English editorial in code that
   * no editor could reach. Switching a band on published that English on `/ar`
   * with no way to fix it short of a deploy.
   *
   * They get their content fields below. The seed stays as the fallback — a
   * blank field keeps what ships with the area, exactly as the thirteen live
   * bands behave — and it is folded through the store on `/ar`, so the
   * fallback is Arabic too. See `localiseSeed` in lib/queries/area-profile.ts.
   */
  areaSection("schools", "Schools & amenities", "Nearby schools and facilities.", {
    defaultEnabled: false,
    dataNote:
      "Leave either list empty and that column falls back to the schools and amenities that ship with the area.",
    extraFields: [
      {
        key: "schools",
        label: "Schools",
        kind: "list",
        itemLabel: "school",
        max: 10,
        help: "Switch one off to hide it without losing the entry.",
        fields: [
          showToggle("Show this school"),
          { key: "name", label: "Name", kind: "text", max: 90 },
          {
            key: "curriculum",
            label: "Curriculum",
            kind: "text",
            max: 60,
            optional: true,
            help: "\u201cBritish\u201d, \u201cAmerican\u201d, \u201cIB\u201d.",
          },
          {
            key: "rating",
            label: "ADEK / KHDA rating",
            kind: "text",
            max: 40,
            optional: true,
            i18n: false,
            help: "\u201cOutstanding\u201d, \u201cVery good\u201d. Blank hides the rating.",
          },
          {
            key: "distance",
            label: "Distance",
            kind: "text",
            max: 20,
            optional: true,
            i18n: false,
            help: "The figure only \u2014 \u201c1.2\u201d renders as \u201c1.2 km\u201d.",
          },
        ],
      },
      {
        key: "amenities",
        label: "Amenities",
        kind: "list",
        itemLabel: "amenity",
        max: 16,
        help: "The facilities column beside the schools.",
        fields: [
          showToggle("Show this amenity"),
          { key: "name", label: "Name", kind: "text", max: 90 },
        ],
      },
    ],
    defaults: { schools: [], amenities: [] },
  }),
  areaSection("reports", "Market reports", "Rail linking to the area's reports.", {
    defaultEnabled: false,
    dataNote: "Reports come from the market-report records.",
  }),
  areaSection("valuation", "Valuation prompt", "Lead capture for owners.", {
    defaultEnabled: false,
    extraFields: [
      optionalText(
        "eyebrow",
        "Eyebrow",
        "Blank keeps \u201cOwn property in <area>?\u201d.",
      ),
      optionalBody(
        "body",
        "Supporting copy",
        "The paragraph under the headline. Blank keeps the built-in copy.",
      ),
      {
        key: "cta_label",
        label: "Button label",
        kind: "text",
        max: 60,
        optional: true,
        help: "Blank keeps \u201cValue my <area> property\u201d.",
      },
    ],
    defaults: { eyebrow: null, body: null, cta_label: null },
  }),
  areaSection("lifestyle", "Lifestyle dossier", "Commute chips, prose, dining.", {
    defaultEnabled: false,
    dataNote:
      "Every list falls back to what ships with the area, so a blank band still draws for an enriched area.",
    extraFields: [
      {
        key: "chips",
        label: "Commute snapshot",
        kind: "list",
        itemLabel: "destination",
        max: 8,
        help: "Each chip is a destination and a travel time.",
        fields: [
          showToggle("Show this destination"),
          { key: "label", label: "Destination", kind: "text", max: 60 },
          {
            key: "minutes",
            label: "Minutes",
            kind: "text",
            max: 5,
            i18n: false,
            help: "The figure only \u2014 \u201c14\u201d renders as \u201c14 min\u201d.",
          },
          {
            key: "mode",
            label: "Mode",
            kind: "select",
            options: [
              { value: "car", label: "Car" },
              { value: "metro", label: "Metro" },
              { value: "walk", label: "Walk" },
            ],
          },
        ],
      },
      optionalBody(
        "prose",
        "The rhythm of the week",
        "What the area actually feels like to live in. Blank keeps the copy that ships with the area.",
      ),
      {
        key: "dining",
        label: "Dining picks",
        kind: "list",
        itemLabel: "restaurant",
        max: 8,
        help: "Where the advisors take their clients.",
        fields: [
          showToggle("Show this restaurant"),
          { key: "name", label: "Name", kind: "text", max: 90 },
          {
            key: "kind",
            label: "Cuisine / location",
            kind: "text",
            max: 90,
            optional: true,
            help: "\u201cJapanese, Saadiyat Rotana\u201d.",
          },
          {
            key: "note",
            label: "Note",
            kind: "textarea",
            max: 240,
            optional: true,
          },
        ],
      },
    ],
    defaults: { chips: [], prose: null, dining: [] },
  }),
  areaSection("advisors", "Advisors", "Advisors who cover this area.", {
    defaultEnabled: false,
    dataNote: "Advisors come from the team records.",
  }),
  areaSection("similar", "Similar areas", "Links to comparable communities.", {
    defaultEnabled: false,
  }),
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
