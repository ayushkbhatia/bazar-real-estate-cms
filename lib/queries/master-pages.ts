import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { attachImageUrls } from "@/lib/queries/section-images";
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
): Promise<MasterPageContent> {
  const def = getMasterPage(key);
  if (!def) throw new Error(`Unknown master page: ${key}`);
  if (!isSupabaseConfigured) return build(resolveSections(def, null), true);

  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("pages")
      .select("blocks")
      .eq("slug", masterSlug(key))
      .maybeSingle();
    if (error || !data) return build(resolveSections(def, null), true);

    const stored = parseStoredSections(data.blocks);
    const sections = resolveSections(def, stored);
    await attachImageUrls(sections);
    return build(sections, stored === null);
  } catch (error) {
    console.error(`[master-pages] failed to load "${key}"`, error);
    return build(resolveSections(def, null), true);
  }
}
