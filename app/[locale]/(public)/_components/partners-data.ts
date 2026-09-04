/**
 * Bazar's partner ecosystem — the banking and regulatory institutions Bazar
 * works alongside (distinct from the developer partners shown elsewhere).
 *
 * Logos are trimmed, transparent PNGs in /public/partners. Intrinsic pixel
 * dimensions are carried here so `next/image` renders them without layout
 * shift; height is normalised in the UI via CSS so optical weight stays even.
 *
 * Shared by the /about "Our Partner Ecosystem" carousel and the /partners page.
 */

export type PartnerCategory = "banking" | "regulatory";

export type EcosystemPartner = {
  slug: string;
  /** Full institution name (alt text + partners-page label). */
  name: string;
  /** One-line descriptor of the relationship. */
  tag: string;
  category: PartnerCategory;
  logo: string;
  /** Intrinsic dimensions of the trimmed logo PNG. */
  w: number;
  h: number;
};

export const ECOSYSTEM_PARTNERS: EcosystemPartner[] = [
  {
    slug: "fab",
    name: "First Abu Dhabi Bank",
    tag: "Mortgage & home-finance partner",
    category: "banking",
    logo: "/partners/fab.png",
    w: 520,
    h: 320,
  },
  {
    slug: "adcb",
    name: "Abu Dhabi Commercial Bank",
    tag: "Mortgage & home-finance partner",
    category: "banking",
    logo: "/partners/adcb.png",
    w: 520,
    h: 183,
  },
  {
    slug: "adib",
    name: "Abu Dhabi Islamic Bank",
    tag: "Islamic home-finance partner",
    category: "banking",
    logo: "/partners/adib.png",
    w: 520,
    h: 359,
  },
  {
    slug: "dib",
    name: "Dubai Islamic Bank",
    tag: "Islamic home-finance partner",
    category: "banking",
    logo: "/partners/dib.png",
    w: 520,
    h: 373,
  },
  {
    slug: "dld",
    name: "Dubai Land Department",
    tag: "Property registration authority",
    category: "regulatory",
    logo: "/partners/dld.png",
    w: 485,
    h: 520,
  },
  {
    slug: "adrec",
    name: "Abu Dhabi Real Estate Centre",
    tag: "Abu Dhabi real-estate regulator",
    category: "regulatory",
    logo: "/partners/adrec.png",
    w: 520,
    h: 189,
  },
  {
    slug: "adgm",
    name: "Abu Dhabi Global Market",
    tag: "International financial centre & regulator",
    category: "regulatory",
    logo: "/partners/adgm.png",
    w: 520,
    h: 207,
  },
];

/*
 * `PARTNER_GROUPS` lived here and carried each group's title and blurb
 * alongside its category. The words moved to the `partners` master page when
 * /partners became editable (lib/master-pages/sections/partners.ts) — the
 * category, which is the filter key that selects the cards, stayed with the
 * data it filters and now sits in the page's own `GROUPS` constant.
 *
 * Removed rather than left in place: it had exactly one consumer, and a copy
 * of the headings that no longer renders is the kind of thing an editor
 * changes in the CMS and then finds unchanged somewhere in the source.
 */
