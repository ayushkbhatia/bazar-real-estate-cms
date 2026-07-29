import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { attachImageUrls } from "@/lib/queries/section-images";
import {
  parseStoredSections,
  resolveSections,
  type ResolvedSection,
} from "@/lib/master-pages";
import {
  areaPageDef,
  developmentPageDef,
  subPageSlug,
  type SubPageKind,
} from "@/lib/master-pages/subpages";

export type SubPageContent = {
  sections: ResolvedSection[];
  section: (key: string) => ResolvedSection | null;
  /** Section keys that should render, in the editor's order. */
  enabled: Set<string>;
  order: string[];
  isOn: (key: string) => boolean;
  usingDefaults: boolean;
};

function build(
  sections: ResolvedSection[],
  usingDefaults: boolean,
): SubPageContent {
  const byKey = new Map(sections.map((s) => [s.key, s]));
  const enabled = new Set(sections.filter((s) => s.enabled).map((s) => s.key));
  return {
    sections,
    section: (key) => byKey.get(key) ?? null,
    enabled,
    order: sections.filter((s) => s.enabled).map((s) => s.key),
    // A section the document has never heard of renders — new template
    // sections shouldn't need a save before they appear.
    isOn: (key) => (byKey.has(key) ? enabled.has(key) : true),
    usingDefaults,
  };
}

/**
 * Section document for one development page. Cookie-free client, like the
 * master pages: `/developments/[slug]` is public content and reading cookies
 * would drop it out of ISR.
 */
export async function getDevelopmentPageContent(record: {
  name: string;
  slug: string;
}): Promise<SubPageContent> {
  const def = developmentPageDef(record);
  if (!isSupabaseConfigured) return build(resolveSections(def, null), true);

  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("pages")
      .select("blocks")
      .eq("slug", subPageSlug("development", record.slug))
      .maybeSingle();
    if (error || !data) return build(resolveSections(def, null), true);

    const stored = parseStoredSections(data.blocks);
    const sections = resolveSections(def, stored);
    // Without this every picked image resolves to a null URL and the section
    // silently falls back to its record media — which is what made the
    // renders gallery look dormant after an upload.
    await attachImageUrls(sections);
    return build(sections, stored === null);
  } catch (error) {
    console.error(`[subpages] failed to load "${record.slug}"`, error);
    return build(resolveSections(def, null), true);
  }
}

/**
 * Section document for one area guide. Same contract as the development
 * variant — cookie-free read, defaults when there's nothing stored.
 */
export async function getAreaPageContent(record: {
  name: string;
  slug: string;
}): Promise<SubPageContent> {
  const def = areaPageDef(record);
  if (!isSupabaseConfigured) return build(resolveSections(def, null), true);

  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("pages")
      .select("blocks")
      .eq("slug", subPageSlug("area", record.slug))
      .maybeSingle();
    if (error || !data) return build(resolveSections(def, null), true);

    const stored = parseStoredSections(data.blocks);
    const sections = resolveSections(def, stored);
    await attachImageUrls(sections);
    return build(sections, stored === null);
  } catch (error) {
    console.error(`[subpages] failed to load area "${record.slug}"`, error);
    return build(resolveSections(def, null), true);
  }
}

export type AreaSubPageRow = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  parent_id: string | null;
  hero_image_id: string | null;
  edited: boolean;
};

/** Admin: every area that has (or could have) a guide page. */
export async function listAreaSubPages(): Promise<AreaSubPageRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();

  const [{ data: rows }, { data: pages }] = await Promise.all([
    supabase
      .from("areas")
      .select("id, name, slug, kind, parent_id, hero_image_id")
      .order("name", { ascending: true }),
    supabase
      .from("pages")
      .select("slug")
      .like("slug", `${subPageSlug("area", "")}%`),
  ]);

  const editedSlugs = new Set(
    (pages ?? []).map((p) => p.slug.split("/").slice(2).join("/")),
  );

  return (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    kind: r.kind,
    parent_id: r.parent_id,
    hero_image_id: r.hero_image_id,
    edited: editedSlugs.has(r.slug),
  }));
}

/** Admin: every development that has (or could have) a sub-page. */
export type SubPageRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  published_at: string | null;
  hero_image_id: string | null;
  developer: string | null;
  area: string | null;
  handover_date: string | null;
  total_units: number | null;
  starting_price: number | null;
  /** Whether a section document has been saved for it. */
  edited: boolean;
};

export async function listDevelopmentSubPages(
  kind: SubPageKind = "development",
): Promise<SubPageRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();

  const [{ data: rows }, { data: pages }] = await Promise.all([
    supabase
      .from("developments")
      .select(
        "id, name, slug, status, published_at, hero_image_id, handover_date, total_units, starting_price, developers:developer_id(name), areas:area_id(name)",
      )
      .order("name", { ascending: true }),
    supabase
      .from("pages")
      .select("slug")
      .like("slug", `${subPageSlug(kind, "")}%`),
  ]);

  const editedSlugs = new Set(
    (pages ?? []).map((p) => p.slug.split("/").slice(2).join("/")),
  );

  type Row = {
    id: string;
    name: string;
    slug: string;
    status: string;
    published_at: string | null;
    hero_image_id: string | null;
    handover_date: string | null;
    total_units: number | null;
    starting_price: number | null;
    developers: { name: string } | null;
    areas: { name: string } | null;
  };

  return ((rows ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    status: r.status,
    published_at: r.published_at,
    hero_image_id: r.hero_image_id,
    developer: r.developers?.name ?? null,
    area: r.areas?.name ?? null,
    handover_date: r.handover_date,
    total_units: r.total_units,
    starting_price: r.starting_price,
    edited: editedSlugs.has(r.slug),
  }));
}

/**
 * How many records back each sub-page kind — the count on the Pages index
 * blocks. One query per kind; there is one kind today.
 */
export async function countSubPagesByKind(): Promise<
  Partial<Record<SubPageKind, number>>
> {
  if (!isSupabaseConfigured) return {};
  const supabase = createSupabasePublicClient();
  const [developments, areas] = await Promise.all([
    supabase.from("developments").select("id", { count: "exact", head: true }),
    supabase.from("areas").select("id", { count: "exact", head: true }),
  ]);
  return {
    development: developments.count ?? 0,
    area: areas.count ?? 0,
  };
}

/**
 * Cover image for an area guide. Stored as `areas.hero_image_id` and resolved
 * to a public URL here, so the page doesn't have to know about storage keys.
 * Returns null when nothing is set — the page then draws its placeholder.
 */
export async function getAreaHeroImage(
  slug: string,
): Promise<{ url: string; alt: string | null } | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("areas")
      .select("hero:hero_image_id(storage_key, alt_text, deleted_at)")
      .eq("slug", slug)
      .maybeSingle();
    const hero = (
      data as {
        hero: {
          storage_key: string;
          alt_text: string | null;
          deleted_at: string | null;
        } | null;
      } | null
    )?.hero;
    // A trashed asset falls back to the placeholder rather than 404-ing.
    if (!hero || hero.deleted_at) return null;
    return { url: mediaPublicUrl(hero.storage_key), alt: hero.alt_text };
  } catch (error) {
    console.error(`[subpages] area hero lookup failed for "${slug}"`, error);
    return null;
  }
}
