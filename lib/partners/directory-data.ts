/**
 * Bazar's partner ecosystem as it ships in the repo — the banking and
 * regulatory institutions Bazar works alongside (distinct from the developer
 * partners, whose directory is `lib/developers/directory-data.ts`).
 *
 * WHY IT MOVED HERE
 *
 * This list lived in `app/[locale]/(public)/_components/partners-data.ts` while
 * the only things reading it were two public components. It is now the SEED
 * behind a CMS document — the `partner-logos` library section, which ships
 * these seven rows as its defaults and lets an editor rename, re-tag, reorder,
 * hide, replace or add to them (`lib/master-pages/library.ts`). A catalogue the
 * CMS registry reads belongs beside the other catalogue the CMS registry reads,
 * not under `app/`.
 *
 * Logos are trimmed, transparent PNGs in /public/partners. Intrinsic pixel
 * dimensions are carried here so `next/image` renders them without layout
 * shift; height is normalised in the UI so optical weight stays even. Same
 * contract as `lib/developers/directory-data.ts`.
 *
 * An editor who uploads a logo overrides the art below for that card, and one
 * who adds a card supplies their own — see `lib/partners/shipped-logo.ts` for
 * the precedence.
 */

export type PartnerCategory = "banking" | "regulatory";

/** One `src`/`w`/`h` triple, whatever supplied it. */
export type PartnerLogoArt = { src: string; w: number; h: number };

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

/** The two group keys, in the order /partners lays them out. */
export const PARTNER_CATEGORIES: PartnerCategory[] = ["banking", "regulatory"];

export function isPartnerCategory(value: unknown): value is PartnerCategory {
  return value === "banking" || value === "regulatory";
}

/**
 * One partner card, resolved for rendering.
 *
 * `logo` is already resolved to art — the surfaces that draw it should not each
 * re-implement the uploaded-then-shipped precedence — and `name` is always a
 * string, because an <img> with no alt text is a defect no CMS field should be
 * able to introduce.
 */
export type ResolvedPartner = {
  slug: string;
  name: string;
  tag: string | null;
  category: PartnerCategory | null;
  logo: PartnerLogoArt | null;
};

/**
 * The shipped catalogue as resolved cards.
 *
 * Two callers, and they are the reason this lives here rather than beside the
 * CMS reader: it is both the fallback when the document resolves to nothing and
 * the default a public component renders when no caller passed it anything. A
 * `"use client"` marquee must not have to import the section registry to know
 * what a partner looks like.
 */
export function shippedPartners(): ResolvedPartner[] {
  return ECOSYSTEM_PARTNERS.map((p) => ({
    slug: p.slug,
    name: p.name,
    tag: p.tag,
    category: p.category,
    logo: { src: p.logo, w: p.w, h: p.h },
  }));
}

/*
 * `PARTNER_GROUPS` lived here and carried each group's title and blurb
 * alongside its category. The words moved to the `partners` master page when
 * /partners became editable (lib/master-pages/sections/partners.ts) — the
 * category, which is the filter key that selects the cards, stayed with the
 * data it filters and is now bound to its section in the page's own
 * `GROUP_CATEGORY` map.
 */
