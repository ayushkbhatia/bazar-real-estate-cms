/**
 * The search results filters, as configured under Pages & blocks → Sections →
 * Search filters (`lib/master-pages/library.ts`).
 */
import { cache } from "react";

import { getLibrarySectionContent } from "@/lib/queries/content-sections";
import { listAmenitiesTaxonomy } from "@/lib/queries/amenities-taxonomy";
import type { Locale } from "@/lib/i18n/locales";
import { searchFilterOverrides } from "@/lib/master-pages/search-filter-copy";

/** One choice in the Amenities filter. `value` goes in the URL and the query. */
export type AmenityChoice = { value: string; label: string };

export type SearchFilterSettings = {
  /** The Amenities button's words, in the page's language. */
  amenitiesLabel: string;
  amenities: AmenityChoice[];
  /** Edited words, as a patch over the `search` catalogue (blank = shipped). */
  overrides: Record<string, Record<string, string>>;
};

/**
 * The amenities the filter offers, in the page's language.
 *
 * Picked in the CMS from the live taxonomy, in the editor's order; only the
 * switched-on picks are offered, none means no filter. A pick whose amenity was since retired or
 * renamed drops out rather than offering a filter that matches nothing. The
 * label is the taxonomy's own Arabic on /ar (English where none is written),
 * so the filter speaks the same words as the listing page.
 */
export const getSearchFilterSettings = cache(
  async (locale: Locale): Promise<SearchFilterSettings> => {
    const [content, taxonomy] = await Promise.all([
      getLibrarySectionContent("search_filters", locale),
      listAmenitiesTaxonomy(),
    ]);
    const values = content.section.values;
    const byLabel = new Map(taxonomy.map((a) => [a.label, a]));
    const label = (a: { label: string; label_ar?: string | null }) =>
      locale === "ar" ? a.label_ar?.trim() || a.label : a.label;

    const items: unknown[] = Array.isArray(values.amenities) ? values.amenities : [];
    const picked = items
      .filter(
        (i): i is Record<string, unknown> =>
          !!i && typeof i === "object" && (i as Record<string, unknown>).enabled !== false,
      )
      .map((i) => (typeof i.amenity === "string" ? byLabel.get(i.amenity) : undefined))
      .filter((a): a is NonNullable<typeof a> => !!a);
    // Only what the admin switched on and saved (client, Oct 2026). None yet,
    // and the filter is not drawn — it no longer falls back to every amenity.
    const offered = picked;
    const seen = new Set<string>();

    return {
      amenitiesLabel:
        (typeof values.amenities_label === "string" && values.amenities_label.trim()) ||
        (locale === "ar" ? "المرافق" : "Amenities"),
      overrides: searchFilterOverrides(values),
      amenities: offered
        .filter((a) => (seen.has(a.label) ? false : (seen.add(a.label), true)))
        .map((a) => ({ value: a.label, label: label(a) })),
    };
  },
);
