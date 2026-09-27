/**
 * Reads for advisor profile pages — the one document every `/agents/<slug>`
 * shares (`lib/master-pages/agent-page.ts`), and the resolver that lays one
 * advisor's own overrides over it.
 *
 * Same contract as `lib/queries/development-page.ts`: the cookie-free public
 * client, never throws, and never returns nothing. A document that fails to
 * load renders the copy the page shipped with rather than leaving a profile's
 * bands unlabelled.
 *
 * `cache()` because the profile reads the shared document for the body and
 * again for `generateMetadata`; keyed on the fold alone, so the tokens — which
 * differ per advisor — are substituted after the read.
 */
import { cache } from "react";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { isolateForLocale } from "@/lib/i18n/bidi";
import { type Locale } from "@/lib/i18n/locales";
import {
  parseStoredSections,
  resolveSections,
  str,
  type ResolvedSection,
  type SectionValues,
} from "@/lib/master-pages";
import {
  AGENT_PAGE_COPY_KEY,
  AGENT_PAGE_COPY_NAMESPACE,
  agentPageCopyDef,
  fillTokens,
  type AgentTokens,
} from "@/lib/master-pages/agent-page";
import { SUBPAGE_SLUG_PREFIX } from "@/lib/master-pages/subpages";

export type AgentPageCopyContent = {
  /** Every band in the document, resolved over the code defaults. */
  sections: ResolvedSection[];
  /** True when nobody has saved it yet — the defaults are what renders. */
  usingDefaults: boolean;
};

/** The `pages.slug` the shared document lives at. */
export function agentPageCopySlug(): string {
  return `${SUBPAGE_SLUG_PREFIX}${AGENT_PAGE_COPY_NAMESPACE}/${AGENT_PAGE_COPY_KEY}`;
}

/**
 * The shared document.
 *
 * @param locale Pass "bilingual" from the CMS editor. Omitted, it resolves
 * from the request — the fold `applyLocale` performs strips every `_ar` key,
 * so an editor handed folded values would render its Arabic inputs blank and
 * write that blank back on the next save.
 */
export const getAgentPageCopyContent = cache(
  async (locale?: Locale | "bilingual"): Promise<AgentPageCopyContent> => {
    const def = agentPageCopyDef();
    const fold = locale ?? (await currentLocale());

    const fallback = (): AgentPageCopyContent => ({
      sections: resolveSections(def, null, fold),
      usingDefaults: true,
    });

    if (!isSupabaseConfigured) return fallback();

    try {
      const supabase = createSupabasePublicClient();
      const { data, error } = await supabase
        .from("pages")
        .select("blocks")
        .eq("slug", agentPageCopySlug())
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
      console.error("[agent-page] failed to load the copy document", error);
      return fallback();
    }
  },
);

/**
 * One advisor's wording, every token already substituted.
 *
 * A lookup rather than a fixed object, like `getDevelopmentPageCopy`, so each
 * call site names the band and the field it reads.
 *
 * Resolution per field: this advisor's own override, then the shared
 * document, then the shipped wording. It never returns blank for a field the
 * shared document declares — a blank stored value falls back to the shipped
 * wording, because an empty heading above a band is a broken page rather than
 * an editorial choice — and it returns "" for a field that does not exist,
 * which `agent-page.test.ts` rules out for every call the profile makes.
 */
export type AgentPageCopy = (sectionKey: string, field: string) => string;

/**
 * The advisor's first name, for `{first_name}`.
 *
 * The first whitespace-delimited word. That is wrong often enough in this
 * market — Arabic names carry `بن` and `عبد` compounds — that it lives in one
 * place, so fixing it is one edit. It is also why the token exists: an editor
 * who finds it wrong for one advisor can write that advisor's name out in
 * their own document instead.
 */
export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

/** The two token values for one advisor, from their display name. */
export function agentTokens(displayName: string): AgentTokens {
  return { name: displayName, first_name: firstName(displayName) };
}

export async function getAgentPageCopy(
  tokens: AgentTokens,
  locale: Locale,
  /**
   * The advisor's own document, already folded to `locale` — the `sections`
   * of `getAgentPageContent`. Omit for the shared wording alone.
   */
  own: ResolvedSection[] | null = null,
): Promise<AgentPageCopy> {
  const content = await getAgentPageCopyContent(locale);
  const shared = new Map(content.sections.map((s) => [s.key, s.values]));
  const overrides = new Map((own ?? []).map((s) => [s.key, s.values]));
  /*
   * Resolved with the SAME fold. Reading the raw `defaults` instead would put
   * the English heading on /ar the one time a stored value is blank — the
   * exact hole the fallback exists to close.
   */
  const shipped = new Map(
    resolveSections(agentPageCopyDef(), null, locale).map((s) => [
      s.key,
      s.values,
    ]),
  );

  /*
   * Both tokens are a person's name, and a person's name is the one value on
   * this page that routinely arrives in the other script: an advisor whose
   * `display_name_ar` is unwritten folds to Latin, and unisolated it reorders
   * around the punctuation of the Arabic sentence it was dropped into. Under
   * English the helper is the identity, so /en is byte-identical.
   */
  const filled: Record<string, string> = {
    name: isolateForLocale(tokens.name, locale),
    first_name: isolateForLocale(tokens.first_name, locale),
  };

  const pick = (values: SectionValues | undefined, field: string) =>
    values ? str(values, field) : null;

  return (sectionKey, field) => {
    const raw =
      pick(overrides.get(sectionKey), field) ??
      pick(shared.get(sectionKey), field) ??
      pick(shipped.get(sectionKey), field);
    return raw === null ? "" : fillTokens(raw, filled);
  };
}
