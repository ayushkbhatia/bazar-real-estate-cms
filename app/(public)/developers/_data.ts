/**
 * Developer directory — the master list of developer partners shown on
 * /developers and resolved by /developers/[slug].
 *
 * This is the source of truth for a developer's *identity* (name, one-line
 * descriptor, logo). Live developments are joined in per-slug at render time
 * via `listDeveloperDevelopments()` when Supabase is configured; a developer
 * that only exists here (no DB row yet) still renders — its sub-page simply
 * shows the empty-developments state until the CMS grows the row.
 *
 * Logos are trimmed PNGs on white in /public/developers, rendered from the
 * client-supplied SVG set. All are 600×600 square canvases (logo centred with
 * padding); intrinsic dimensions are carried here so `next/image` renders them
 * without layout shift — the same contract as `_components/partners-data.ts`.
 *
 * Slugs for developers already seeded in the DB (aldar, modon, bloom, imkan,
 * reportage) match `lib/seeds/developers.ts` so their sub-pages enrich with
 * DB developments.
 */

export type DeveloperDir = {
  slug: string;
  /** Brand name as shown on cards and the sub-page hero. */
  name: string;
  /** One-line descriptor used on the card and as the fallback description. */
  blurb: string;
  logo: string;
  /** Intrinsic dimensions of the logo PNG (all 600×600). */
  w: number;
  h: number;
};

const W = 600;

export const DEVELOPERS: DeveloperDir[] = [
  { slug: "aldar", name: "Aldar Properties", blurb: "Abu Dhabi's largest master-developer — Yas, Saadiyat, Al Raha.", logo: "/developers/aldar.png", w: W, h: W },
  { slug: "arada", name: "Arada", blurb: "Destination communities across the UAE.", logo: "/developers/arada.png", w: W, h: W },
  { slug: "baraka", name: "Baraka", blurb: "Modern, lifestyle-led residential developments.", logo: "/developers/baraka.png", w: W, h: W },
  { slug: "binghatti", name: "Binghatti", blurb: "Bold, branded residential towers in Dubai.", logo: "/developers/binghatti.png", w: W, h: W },
  { slug: "bloom", name: "Bloom Holding", blurb: "Curated residential communities.", logo: "/developers/bloom.png", w: W, h: W },
  { slug: "burtville", name: "Burtville Developments", blurb: "Premium Abu Dhabi residential projects.", logo: "/developers/burtville.png", w: W, h: W },
  { slug: "damac", name: "DAMAC", blurb: "Premium branded residences across the UAE.", logo: "/developers/damac.png", w: W, h: W },
  { slug: "deyaar", name: "Deyaar", blurb: "Dubai residential & hospitality developments.", logo: "/developers/deyaar.png", w: W, h: W },
  { slug: "dubai-properties", name: "Dubai Properties", blurb: "Established Dubai master communities.", logo: "/developers/dubai-properties.png", w: W, h: W },
  { slug: "eagle-hills", name: "Eagle Hills", blurb: "Global waterfront destinations.", logo: "/developers/eagle-hills.png", w: W, h: W },
  { slug: "emaar", name: "Emaar", blurb: "Iconic master-planned communities.", logo: "/developers/emaar.png", w: W, h: W },
  { slug: "ict", name: "ICT Real Estate", blurb: "Waterfront residential living.", logo: "/developers/ict.png", w: W, h: W },
  { slug: "imkan", name: "IMKAN Properties", blurb: "Design-led communities.", logo: "/developers/imkan.png", w: W, h: W },
  { slug: "meraas", name: "Meraas", blurb: "Lifestyle destinations across Dubai.", logo: "/developers/meraas.png", w: W, h: W },
  { slug: "miral", name: "Miral", blurb: "Abu Dhabi's leisure & destination developer — Yas Island.", logo: "/developers/miral.png", w: W, h: W },
  { slug: "modon", name: "Modon Properties", blurb: "Government-backed large-scale communities.", logo: "/developers/modon.png", w: W, h: W },
  { slug: "nakheel", name: "Nakheel", blurb: "Iconic waterfront communities.", logo: "/developers/nakheel.png", w: W, h: W },
  { slug: "nine-yards", name: "Nine Yards", blurb: "Luxury projects in iconic locations.", logo: "/developers/nine-yards.png", w: W, h: W },
  { slug: "nic-developers", name: "NIC Developers", blurb: "Residential & mixed-use developments.", logo: "/developers/nic-developers.png", w: W, h: W },
  { slug: "nshama", name: "Nshama", blurb: "Developer behind the Town Square community.", logo: "/developers/nshama.png", w: W, h: W },
  { slug: "ohana", name: "Ohana Development", blurb: "Branded waterfront residences.", logo: "/developers/ohana.png", w: W, h: W },
  { slug: "q-properties", name: "Q Properties", blurb: "Reem-focused tower specialist.", logo: "/developers/q-properties.png", w: W, h: W },
  { slug: "radiant", name: "Radiant Real Estate", blurb: "Al Reem residential towers.", logo: "/developers/radiant.png", w: W, h: W },
  { slug: "rak-properties", name: "RAK Properties", blurb: "Northern-emirates waterfront living.", logo: "/developers/rak-properties.png", w: W, h: W },
  { slug: "reportage", name: "Reportage Properties", blurb: "Off-plan residential communities.", logo: "/developers/reportage.png", w: W, h: W },
  { slug: "saas-properties", name: "SAAS Properties", blurb: "Residential & commercial developments.", logo: "/developers/saas-properties.png", w: W, h: W },
  { slug: "samana", name: "Samana Developers", blurb: "Investor-focused off-plan projects.", logo: "/developers/samana.png", w: W, h: W },
  { slug: "sobha", name: "Sobha Realty", blurb: "High-quality villas & apartments.", logo: "/developers/sobha.png", w: W, h: W },
  { slug: "taraf", name: "Taraf", blurb: "Boutique luxury residences.", logo: "/developers/taraf.png", w: W, h: W },
  { slug: "tiger-group", name: "Tiger Group", blurb: "Mixed-use developments.", logo: "/developers/tiger-group.png", w: W, h: W },
];

/** Developers sorted alphabetically by brand name (the master-grid order). */
export const DEVELOPERS_SORTED: DeveloperDir[] = [...DEVELOPERS].sort((a, b) =>
  a.name.localeCompare(b.name),
);

export function getDeveloperDir(slug: string): DeveloperDir | undefined {
  return DEVELOPERS.find((d) => d.slug === slug);
}
