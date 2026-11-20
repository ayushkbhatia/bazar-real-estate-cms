/**
 * Reads for the page-FAQ registry (`lib/master-pages/page-faqs.ts`).
 *
 * Same contract as `lib/queries/search-headers.ts`: the cookie-free public
 * client, never throws, never returns nothing. A document that fails to load
 * resolves to the defaults, which carry no questions, so the page renders
 * without its FAQ rather than erroring. A missing FAQ is a far smaller fault
 * than a guide that 500s.
 */
import { cache } from "react";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { type Locale } from "@/lib/i18n/locales";
import {
  faqPairs,
  parseStoredSections,
  resolveSections,
  str,
  type ResolvedSection,
} from "@/lib/master-pages";
import { getPageFaq, pageFaqPageDef } from "@/lib/master-pages/page-faqs";
import { subPageSlug } from "@/lib/master-pages/subpages";

export type PageFaqContent = {
  /** The one section this document holds, resolved over the code defaults. */
  section: ResolvedSection;
  /** True when nobody has saved it yet: the page shows no FAQ. */
  usingDefaults: boolean;
};

/**
 * One page's FAQ document.
 *
 * @param locale Pass "bilingual" from the CMS editor, so the `_ar` twins stay
 * in `values` (folded, the Arabic inputs would render blank over stored
 * content and the next save would write that blank back).
 */
export async function getPageFaqContent(
  key: string,
  locale?: Locale | "bilingual",
): Promise<PageFaqContent> {
  const entry = getPageFaq(key);
  if (!entry) throw new Error(`Unknown page FAQ: ${key}`);
  const def = pageFaqPageDef(entry);
  const fold = locale ?? (await currentLocale());

  const fallback = (): PageFaqContent => ({
    section: resolveSections(def, null, fold)[0]!,
    usingDefaults: true,
  });

  if (!isSupabaseConfigured) return fallback();

  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("pages")
      .select("blocks")
      .eq("slug", subPageSlug("faq", key))
      .maybeSingle();
    if (error || !data) return fallback();
    const stored = parseStoredSections(data.blocks);
    return {
      section: resolveSections(def, stored, fold)[0]!,
      usingDefaults: stored === null,
    };
  } catch (error) {
    console.error(`[page-faqs] failed to load "${key}"`, error);
    return fallback();
  }
}

export type PageFaqCopy = {
  eyebrow: string | null;
  heading: string | null;
  intro: string | null;
  items: [string, string][];
};

/** What a page renders: the questions in the request's language. */
export const getPageFaqCopy = cache(
  async (key: string, locale?: Locale): Promise<PageFaqCopy> => {
    const content = await getPageFaqContent(key, locale ?? (await currentLocale()));
    const v = content.section.values;
    return {
      eyebrow: str(v, "eyebrow"),
      heading: str(v, "heading"),
      intro: str(v, "intro"),
      items: content.section.enabled ? faqPairs(v) : [],
    };
  },
);
