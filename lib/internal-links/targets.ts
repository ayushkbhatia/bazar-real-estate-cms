import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { developmentUrl } from "@/lib/queries/development-utils";
import { formatPriceAED, propertyUrl } from "@/lib/queries/property-utils";
import { allRows } from "@/lib/salesforce/listings/paginate";
import { areaPath } from "./model";
import type { InternalLinkTarget } from "./types";

type Row = Record<string, unknown>;

/**
 * Everything the blog editor's link picker offers, English, in one load.
 *
 * Exactly what the public site can show — the anon client and the same
 * publication filters `resolve.ts` applies — so a block can never be pointed
 * at a record whose card would then silently draw nothing. Areas are the
 * guide-bearing kinds only: an emirate or a single building has no page worth
 * sending a reader to.
 *
 * All of it is loaded and searched in the browser. Today that is ~130 rows
 * (26 areas, 28 projects, 74 listings); if the catalogue passes a few
 * thousand, the listings tab wants a server-side search instead — see
 * docs/FOLLOWUPS.md. Paginated regardless, because Supabase truncates an
 * unpaginated select at 1,000 rows without saying so.
 */
export async function listInternalLinkTargets(): Promise<InternalLinkTarget[]> {
  if (!isSupabaseConfigured) return [];
  const sb = createSupabasePublicClient();

  const [areas, developments, properties] = await Promise.all([
    allRows<Row>((from, to) =>
      sb
        .from("areas")
        .select(
          "id, slug, name, kind, parent:parent_id(name), hero:hero_image_id(storage_key, deleted_at)",
        )
        .in("kind", ["area", "sub_community"])
        .order("id")
        .range(from, to) as unknown as PromiseLike<{
        data: Row[] | null;
        error: { message: string } | null;
      }>,
    ),
    allRows<Row>((from, to) =>
      sb
        .from("developments")
        .select(
          "id, slug, name, developers:developer_id(name), areas:area_id(name), hero:hero_image_id(storage_key, deleted_at)",
        )
        .not("published_at", "is", null)
        .order("id")
        .range(from, to) as unknown as PromiseLike<{
        data: Row[] | null;
        error: { message: string } | null;
      }>,
    ),
    allRows<Row>((from, to) =>
      sb
        .from("properties")
        .select(
          "id, reference, slug, title, price_aed, areas:area_id(name), property_media(role, media:media_assets(storage_key, deleted_at))",
        )
        .eq("status", "published")
        .is("deleted_at", null)
        .order("id")
        .range(from, to) as unknown as PromiseLike<{
        data: Row[] | null;
        error: { message: string } | null;
      }>,
    ),
  ]);

  const byName = (a: InternalLinkTarget, b: InternalLinkTarget) =>
    a.name.localeCompare(b.name);

  return [
    ...areas.map(areaTarget).sort(byName),
    ...developments.map(developmentTarget).sort(byName),
    ...properties.map(propertyTarget).sort(byName),
  ];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function joined(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : null;
}

function thumb(media: unknown): string | null {
  const m = joined(media);
  const key = text(m?.storage_key);
  if (!key || m?.deleted_at) return null;
  return mediaPublicUrl(key) || null;
}

const detail = (...parts: (string | null)[]) =>
  parts.filter((p): p is string => Boolean(p)).join(" · ");

export function areaTarget(row: Row): InternalLinkTarget {
  const slug = String(row.slug);
  return {
    kind: "area",
    id: String(row.id).toLowerCase(),
    name: text(row.name) ?? slug,
    detail: detail(
      row.kind === "sub_community" ? "Sub-community" : "Area",
      text(joined(row.parent)?.name),
    ),
    href: areaPath(slug),
    thumb: thumb(row.hero),
  };
}

export function developmentTarget(row: Row): InternalLinkTarget {
  const slug = String(row.slug);
  return {
    kind: "development",
    id: String(row.id).toLowerCase(),
    name: text(row.name) ?? slug,
    detail: detail(
      text(joined(row.developers)?.name),
      text(joined(row.areas)?.name),
    ),
    href: developmentUrl({ slug }),
    thumb: thumb(row.hero),
  };
}

export function propertyTarget(row: Row): InternalLinkTarget {
  const reference = String(row.reference);
  const price = Number(row.price_aed);
  const media = Array.isArray(row.property_media)
    ? (row.property_media as Row[])
    : [];
  return {
    kind: "property",
    id: String(row.id).toLowerCase(),
    name: text(row.title) ?? reference,
    detail: detail(
      reference,
      text(joined(row.areas)?.name),
      Number.isFinite(price) && price > 0 ? formatPriceAED(price) : null,
    ),
    href: propertyUrl({ slug: String(row.slug), reference }),
    thumb: thumb(media.find((m) => m.role === "hero")?.media),
  };
}
