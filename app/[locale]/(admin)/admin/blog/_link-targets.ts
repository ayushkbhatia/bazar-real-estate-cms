import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { listPublishedDevelopments } from "@/lib/queries/developments";
import { listPropertyOptions } from "@/lib/queries/featured-properties";
import { allRows } from "@/lib/salesforce/listings/paginate";
import { areaPath, type InternalLinkKind } from "@/lib/internal-links/model";
import { developmentSeedItem, propertySeedItem } from "../_fields/record-seeds";
import type { SeedItem } from "../_fields/types";

/**
 * One record the internal-link picker offers: the shared picker option
 * (`SeedItem`, drawn by `OptionBody`) plus what a link stores — its kind and
 * its id.
 *
 * Built with the same shapers as the page builder's and the home page's
 * listing pickers (`../_fields/record-seeds.ts`), so a listing is described
 * the same way in every editor — which matters here for the same reason it
 * did there: three live listings are all titled "Yas Riva Reserve", and only
 * the reference, the facts and the price tell them apart.
 */
export type InternalLinkTarget = SeedItem & {
  kind: InternalLinkKind;
  id: string;
};

/**
 * Everything the picker offers, English, in one load.
 *
 * Exactly what the public site can show: the same readers the public pages
 * use for projects and listings, and the guide-bearing area kinds — an
 * emirate or a single building has no page worth sending a reader to. So a
 * block can never be pointed at a record whose card would then draw nothing.
 *
 * Searched in the browser. ~130 rows today; past a few thousand listings the
 * Listings tab wants a server-side search — see docs/FOLLOWUPS.md.
 */
export async function listInternalLinkTargets(): Promise<InternalLinkTarget[]> {
  const [areas, developments, properties] = await Promise.all([
    listAreaTargets(),
    listPublishedDevelopments(),
    // Supabase answers at most 1,000 rows however many are asked for; the
    // pickers elsewhere ask for 200.
    listPropertyOptions(1000),
  ]);

  const byName = (a: InternalLinkTarget, b: InternalLinkTarget) =>
    a.name.localeCompare(b.name);

  return [
    ...areas.sort(byName),
    ...developments
      .map((d) => ({
        ...developmentSeedItem(d),
        kind: "development" as const,
        id: d.id.toLowerCase(),
      }))
      .sort(byName),
    // Same-titled listings sort together, newest first within a title, so
    // the facts that tell them apart can be read side by side.
    ...properties
      .map((p) => ({
        ...propertySeedItem(p),
        kind: "property" as const,
        id: p.id.toLowerCase(),
      }))
      .sort(byName),
  ];
}

type Row = Record<string, unknown>;

async function listAreaTargets(): Promise<InternalLinkTarget[]> {
  if (!isSupabaseConfigured) return [];
  const sb = createSupabasePublicClient();
  const rows = await allRows<Row>(
    (from, to) =>
      sb
        .from("areas")
        .select(
          "id, slug, name, kind, hero:hero_image_id(storage_key, deleted_at), parent:parent_id(name, hero:hero_image_id(storage_key, deleted_at))",
        )
        .in("kind", ["area", "sub_community"])
        .order("id")
        .range(from, to) as unknown as PromiseLike<{
        data: Row[] | null;
        error: { message: string } | null;
      }>,
  );
  return rows.map(areaTarget);
}

function joined(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : null;
}

function photo(media: unknown): string | null {
  const m = joined(media);
  const key = typeof m?.storage_key === "string" ? m.storage_key : null;
  if (!key || m?.deleted_at) return null;
  return mediaPublicUrl(key) || null;
}

/** An area as the picker shows it. Exported for its spec. */
export function areaTarget(row: Row): InternalLinkTarget {
  const slug = String(row.slug);
  const href = areaPath(slug);
  const parent = joined(row.parent);
  const parentName =
    typeof parent?.name === "string" && parent.name.trim() ? parent.name : null;
  const name =
    typeof row.name === "string" && row.name.trim() ? row.name.trim() : slug;
  return {
    kind: "area",
    id: String(row.id).toLowerCase(),
    name,
    href,
    slug,
    detail: {
      // The photograph the public card will show: a community rarely has
      // one of its own, so it borrows its parent's, as the card does.
      thumb: photo(row.hero) ?? photo(parent?.hero),
      code: null,
      sub: [
        row.kind === "sub_community" ? "Community" : "Area",
        parentName,
      ]
        .filter(Boolean)
        .join(" · "),
      facts: [],
      price: null,
      badge: null,
      href,
    },
  };
}
