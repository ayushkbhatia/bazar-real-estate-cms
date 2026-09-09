/**
 * Reads for the project-page copy registry
 * (`lib/master-pages/development-page.ts`) — the one document holding the
 * eyebrow, heading and standfirst every `/developments/<slug>` page shares.
 *
 * Same contract as `lib/queries/developer-page.ts`: the cookie-free public
 * client, never throws, and never returns nothing. A document that fails to
 * load renders the copy the page shipped with rather than leaving fourteen
 * bands unlabelled.
 *
 * `cache()` because the project page reads it once for the body and
 * `generateMetadata` is the obvious second caller; without it that is two
 * round-trips per request for one row. Keyed on the fold alone — the tokens
 * differ per project and are substituted after the read, so one query serves
 * every development rendered in a request.
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
  DEVELOPMENT_PAGE_COPY_KEY,
  DEVELOPMENT_PAGE_COPY_NAMESPACE,
  developmentPageCopyDef,
  fillTokens,
  type DevelopmentTokens,
} from "@/lib/master-pages/development-page";
import { SUBPAGE_SLUG_PREFIX } from "@/lib/master-pages/subpages";

export type DevelopmentPageCopyContent = {
  /** Every band in the document, resolved over the code defaults. */
  sections: ResolvedSection[];
  /** True when nobody has saved it yet — the defaults are what renders. */
  usingDefaults: boolean;
};

/**
 * The `pages.slug` this document lives at.
 *
 * A function rather than a re-exported constant, to match
 * `developerPageCopySlug()` — the two are read side by side often enough that
 * one being callable and the other not is a papercut.
 */
export function developmentPageCopySlug(): string {
  return `${SUBPAGE_SLUG_PREFIX}${DEVELOPMENT_PAGE_COPY_NAMESPACE}/${DEVELOPMENT_PAGE_COPY_KEY}`;
}

/**
 * The document.
 *
 * @param locale Pass "bilingual" from the CMS editor. Omitted, it resolves
 * from the request — the fold `applyLocale` performs strips every `_ar` key,
 * so an editor handed folded values would render its Arabic inputs blank and
 * write that blank back on the next save.
 */
export const getDevelopmentPageCopyContent = cache(
  async (
    locale?: Locale | "bilingual",
  ): Promise<DevelopmentPageCopyContent> => {
    const def = developmentPageCopyDef();
    const fold = locale ?? (await currentLocale());

    const fallback = (): DevelopmentPageCopyContent => ({
      sections: resolveSections(def, null, fold),
      usingDefaults: true,
    });

    if (!isSupabaseConfigured) return fallback();

    try {
      const supabase = createSupabasePublicClient();
      const { data, error } = await supabase
        .from("pages")
        .select("blocks")
        .eq("slug", developmentPageCopySlug())
        .maybeSingle();
      if (error || !data) return fallback();

      const stored = parseStoredSections(data.blocks);
      // No media fields in this document, so `attachImageUrls` has nothing to
      // resolve — deliberately not called.
      return {
        sections: resolveSections(def, stored, fold),
        usingDefaults: stored === null,
      };
    } catch (error) {
      console.error("[development-page] failed to load the copy document", error);
      return fallback();
    }
  },
);

/**
 * One project's shared wording, with every token already substituted.
 *
 * Returns a lookup rather than a fixed object because the page reads it the
 * same way it reads its own overrides — `shared("units", "eyebrow")` beside
 * `sv("units", "eyebrow")` — which keeps the resolution order legible at each
 * call site instead of hidden in a mapping table.
 *
 * Never returns null for a field the registry declares: a blank stored value
 * falls back to the shipped wording, because an empty `h2` above a grid of
 * cards is a broken page rather than an editorial choice. Null means the field
 * does not exist, which is a caller bug and is caught by
 * `development-page.test.ts`.
 */
export type DevelopmentPageCopy = (
  sectionKey: string,
  field: string,
) => string | null;

export async function getDevelopmentPageCopy(
  tokens: DevelopmentTokens,
  locale?: Locale,
): Promise<DevelopmentPageCopy> {
  /*
   * Resolved here rather than left to the caller, because the shipped
   * fallback below needs the SAME fold. Reading the raw `defaults` instead
   * would put the English eyebrow on /ar the one time a stored value is blank
   * — the exact hole the fallback exists to close.
   */
  const fold = locale ?? (await currentLocale());
  const content = await getDevelopmentPageCopyContent(fold);
  const stored = new Map(content.sections.map((s) => [s.key, s.values]));

  const shipped = new Map(
    resolveSections(developmentPageCopyDef(), null, fold).map((s) => [
      s.key,
      s.values,
    ]),
  );

  const filled: Record<string, string> = {
    name: tokens.name,
    area: tokens.area,
    developer: tokens.developer,
    plan: tokens.plan,
    available: String(tokens.available),
    total: String(tokens.total),
  };

  return (sectionKey, field) => {
    const values = stored.get(sectionKey);
    const raw =
      (values ? str(values, field) : null) ??
      str(shipped.get(sectionKey) ?? {}, field);
    return raw === null ? null : fillTokens(raw, filled);
  };
}
