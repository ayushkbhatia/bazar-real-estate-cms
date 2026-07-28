import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import {
  getMasterPage,
  masterSlug,
  parseStoredSections,
  resolveSections,
  type ImageValue,
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
/**
 * Turn every `media_id` in the resolved sections into a public URL. One query
 * for the whole page, walking both scalar image fields and image fields inside
 * list items.
 */
async function attachImageUrls(sections: ResolvedSection[]): Promise<void> {
  const images: ImageValue[] = [];
  const collect = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    const v = value as Record<string, unknown>;
    if ("media_id" in v) {
      images.push(v as ImageValue);
      return;
    }
    Object.values(v).forEach(collect);
  };
  for (const section of sections) Object.values(section.values).forEach(collect);

  const ids = [...new Set(images.map((i) => i.media_id).filter(Boolean))];
  if (ids.length === 0) return;

  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("media_assets")
      .select("id, storage_key")
      .in("id", ids as string[])
      .is("deleted_at", null);
    const keyById = new Map((data ?? []).map((m) => [m.id, m.storage_key]));
    for (const image of images) {
      const key = image.media_id ? keyById.get(image.media_id) : null;
      // A trashed or deleted asset falls back to the placeholder rather than
      // rendering a broken image.
      image.url = key ? mediaPublicUrl(key) : null;
    }
  } catch (error) {
    console.error("[master-pages] failed to resolve image urls", error);
  }
}

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
