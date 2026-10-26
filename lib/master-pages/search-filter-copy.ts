/**
 * The search results filter bar's words, editable in Pages & blocks →
 * Sections → Search filters (client, Oct 2026).
 *
 * Each field stands for one message in the `search` catalogue. A blank field
 * keeps the catalogue's words, which the editor shows greyed in the box —
 * English and Arabic, read from the catalogue itself so the placeholder can
 * never disagree with what the page renders. `searchFilterOverrides` turns a
 * saved document into a patch over the catalogue, which the search page lays
 * over the client messages for the bar alone, so the bar's components read
 * their words exactly as before and need no knowledge of the CMS.
 *
 * `{count}` and `{symbol}` are kept in the messages that carry them: an
 * edited "Clear {count}" still shows the number.
 */
import enSearch from "@/messages/en/search.json";
import arSearch from "@/messages/ar/search.json";
import { text } from "./fields";
import type { FieldDef, SectionValues } from "./types";

/** [field key, editor label, `search` message path]. Keys are storage. */
export const SEARCH_FILTER_COPY: [string, string, string][] = [
  ["copy_search_placeholder", "Search box · placeholder", "filters.searchPlaceholder"],
  ["copy_beds", "Bedrooms · label", "filters.beds"],
  ["copy_studio", "Bedrooms · studio", "filters.studio"],
  ["copy_baths", "Bathrooms · label", "filters.baths"],
  ["copy_type", "Property type · label", "filters.propertyType"],
  ["copy_any_type", "Property type · any", "filters.anyType"],
  ["copy_area", "Area · label", "filters.area"],
  ["copy_any_area", "Area · any", "filters.anyArea"],
  ["copy_price", "Price · label", "filters.price"],
  ["copy_price_min", "Price · minimum placeholder", "filters.priceMinPlaceholder"],
  ["copy_price_max", "Price · maximum placeholder", "filters.priceMaxPlaceholder"],
  ["copy_segment", "Segment · label", "segment.label"],
  ["copy_residential", "Segment · residential", "segment.residential"],
  ["copy_commercial", "Segment · commercial", "segment.commercial"],
  ["copy_completion", "Completion · label", "filters.completion"],
  ["copy_off_plan", "Completion · off-plan", "formOption.off_plan"],
  ["copy_ready_new", "Completion · ready (new)", "formOption.ready_new"],
  ["copy_resale", "Completion · resale", "formOption.resale"],
  ["copy_sort", "Sort · label", "sort.label"],
  ["copy_sort_recent", "Sort · most recent", "sort.recent"],
  ["copy_sort_price_asc", "Sort · price low to high", "sort.price_asc"],
  ["copy_sort_price_desc", "Sort · price high to low", "sort.price_desc"],
  ["copy_sort_area_desc", "Sort · largest first", "sort.area_desc"],
  ["copy_view_grid", "View · grid", "view.grid"],
  ["copy_view_list", "View · list", "view.list"],
  ["copy_view_map", "View · map", "view.map"],
  ["copy_clear", "Clear button", "filters.clearCount"],
  ["copy_filters", "Phone · filters button", "filters.filters"],
  ["copy_filters_count", "Phone · filters button with count", "filters.filtersWithCount"],
  ["copy_show_results", "Phone · show results", "filters.showResults"],
];

function messageAt(bag: unknown, path: string): string {
  const v = path
    .split(".")
    .reduce<unknown>(
      (o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined),
      bag,
    );
  return typeof v === "string" ? v : "";
}

/** The editor's fields, each showing the catalogue's words as its fallback. */
export function searchFilterCopyFields(): FieldDef[] {
  return SEARCH_FILTER_COPY.map(([key, label, path]) =>
    text(key, label, {
      max: 80,
      optional: true,
      placeholder: messageAt(enSearch, path),
      placeholderAr: messageAt(arSearch, path),
    }),
  );
}

/**
 * The saved document (already folded to one language) as a patch over the
 * `search` catalogue: `{ filters: { beds: "Bedrooms" }, sort: { … } }`.
 * Blank fields are left out, so they keep the catalogue's words.
 */
export function searchFilterOverrides(
  values: SectionValues,
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const [key, , path] of SEARCH_FILTER_COPY) {
    const v = values[key];
    if (typeof v !== "string" || !v.trim()) continue;
    const [group, leaf] = path.split(".") as [string, string];
    (out[group] ??= {})[leaf] = v.trim();
  }
  return out;
}
