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
  str,
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


/* ── flat copy sections ───────────────────────────────────────────────── */

/**
 * A copy-only library section, read as a plain `Record<field, string>`.
 *
 * `resolveSections` has already merged the stored document over the registry
 * defaults and folded the result to one locale, so every key is present and
 * every value is a string — a blank Arabic twin fell back to its English
 * sibling upstream rather than leaving a hole here.
 *
 * Returned as a bag rather than a typed object per section: the field list is
 * declared once in the registry, and a second hand-written interface would be
 * a second place to forget a field.
 */
export type SectionCopy = Record<string, string>;

async function copyFor(
  key: LibrarySectionKey,
  locale?: Locale,
): Promise<SectionCopy> {
  const content = await getLibrarySectionContent(key, locale);
  const def = content.section.def;
  const out: SectionCopy = {};
  for (const field of def.fields) {
    // Falls back to the registry default rather than to "": an editor who
    // clears an optional field should get the shipped wording back, not a
    // gap in the middle of a sentence.
    out[field.key] =
      str(content.section.values, field.key) ||
      String(def.defaults[field.key] ?? "");
  }
  return out;
}

/**
 * The shortlist drawer's copy.
 *
 * `cache()` because the public layout reads it on every page and a landing
 * page could read it again; none of the loaders in this directory is
 * React-cached by default, so a second call is a second round-trip.
 */
export const getShortlistCopy = cache(
  (locale?: Locale): Promise<SectionCopy> => copyFor("shortlist", locale),
);

/** The compare page's copy. Read twice per render — page body and metadata. */
export const getCompareCopy = cache(
  (locale?: Locale): Promise<SectionCopy> => copyFor("compare", locale),
);
