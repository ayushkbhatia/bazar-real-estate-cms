/**
 * The hero search bar as it renders today, declared once.
 *
 * Not aspirational — tab for tab, label for label, ceiling for ceiling, this
 * is what shipped before the CMS could touch it. `registry.test.ts` holds the
 * literal strings to that promise, so an editor who opens
 * /admin/forms/search-bar and changes nothing leaves the home page identical.
 *
 * ## Arabic is absent on purpose
 *
 * No `label_ar` is declared here. Every English string below already has an
 * entry in `ARABIC_STORE`, and `fillSearchBarArabic` resolves them at read
 * time — which is what keeps "one Arabic per English" true across the whole
 * site rather than only within this file. Declaring twins here would fork
 * "Apartment" into a second Arabic that nothing compares against.
 *
 * Adding a tab, retiring one, or moving a price ceiling is an edit here and
 * nothing else: the manager lists it, the resolver merges it and the home page
 * renders it without a migration.
 */

import type { SearchBarCopy, SearchBarDef, SearchBarTab, SearchBarType } from "./types";
import { SEARCH_BAR_COPY_KEYS, copyArKey } from "./copy-keys";

export const SEARCH_BAR_KEY = "home_hero";

/** Every label starts unset — see the docblock on `SEARCH_BAR_COPY_KEYS`. */
function blankCopy(): SearchBarCopy {
  const out: Record<string, string | null> = {};
  for (const { key } of SEARCH_BAR_COPY_KEYS) {
    out[key] = null;
    out[copyArKey(key)] = null;
  }
  return out as SearchBarCopy;
}

const RESIDENTIAL_TYPES: SearchBarType[] = [
  { value: "apartment", label: "Apartment", label_ar: null },
  { value: "townhouse", label: "Townhouse", label_ar: null },
  { value: "villa", label: "Villa", label_ar: null },
  { value: "penthouse", label: "Penthouse", label_ar: null },
];

/** Both residential placeholders are the same string, and share one Arabic. */
const RESIDENTIAL_PLACEHOLDER = "Area, building, community or emirate";

const TABS: SearchBarTab[] = [
  {
    key: "off-plan",
    label: "Off-Plan",
    label_ar: null,
    route: "/off-plan",
    placeholder: RESIDENTIAL_PLACEHOLDER,
    placeholder_ar: null,
    types: RESIDENTIAL_TYPES,
    beds: true,
    size: null,
    price: { max: 50_000_000, step: 250_000 },
    enabled: true,
  },
  {
    key: "buy",
    label: "Buy",
    label_ar: null,
    route: "/buy",
    placeholder: RESIDENTIAL_PLACEHOLDER,
    placeholder_ar: null,
    types: RESIDENTIAL_TYPES,
    beds: true,
    size: null,
    price: { max: 50_000_000, step: 250_000 },
    enabled: true,
  },
  {
    key: "rent",
    label: "Rent",
    label_ar: null,
    route: "/rent",
    placeholder: RESIDENTIAL_PLACEHOLDER,
    placeholder_ar: null,
    types: RESIDENTIAL_TYPES,
    beds: true,
    size: null,
    price: { max: 1_000_000, step: 25_000 },
    enabled: true,
  },
  {
    key: "commercial",
    label: "Commercial",
    label_ar: null,
    route: "/commercial",
    placeholder: "Area or emirate",
    placeholder_ar: null,
    types: [
      { value: "land", label: "Land", label_ar: null },
      { value: "office", label: "Office", label_ar: null },
      { value: "building", label: "Building", label_ar: null },
      { value: "retail", label: "Retail Space", label_ar: null },
      { value: "commercial_villa", label: "Commercial Villa", label_ar: null },
    ],
    beds: false,
    size: { max: 200_000, step: 1_000 },
    price: { max: 200_000_000, step: 1_000_000 },
    enabled: true,
  },
];

export const SEARCH_BAR_DEF: SearchBarDef = {
  key: SEARCH_BAR_KEY,
  name: "Home hero search",
  surface: "Home page",
  path: "/",
  description:
    "The tabbed search bar over the hero video: what the four tabs are called, what each one searches, the placeholder in its box, the property types it offers and the words on its button.",
  copy: blankCopy(),
  tabs: TABS,
};

/** A deep copy, so a caller that mutates its result cannot edit the registry. */
export function defaultSearchBar(): SearchBarDef {
  return structuredClone(SEARCH_BAR_DEF);
}
