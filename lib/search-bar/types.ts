/**
 * The home hero search bar, as a thing an editor owns.
 *
 * It is not a lead form — nothing is captured, nothing is filed, and it has no
 * responses — so it does not belong in the `forms` registry beside the
 * enquiries. But it is the first control a visitor touches on the busiest page
 * on the site, and until now its four tab labels, its two placeholders and its
 * nine property-type labels were hard-coded English in
 * `lib/hero-search-config.ts`. On /ar they rendered English, because a literal
 * has no Arabic twin to fold.
 *
 * So it gets the same three-layer treatment the forms and the master pages
 * have, and sits at /admin/forms/search-bar as its own section:
 *
 *     registry defaults  (lib/search-bar/registry.ts)   ← what exists
 *             ↓ merged at read time
 *     stored rows        (search_bar + search_bar_tabs) ← what an editor changed
 *             ↓
 *     ResolvedSearchBar                                 ← what renders
 */

import type { SearchBarCopyArKey, SearchBarCopyKey } from "./copy-keys";

/** One property-type choice in a tab's dropdown. */
export type SearchBarType = {
  /** A member of `PROPERTY_TYPES` — what the search URL carries. */
  value: string;
  label: string;
  /*
   * Present-and-null rather than optional, throughout this file.
   *
   * `localiseRow` only reaches for the store when the twin KEY exists on the
   * object — `"label_ar" in row` is what distinguishes "translatable, nothing
   * typed" from "not a translatable column", and `undefined` cannot say the
   * first. A registry default that omitted the key would fold to English on
   * /ar with the Arabic sitting unused in the store, which is precisely the
   * bug this whole section exists to fix.
   */
  label_ar: string | null;
};

/** Ranges the sliders span. Bounds and step stay AED / ft²; only labels convert. */
export type SearchBarRange = { max: number; step: number };

export type SearchBarTab = {
  /** Stable identity — the `defaultMode` prop and the stored row both use it. */
  key: string;
  label: string;
  label_ar: string | null;
  /** Route the search submits to (already mode-scoped server-side). */
  route: string;
  placeholder: string;
  placeholder_ar: string | null;
  types: SearchBarType[];
  /** Residential tabs show a Beds select; commercial hides it. */
  beds: boolean;
  /** Commercial shows a size (ft²) range slider instead of beds. */
  size: SearchBarRange | null;
  price: SearchBarRange;
  enabled: boolean;
};

/** The eight overridable labels, English and Arabic, all nullable. */
export type SearchBarCopy = Record<SearchBarCopyKey | SearchBarCopyArKey, string | null>;

/** What ships in code: the bar as it renders with nothing stored. */
export type SearchBarDef = {
  key: string;
  name: string;
  surface: string;
  path: string;
  description: string;
  copy: SearchBarCopy;
  tabs: SearchBarTab[];
};

/** One bar as stored. Absent columns fall back to the registry default. */
export type StoredSearchBar = {
  key: string;
  copy: Partial<SearchBarCopy>;
};

/** One stored tab row, in the order the editor left it. */
export type StoredSearchBarTab = SearchBarTab & { position: number };

/** A bar resolved for rendering or editing: definition + effective values. */
export type ResolvedSearchBar = {
  key: string;
  def: SearchBarDef;
  copy: SearchBarCopy;
  tabs: SearchBarTab[];
  /** True when nothing has been saved yet — the registry defaults are live. */
  usingDefaults: boolean;
};
