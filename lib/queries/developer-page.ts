/**
 * Reads for the developer-page copy registry
 * (`lib/master-pages/developer-page.ts`).
 *
 * Same contract as `lib/queries/search-headers.ts`: the cookie-free public
 * client, never throws, and never returns nothing — a document that fails to
 * load renders the copy it shipped with rather than leaving a profile page's
 * headings blank.
 *
 * `cache()` because `/developers/[slug]` reads it once for the body and
 * `generateMetadata` is the obvious second caller; without it that is two
 * round-trips per request for one row.
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
  DEVELOPER_PAGE_COPY_KEY,
  developerPageCopyDef,
  fillTokens,
} from "@/lib/master-pages/developer-page";
import { subPageSlug } from "@/lib/master-pages/subpages";

export type DeveloperPageContent = {
  /** The one section this document holds, resolved over the code defaults. */
  section: ResolvedSection;
  /** True when nobody has saved it yet — the defaults are what renders. */
  usingDefaults: boolean;
};

/** The `pages.slug` this document lives at. */
export function developerPageCopySlug(): string {
  return subPageSlug("developer", DEVELOPER_PAGE_COPY_KEY);
}

/**
 * The document.
 *
 * @param locale Pass "bilingual" from the CMS editor. Omitted, it resolves
 * from the request — the fold `applyLocale` performs strips every `_ar` key,
 * so an editor handed folded values would render its Arabic inputs blank and
 * write that blank back on the next save.
 */
export async function getDeveloperPageContent(
  locale?: Locale | "bilingual",
): Promise<DeveloperPageContent> {
  const def = developerPageCopyDef();
  const fold = locale ?? (await currentLocale());

  const fallback = (): DeveloperPageContent => ({
    section: resolveSections(def, null, fold)[0]!,
    usingDefaults: true,
  });

  if (!isSupabaseConfigured) return fallback();

  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("pages")
      .select("blocks")
      .eq("slug", developerPageCopySlug())
      .maybeSingle();
    if (error || !data) return fallback();

    const stored = parseStoredSections(data.blocks);
    // No media fields on this section, so `attachImageUrls` has nothing to
    // resolve — deliberately not called.
    return {
      section: resolveSections(def, stored, fold)[0]!,
      usingDefaults: stored === null,
    };
  } catch (error) {
    console.error("[developer-page] failed to load the copy document", error);
    return fallback();
  }
}

/**
 * The strings one developer profile renders, with `{name}` already
 * substituted.
 *
 * Optional fields come back null when an editor cleared them and the page
 * drops the element — a blank crumb or a blank button is a legible editorial
 * choice. The two headings fall back to the shipped wording instead, because
 * an empty `h2` above a grid of cards is a broken page rather than a choice.
 */
export type DeveloperPageCopy = {
  backLabel: string | null;
  projectsHeading: string;
  projectsCtaLabel: string | null;
  projectsCtaHref: string;
  projectsEmpty: string;
  projectsEmptyCtaLabel: string | null;
  projectsEmptyCtaHref: string;
  listingsHeading: string;
  /** Null when the editor cleared the line, or when nothing is truncated. */
  listingsCount: (shown: number, total: number) => string | null;
};

export const getDeveloperPageCopy = cache(
  async (name: string, locale?: Locale): Promise<DeveloperPageCopy> => {
    /*
     * Resolved here rather than left to `getDeveloperPageContent`, because the
     * heading fallbacks below need the SAME fold. Reading the raw `defaults`
     * instead would put the English heading on /ar the one time an editor
     * blanks the field — the exact hole the fallback exists to close.
     */
    const fold = locale ?? (await currentLocale());
    const content = await getDeveloperPageContent(fold);
    const values = content.section.values;
    const shipped = () =>
      resolveSections(developerPageCopyDef(), null, fold)[0]!.values;

    const withName = (key: string, fallbackToShipped = false): string | null => {
      const raw = str(values, key) ?? (fallbackToShipped ? str(shipped(), key) : null);
      return raw === null ? null : fillTokens(raw, { name });
    };

    return {
      backLabel: withName("back_label"),
      projectsHeading: withName("projects_heading", true) ?? "",
      projectsCtaLabel: withName("projects_cta_label"),
      projectsCtaHref: str(values, "projects_cta_href") ?? "/off-plan",
      projectsEmpty: withName("projects_empty", true) ?? "",
      projectsEmptyCtaLabel: withName("projects_empty_cta_label"),
      projectsEmptyCtaHref:
        str(values, "projects_empty_cta_href") ?? "/off-plan",
      listingsHeading: withName("listings_heading", true) ?? "",
      listingsCount: (shown, total) => {
        const raw = str(values, "listings_count");
        return raw === null ? null : fillTokens(raw, { shown, total });
      },
    };
  },
);
