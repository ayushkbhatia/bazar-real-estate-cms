/**
 * Config + pure URL builder for the home hero advanced search bar.
 * Kept out of the client component so the querystring logic is unit-
 * testable without pulling `next/navigation` into the node test env.
 *
 * Every field maps onto a key `parseFilters` (lib/filters/property.ts)
 * already understands — the target route pages scope by `mode` and apply
 * the rest, so the hero needs no bespoke backend.
 */

export type HeroTab = {
  value: string;
  label: string;
  /** Route the search submits to (already mode-scoped server-side). */
  route: string;
  placeholder: string;
  /** [enumValue, displayLabel] for the type dropdown. */
  types: readonly (readonly [string, string])[];
  /** Residential tabs show a Beds select; commercial hides it. */
  beds: boolean;
  /** Commercial tab shows a size (ft²) range slider. */
  size?: { max: number; step: number };
  price: { max: number; step: number };
};

const RESIDENTIAL_TYPES = [
  ["apartment", "Apartment"],
  ["townhouse", "Townhouse"],
  ["villa", "Villa"],
  ["penthouse", "Penthouse"],
] as const;

export const HERO_TABS: readonly HeroTab[] = [
  {
    value: "off-plan",
    label: "Off-Plan",
    route: "/off-plan",
    placeholder: "Area, building, community or emirate",
    types: RESIDENTIAL_TYPES,
    beds: true,
    price: { max: 50_000_000, step: 250_000 },
  },
  {
    value: "buy",
    label: "Buy",
    route: "/buy",
    placeholder: "Area, building, community or emirate",
    types: RESIDENTIAL_TYPES,
    beds: true,
    price: { max: 50_000_000, step: 250_000 },
  },
  {
    value: "rent",
    label: "Rent",
    route: "/rent",
    placeholder: "Area, building, community or emirate",
    types: RESIDENTIAL_TYPES,
    beds: true,
    price: { max: 1_000_000, step: 25_000 },
  },
  {
    value: "commercial",
    label: "Commercial",
    route: "/commercial",
    placeholder: "Area or emirate",
    types: [
      ["land", "Land"],
      ["office", "Office"],
      ["building", "Building"],
      ["retail", "Retail Space"],
      ["commercial_villa", "Commercial Villa"],
    ],
    beds: false,
    size: { max: 200_000, step: 1_000 },
    price: { max: 200_000_000, step: 1_000_000 },
  },
];

export type Range = { min: number | null; max: number | null };

export type HeroSearchState = {
  q: string;
  type: string;
  beds: string;
  price: Range;
  size: Range;
};

/**
 * Build the destination URL (route + querystring) for a hero search.
 * Only non-empty fields are emitted, and only the controls the tab
 * actually shows (beds / size) are considered.
 */
export function buildHeroSearchUrl(tab: HeroTab, state: HeroSearchState): string {
  const p = new URLSearchParams();
  if (state.q.trim()) p.set("q", state.q.trim());
  if (state.type) p.set("type", state.type);
  if (tab.beds && state.beds) p.set("beds", state.beds);
  if (state.price.min != null) p.set("price_min", String(state.price.min));
  if (state.price.max != null) p.set("price_max", String(state.price.max));
  if (tab.size) {
    if (state.size.min != null) p.set("ft2_min", String(state.size.min));
    if (state.size.max != null) p.set("ft2_max", String(state.size.max));
  }
  const qs = p.toString();
  return `${tab.route}${qs ? `?${qs}` : ""}`;
}
