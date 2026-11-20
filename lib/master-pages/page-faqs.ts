/**
 * Page FAQs: the questions at the foot of the guides, the service pages and
 * the tools, the pages whose body is copy in code (`messages/*`,
 * `lib/seeds/services.ts`) and that therefore had nowhere to keep one.
 *
 * ## Why a registry of its own
 *
 * The same reasoning as `search-headers.ts`. These pages are not master pages
 * (their body is not a document, and moving eleven guides into one would be a
 * rewrite for the sake of a footer), not sub-pages (no database record behind
 * them), and not library sections (each page's questions are its own). So it is
 * one document per page, addressed by a fixed key, edited at
 * /admin/pages/sub/faq/<key>.
 *
 * ## Why the questions ship empty
 *
 * A page with no saved document renders no FAQ at all, rather than shipping a
 * default set in code: the questions are researched content (the FAQ
 * programme, scripts/faq-programme/) and belong in the database, where an edit
 * costs no deploy. Only the eyebrow and heading have defaults, with their
 * Arabic declared beside them (curated, short, the same words the area guides
 * use).
 *
 * ## Storage
 *
 * `pages.blocks` under `subpage/faq/<key>`, one section keyed `faq`. Same jsonb
 * column as every other registry, no migration, and the reserved `subpage/`
 * prefix keeps the rows out of `/pages/[slug]` and the Pages list.
 */
import { eyebrow, faqList, heading, text } from "./fields";
import type { FieldDef, MasterPageDef, MasterPageKey, SectionDef } from "./types";

export type PageFaqGroup = "guides" | "services" | "tools" | "developers";

export type PageFaqDef = {
  /** `guide-<slug>`, `service-<slug>`, `tool-<slug>` or `developer-<slug>`. */
  key: string;
  label: string;
  group: PageFaqGroup;
  /** The route the questions render on: the "View page" link. */
  publicPath: string;
};

/** Storage key for the one section inside every FAQ document. */
export const PAGE_FAQ_SECTION_KEY = "faq";

const GUIDES: [slug: string, label: string][] = [
  ["golden-visa", "Golden Visa"],
  ["kyc-non-residents", "KYC for non-residents"],
  ["property-linked-residency", "Property-linked residency"],
  ["tax-residency", "Tax residency certificate"],
  ["for-tenants", "For tenants"],
  ["for-landlords", "For landlords"],
  ["how-to-rent-out", "How to rent out your property"],
  ["property-management", "Property management"],
  ["rental-process", "The rental process"],
  ["required-documents", "Required documents for renting"],
  ["tenant-move-in", "Tenant move-in"],
];

/** Every `/services/<slug>` page except `sell`, whose FAQ is its master page's. */
const SERVICES: [slug: string, label: string][] = [
  ["buy", "Buy with Bazar"],
  ["consultation", "Property consultation"],
  ["consulting", "Consulting"],
  ["conveyancing", "Conveyancing"],
  ["developer", "Developer services"],
  ["handover", "Handover support"],
  ["interior-design", "Interior design & furnishing"],
  ["invest", "Investment advisory"],
  ["manage", "Property management"],
  ["rental-finance", "Rental finance management"],
  ["residency-visas", "Residency visa support"],
  ["sales-leasing", "Sales & leasing"],
  ["snagging", "Snagging inspection"],
  ["tenant-matchmaking", "Tenant matchmaking"],
];

/** `/tools/mortgage` keeps its FAQ in the mortgage master page. */
const TOOLS: [slug: string, label: string][] = [
  ["valuation", "Valuation"],
  ["compare", "Compare"],
];

export const PAGE_FAQS: PageFaqDef[] = [
  ...GUIDES.map(([slug, label]) => ({
    key: `guide-${slug}`,
    label,
    group: "guides" as const,
    publicPath: `/guides/${slug}`,
  })),
  ...SERVICES.map(([slug, label]) => ({
    key: `service-${slug}`,
    label,
    group: "services" as const,
    publicPath: `/services/${slug}`,
  })),
  ...TOOLS.map(([slug, label]) => ({
    key: `tool-${slug}`,
    label,
    group: "tools" as const,
    publicPath: `/tools/${slug}`,
  })),
];

export const PAGE_FAQ_GROUP_LABELS: Record<PageFaqGroup, string> = {
  guides: "Guides",
  services: "Service pages",
  tools: "Tools",
  developers: "Developer profiles",
};

/**
 * Developer profiles are the one record-backed group: one FAQ per developer,
 * keyed by the developer's slug, so the registry cannot list them. Any
 * well-formed `developer-<slug>` key is accepted here; the editor's index lists
 * the developers that exist, and a key for one that doesn't is a document
 * nothing renders.
 */
const DEVELOPER_KEY = /^developer-([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function developerFaqKey(slug: string): string {
  return `developer-${slug}`;
}

export function developerPageFaq(slug: string, name: string): PageFaqDef {
  return {
    key: developerFaqKey(slug),
    label: name,
    group: "developers",
    publicPath: `/developers/${slug}`,
  };
}

export function getPageFaq(key: string): PageFaqDef | null {
  const fixed = PAGE_FAQS.find((f) => f.key === key);
  if (fixed) return fixed;
  const m = DEVELOPER_KEY.exec(key);
  return m ? developerPageFaq(m[1]!, m[1]!) : null;
}

export function pageFaqKeyFor(group: PageFaqGroup, slug: string): string | null {
  if (group === "developers") return developerFaqKey(slug);
  const prefix = group === "guides" ? "guide" : group === "services" ? "service" : "tool";
  return getPageFaq(`${prefix}-${slug}`)?.key ?? null;
}

/** The one section, identical on every page. */
export const PAGE_FAQ_SECTION: SectionDef = {
  key: PAGE_FAQ_SECTION_KEY,
  label: "FAQs",
  description:
    "The questions at the foot of the page, published to search engines as an FAQ. Lead each answer with a sentence that answers the question on its own.",
  // The section is the document; with no questions saved the page shows none.
  locked: true,
  fields: [
    eyebrow(),
    heading({ optional: true }),
    text("intro", "Intro", { max: 240, optional: true }),
    faqList(),
  ] satisfies FieldDef[],
  defaults: {
    eyebrow: "FAQs",
    eyebrow_ar: "الأسئلة الشائعة",
    heading: "Questions, answered.",
    heading_ar: "أسئلة وأجوبة.",
    items: [],
  },
};

/**
 * A page FAQ presented as a `MasterPageDef`, so it goes straight through
 * `resolveSections` / `validateSections` and into the shared editor, the same
 * trick `searchHeaderPageDef` uses.
 */
export function pageFaqPageDef(def: PageFaqDef): MasterPageDef {
  return {
    key: `faq/${def.key}` as unknown as MasterPageKey,
    label: def.label,
    path: def.publicPath,
    description: `The FAQ on ${def.publicPath}.`,
    sections: [PAGE_FAQ_SECTION],
  };
}

/** Exported for the guards that enumerate every registry's field lists. */
export function pageFaqFieldLists(): { origin: string; fields: FieldDef[] }[] {
  return [{ origin: "page-faq", fields: PAGE_FAQ_SECTION.fields }];
}
