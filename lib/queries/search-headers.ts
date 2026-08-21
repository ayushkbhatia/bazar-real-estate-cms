/**
 * Reads for the search-header registry (`lib/master-pages/search-headers.ts`).
 *
 * Same contract as `lib/queries/master-pages.ts`, `lib/queries/subpages.ts` and
 * `lib/queries/content-sections.ts`, and for the same reasons: the cookie-free
 * public client, and never throws and never returns nothing — a header that
 * fails to load must render the copy it shipped with rather than leaving the
 * top of a search page blank.
 *
 * `cache()` on the copy reader because `SearchList` is one call today and the
 * route's `generateMetadata` is the obvious second one; none of the loaders in
 * this directory is React-cached by default, so a second call is a second
 * round-trip.
 */
import { cache } from "react";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { type Locale } from "@/lib/i18n/locales";
import {
  parseStoredSections,
  resolveSections,
  str,
  type ResolvedSection,
} from "@/lib/master-pages";
import {
  getSearchHeader,
  searchHeaderFor,
  searchHeaderPageDef,
  type SearchHeaderKey,
} from "@/lib/master-pages/search-headers";
import { subPageSlug } from "@/lib/master-pages/subpages";
import type { PropertyForm, PropertyMode } from "@/lib/schemas/property";

export type SearchHeaderContent = {
  /** The one section this document holds, resolved over the code defaults. */
  section: ResolvedSection;
  /** True when nobody has saved it yet — the defaults are what renders. */
  usingDefaults: boolean;
};

/**
 * One search header's document.
 *
 * @param locale Pass "bilingual" from the CMS editor. Omitted, it resolves from
 * the request — the fold that `applyLocale` performs strips every `_ar` key, so
 * an editor given the folded values would render its Arabic inputs blank and
 * write that blank back on save.
 */
export async function getSearchHeaderContent(
  key: SearchHeaderKey,
  locale?: Locale | "bilingual",
): Promise<SearchHeaderContent> {
  const entry = getSearchHeader(key);
  if (!entry) throw new Error(`Unknown search header: ${key}`);
  const def = searchHeaderPageDef(entry);
  const fold = locale ?? (await currentLocale());

  const fallback = (): SearchHeaderContent => ({
    section: resolveSections(def, null, fold)[0]!,
    usingDefaults: true,
  });

  if (!isSupabaseConfigured) return fallback();

  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("pages")
      .select("blocks")
      .eq("slug", subPageSlug("search", key))
      .maybeSingle();
    if (error || !data) return fallback();

    const stored = parseStoredSections(data.blocks);
    // No media fields on this section, so there is nothing for
    // `attachImageUrls` to resolve — deliberately not called.
    return {
      section: resolveSections(def, stored, fold)[0]!,
      usingDefaults: stored === null,
    };
  } catch (error) {
    console.error(`[search-headers] failed to load "${key}"`, error);
    return fallback();
  }
}

/**
 * The three lines a search page renders.
 *
 * `eyebrow` and `subtitle` come back null when an editor cleared them, and the
 * page drops the element — a blank line is a legible editorial choice. `title`
 * falls back to the shipped headline instead, because an empty h1 is a broken
 * page rather than a choice.
 */
export type SearchHeaderCopy = {
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
};

export const getSearchHeaderCopy = cache(
  async (
    mode: PropertyMode,
    form?: PropertyForm | null,
    locale?: Locale,
  ): Promise<SearchHeaderCopy> => {
    const entry = searchHeaderFor(mode, form);
    /*
     * Resolved here rather than left to `getSearchHeaderContent`, because the
     * title fallback below needs the SAME fold. Reading
     * `entry.section.defaults.title` instead would put the English headline on
     * `/ar` the one time an editor blanks the field — the exact hole this
     * fallback exists to avoid.
     */
    const fold = locale ?? (await currentLocale());
    const content = await getSearchHeaderContent(entry.key, fold);
    const values = content.section.values;
    const shipped = () =>
      resolveSections(searchHeaderPageDef(entry), null, fold)[0]!.values;
    return {
      eyebrow: str(values, "eyebrow"),
      title: str(values, "title") ?? str(shipped(), "title") ?? "",
      subtitle: str(values, "subtitle"),
    };
  },
);
