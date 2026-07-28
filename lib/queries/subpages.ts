import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import {
  parseStoredSections,
  resolveSections,
  type ResolvedSection,
} from "@/lib/master-pages";
import {
  developmentPageDef,
  subPageSlug,
  type SubPageKind,
} from "@/lib/master-pages/subpages";

export type SubPageContent = {
  sections: ResolvedSection[];
  section: (key: string) => ResolvedSection | null;
  /** Section keys that should render, in template order. */
  enabled: Set<string>;
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
    return build(resolveSections(def, stored), stored === null);
  } catch (error) {
    console.error(`[subpages] failed to load "${record.slug}"`, error);
    return build(resolveSections(def, null), true);
  }
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
        "id, name, slug, status, published_at, hero_image_id, developers:developer_id(name)",
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
    developers: { name: string } | null;
  };

  return ((rows ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    status: r.status,
    published_at: r.published_at,
    hero_image_id: r.hero_image_id,
    developer: r.developers?.name ?? null,
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
  const { count } = await supabase
    .from("developments")
    .select("id", { count: "exact", head: true });
  return { development: count ?? 0 };
}
