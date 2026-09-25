/**
 * Reads for the property-page copy registry
 * (`lib/master-pages/property-page.ts`) — the one document holding the
 * eyebrows, enquiry wording and shared questions every `/p/<slug>` listing
 * carries.
 *
 * Same contract as `lib/queries/development-page.ts`: the cookie-free public
 * client, never throws, and never returns nothing. A document that fails to
 * load renders the copy the page shipped with rather than leaving the listing
 * page's bands unlabelled.
 *
 * `cache()` because the listing page is the busiest template on the site and
 * a request can render more than one caller of this; keyed on the fold alone,
 * so the tokens — which differ per listing — are substituted after the read
 * and one query serves every listing rendered in a request.
 */
import { cache } from "react";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { isolateForLocale } from "@/lib/i18n/bidi";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import {
  list,
  parseStoredSections,
  resolveSections,
  str,
  type ResolvedSection,
  type SectionValues,
} from "@/lib/master-pages";
import {
  PROPERTY_PAGE_COPY_KEY,
  fillTokens,
  propertyPageCopyDef,
  type PropertyTokens,
} from "@/lib/master-pages/property-page";
import { subPageSlug } from "@/lib/master-pages/subpages";

export type PropertyPageCopyContent = {
  /** Every band in the document, resolved over the code defaults. */
  sections: ResolvedSection[];
  /** True when nobody has saved it yet — the defaults are what renders. */
  usingDefaults: boolean;
};

/** The `pages.slug` this document lives at. */
export function propertyPageCopySlug(): string {
  return subPageSlug("property", PROPERTY_PAGE_COPY_KEY);
}

/**
 * The document.
 *
 * @param locale Pass "bilingual" from the CMS editor, which needs both sides;
 * the fold `applyLocale` performs strips every `_ar` key, so an editor handed
 * folded values would render its Arabic inputs blank and write that blank
 * back on the next save.
 *
 * Required rather than read from the request: the listing page is prerendered,
 * and an ambient locale read there goes through `headers()` and takes the
 * route off static rendering.
 */
export const getPropertyPageCopyContent = cache(
  async (locale: Locale | "bilingual"): Promise<PropertyPageCopyContent> => {
    const def = propertyPageCopyDef();

    const fallback = (): PropertyPageCopyContent => ({
      sections: resolveSections(def, null, locale),
      usingDefaults: true,
    });

    if (!isSupabaseConfigured) return fallback();

    try {
      const supabase = createSupabasePublicClient();
      const { data, error } = await supabase
        .from("pages")
        .select("blocks")
        .eq("slug", propertyPageCopySlug())
        .maybeSingle();
      if (error || !data) return fallback();

      const stored = parseStoredSections(data.blocks);
      // No media fields in this document, so `attachImageUrls` has nothing to
      // resolve — deliberately not called.
      return {
        sections: resolveSections(def, stored, locale),
        usingDefaults: stored === null,
      };
    } catch (error) {
      console.error("[property-page] failed to load the copy document", error);
      return fallback();
    }
  },
);

/** One question and its answer, tokens substituted. */
export type PropertyFaqItem = { q: string; a: string };

/**
 * One listing's shared wording.
 *
 * `text` is a lookup rather than a fixed object for the reason
 * `getDevelopmentPageCopy` gives: each call site names the band and the field
 * it reads, which keeps the page legible. It never returns blank for a field
 * the registry declares — a blank stored value falls back to the shipped
 * wording, because an empty eyebrow above a band is a broken page rather than
 * an editorial choice — and it returns "" for a field that does not exist,
 * which `property-page.test.ts` rules out for every call the page makes.
 *
 * `template` is the same lookup with the tokens left in, for the two places
 * that draw the reference in its own `.mono` span rather than as text. They
 * must fill every OTHER token from `tokens`: an editor may type any of the
 * five into any field — the Cards screen and the Property pages screen both
 * say so — and a template drawn with only `{reference}` supplied put
 * "Ask anything about {title}." on every listing.
 */
export type PropertyPageCopy = {
  text: (
    sectionKey: string,
    field: string,
    overrides?: Partial<PropertyTokens>,
  ) => string;
  template: (sectionKey: string, field: string) => string;
  /** Every token, filled and isolated exactly as `text` fills it. */
  tokens: PropertyTokens;
  faq: PropertyFaqItem[];
};

export async function getPropertyPageCopy(
  tokens: PropertyTokens,
  locale: Locale = DEFAULT_LOCALE,
): Promise<PropertyPageCopy> {
  const content = await getPropertyPageCopyContent(locale);
  const stored = new Map(content.sections.map((s) => [s.key, s.values]));
  /*
   * Resolved with the SAME fold. Reading the raw `defaults` instead would put
   * the English eyebrow on /ar the one time a stored value is blank — the
   * exact hole the fallback exists to close.
   */
  const shipped = new Map(
    resolveSections(propertyPageCopyDef(), null, locale).map((s) => [
      s.key,
      s.values,
    ]),
  );

  /*
   * Every token is a Latin code or a name that may arrive in either script,
   * dropped into a sentence in the other. Isolated so `BAZ-AD-09790` does not
   * render as `09790-BAZ-AD` inside Arabic — see `lib/i18n/bidi.ts`. Under
   * English the helper is the identity, so /en is byte-identical.
   */
  const isolate = <T extends Partial<PropertyTokens>>(values: T) =>
    Object.fromEntries(
      Object.entries(values).map(([k, v]) => [
        k,
        isolateForLocale(v ?? "", locale),
      ]),
    ) as { [K in keyof T]: string };
  const filled: PropertyTokens = isolate(tokens);

  const template = (sectionKey: string, field: string): string => {
    const values = stored.get(sectionKey);
    return (
      (values ? str(values, field) : null) ??
      str(shipped.get(sectionKey) ?? {}, field) ??
      ""
    );
  };

  return {
    template,
    tokens: filled,
    text: (sectionKey, field, overrides) =>
      fillTokens(template(sectionKey, field), {
        ...filled,
        ...(overrides ? isolate(overrides) : {}),
      }),
    faq: faqItems(stored.get("faq") ?? {}).map(({ q, a }) => ({
      q: fillTokens(q, filled),
      a: fillTokens(a, filled),
    })),
  };
}

/**
 * The shared questions, in the editor's order.
 *
 * Not defaulted from `shipped` when the stored list is empty: an editor who
 * deleted every question meant it, and the four written from the listing's
 * facts still render. An item missing its answer is dropped rather than drawn
 * as a question that opens onto nothing.
 */
function faqItems(values: SectionValues): PropertyFaqItem[] {
  return list<{ q?: string | null; a?: string | null }>(values, "items")
    .map((item) => ({ q: item.q?.trim() ?? "", a: item.a?.trim() ?? "" }))
    .filter((item) => item.q !== "" && item.a !== "");
}
