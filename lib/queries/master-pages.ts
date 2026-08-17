import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { attachImageUrls } from "@/lib/queries/section-images";
import { currentLocale } from "@/lib/i18n/current";
import {
  getMasterPage,
  masterSlug,
  parseStoredSections,
  resolveSections,
  type MasterPageKey,
  type ResolvedSection,
} from "@/lib/master-pages";

export type MasterPageContent = {
  sections: ResolvedSection[];
  /** Lookup by section key — what page components actually use. */
  section: (key: string) => ResolvedSection | null;
  /** Ordered, enabled section keys — what drives the render order. */
  order: string[];
  /** True when the page has never been saved (rendering pure defaults). */
  usingDefaults: boolean;
};

function build(
  sections: ResolvedSection[],
  usingDefaults: boolean,
): MasterPageContent {
  const byKey = new Map(sections.map((s) => [s.key, s]));
  return {
    sections,
    section: (key) => byKey.get(key) ?? null,
    order: sections.filter((s) => s.enabled).map((s) => s.key),
    usingDefaults,
  };
}

/**
 * Reads go through the cookie-free public client on purpose: master pages are
 * public content, and touching `cookies()` would push the home page out of ISR
 * into fully dynamic rendering.
 *
 * Content for one master page: the stored arrangement merged over the code
 * defaults. Never throws and never returns nothing — if Supabase is down or
 * the row doesn't exist yet, the page renders exactly what it rendered before
 * any of this existed.
 */
export async function getMasterPageContent(
  key: MasterPageKey,
  /**
   * Which language to fold the stored document down to.
   *
   * The ADMIN editor must pass "bilingual", or `resolveSections` collapses the
   * `_ar` twins away and every Arabic input renders empty over stored content
   * — the editor would then save that blank back and destroy it.
   *
   * Omitted, it resolves from the request rather than defaulting to English.
   *
   * It used to default to `DEFAULT_LOCALE`, with the reasoning that this "keeps
   * every existing caller on English" — correct while Arabic was not served,
   * and the single thing standing between a fully translated store and a
   * fully English `/ar` once it was. Seventeen of the eighteen public callers
   * never passed a locale, so every master page rendered English under
   * `lang="ar"` in an RTL layout: the exact failure `lib/i18n/current.ts`
   * describes, where "the page looks finished, nothing errors, and the only
   * people who would notice are the ones who cannot read the English".
   *
   * `currentLocale()` is safe to prerender through — `setRequestLocale` runs in
   * `app/[locale]/layout.tsx` above every public route, so `getLocale()`
   * resolves without touching `headers()`, and `check:routes` proves the 78
   * baseline routes stay static.
   */
  locale?: Locale | "bilingual",
): Promise<MasterPageContent> {
  const def = getMasterPage(key);
  if (!def) throw new Error(`Unknown master page: ${key}`);
  const resolved = locale ?? (await currentLocale());
  if (!isSupabaseConfigured)
    return build(resolveSections(def, null, resolved), true);

  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("pages")
      .select("blocks")
      .eq("slug", masterSlug(key))
      .maybeSingle();
    if (error || !data) return build(resolveSections(def, null, resolved), true);

    const stored = parseStoredSections(data.blocks);
    const sections = resolveSections(def, stored, resolved);
    await attachImageUrls(sections);
    return build(sections, stored === null);
  } catch (error) {
    console.error(`[master-pages] failed to load "${key}"`, error);
    return build(resolveSections(def, null, resolved), true);
  }
}
