/**
 * Reads for the section library (`lib/master-pages/library.ts`).
 *
 * Same contract as `lib/queries/master-pages.ts` and `lib/queries/subpages.ts`,
 * and for the same reasons: the cookie-free public client, because a library
 * section renders on `/` and on `/lp/*` and touching `cookies()` would drop
 * both out of ISR; never throws and never returns nothing, because a section
 * that fails to load must render the copy it shipped with rather than a hole.
 *
 * `cache()` is not decoration here. Two callers on one page is the normal case
 * once a landing page places the block and something else reads the same
 * document, and none of the loaders in this directory is React-cached — a
 * second call really is a second round-trip.
 */
import { cache } from "react";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { type Locale } from "@/lib/i18n/locales";
import { attachImageUrls } from "@/lib/queries/section-images";
import {
  parseStoredSections,
  resolveSections,
  type ResolvedSection,
} from "@/lib/master-pages";
import {
  getLibrarySection,
  librarySectionPageDef,
  testimonialsFrom,
  type LibrarySectionKey,
} from "@/lib/master-pages/library";
import { subPageSlug } from "@/lib/master-pages/subpages";
import type { Testimonial } from "@/lib/seeds/awards";

export type LibrarySectionContent = {
  /** The one section this document holds, resolved over the code defaults. */
  section: ResolvedSection;
  /** True when nobody has saved it yet — the defaults are what renders. */
  usingDefaults: boolean;
};

/**
 * One library section's document.
 *
 * @param locale Pass "bilingual" from the CMS editor. Omitted, it resolves from
 * the request — the fold that `applyLocale` performs strips every `_ar` key, so
 * an editor given the folded values would render its Arabic inputs blank and
 * write that blank back on save.
 */
export async function getLibrarySectionContent(
  key: LibrarySectionKey,
  locale?: Locale | "bilingual",
): Promise<LibrarySectionContent> {
  const entry = getLibrarySection(key);
  if (!entry) throw new Error(`Unknown library section: ${key}`);
  const def = librarySectionPageDef(entry);
  const fold = locale ?? (await currentLocale());

  const fallback = (): LibrarySectionContent => ({
    section: resolveSections(def, null, fold)[0]!,
    usingDefaults: true,
  });

  if (!isSupabaseConfigured) return fallback();

  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("pages")
      .select("blocks")
      .eq("slug", subPageSlug("section", key))
      .maybeSingle();
    if (error || !data) return fallback();

    const stored = parseStoredSections(data.blocks);
    const sections = resolveSections(def, stored, fold);
    await attachImageUrls(sections);
    return { section: sections[0]!, usingDefaults: stored === null };
  } catch (error) {
    console.error(`[library] failed to load section "${key}"`, error);
    return fallback();
  }
}

/**
 * The client reviews, in the request's language.
 *
 * The one function every public surface calls. `limit` slices *after* the
 * switched-off reviews are dropped, so an editor resting one card promotes the
 * next rather than leaving a gap.
 */
export const getTestimonials = cache(
  async (limit?: number, locale?: Locale): Promise<Testimonial[]> => {
    const content = await getLibrarySectionContent("testimonials", locale);
    return testimonialsFrom(content.section.values, limit);
  },
);
