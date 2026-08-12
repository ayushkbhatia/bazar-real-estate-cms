import type { BlockDef } from "../types";

/**
 * Blocks backed by live catalogue records.
 *
 * These are the only blocks that cost a query, so they are the only ones with
 * `queryCost`. The resolver collapses repeats — eight picked-property blocks
 * are one `listPropertiesByReference` call — but the budget is deliberately
 * charged per block anyway: it caps how much of a page is live inventory
 * rather than how many round-trips the current implementation happens to make.
 */

/** Curated or query-driven property rail — `FeaturedListings`. */
export const featuredProperties: BlockDef = {
  key: "featured_properties",
  label: "Featured properties",
  description:
    "A four-up row of listings, either hand-picked or pulled from a live view.",
  group: "listings",
  needs: ["properties_picked", "properties_query"],
  queryCost: 1,
  dataNote:
    "Price, beds, photo and status come from the property record. Unpublished picks are dropped rather than linking nowhere.",
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    { key: "title", label: "Heading", kind: "text", max: 120 },
    {
      key: "source",
      label: "Where the listings come from",
      kind: "select",
      options: [
        { value: "picked", label: "Hand-picked below" },
        { value: "exclusive", label: "Bazar exclusives" },
        { value: "new_this_week", label: "New this week" },
        { value: "price_drops", label: "Price drops" },
      ],
      help: "Hand-picked keeps your order; the rest refresh on their own.",
    },
    {
      key: "limit",
      label: "How many",
      kind: "select",
      options: [
        { value: "4", label: "4 — one row" },
        { value: "8", label: "8 — two rows" },
      ],
      help: "Ignored when hand-picking",
    },
    {
      key: "picks",
      label: "Hand-picked listings",
      kind: "list",
      itemLabel: "listing",
      max: 12,
      seedKey: "properties",
      help: "In display order. Only used when the source above is hand-picked.",
      fields: [
        {
          key: "slug",
          label: "Listing",
          kind: "select",
          optionsKey: "properties",
          placeholder: "Choose a listing",
        },
      ],
    },
    {
      key: "cta_label",
      label: "Button",
      kind: "text",
      max: 40,
      optional: true,
      help: "Leave blank to hide it",
    },
    { key: "cta_href", label: "Button link", kind: "link", optional: true },
  ],
  defaults: {
    eyebrow: "Handpicked",
    title: "Featured properties",
    source: "picked",
    limit: "4",
    picks: [],
    cta_label: "Browse all",
    cta_href: "/buy/search",
  },
};

/** Off-plan project rail — `OffPlanProjects`, mobile snap carousel. */
export const featuredDevelopments: BlockDef = {
  key: "featured_developments",
  label: "Featured projects",
  description:
    "Off-plan development cards with developer, area, starting price and handover.",
  group: "listings",
  needs: ["developments"],
  queryCost: 1,
  dataNote:
    "Cover photo, price and handover come from the project record. Leave the picks empty for the three most recent published projects.",
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    { key: "heading", label: "Heading", kind: "text", max: 120 },
    { key: "body", label: "Sub-copy", kind: "textarea", max: 280, optional: true },
    {
      key: "picks",
      label: "Projects",
      kind: "list",
      itemLabel: "project",
      max: 9,
      seedKey: "developments",
      help: "In display order. Empty shows the three most recent.",
      fields: [
        {
          key: "slug",
          label: "Project",
          kind: "select",
          optionsKey: "developments",
          placeholder: "Choose a project",
        },
      ],
    },
    { key: "cta_label", label: "Button", kind: "text", max: 40, optional: true },
    { key: "cta_href", label: "Button link", kind: "link", optional: true },
  ],
  defaults: {
    eyebrow: "Off-plan projects for sale",
    heading: "New developments in Abu Dhabi",
    body: "Explore the latest off-plan projects across top communities.",
    picks: [],
    cta_label: "All developments",
    cta_href: "/developments",
  },
};

export const LISTING_BLOCKS = [featuredProperties, featuredDevelopments];
