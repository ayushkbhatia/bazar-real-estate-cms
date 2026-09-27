import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { localiseRow } from "@/lib/i18n/localise";
import type { Locale } from "@/lib/i18n/locales";
import { mediaPublicUrl } from "@/lib/media";
import { developmentUrl } from "@/lib/queries/development-utils";
import { propertyUrl } from "@/lib/queries/property-utils";
import {
  INTERNAL_LINK_KINDS,
  areaPath,
  linkKey,
  type InternalLinkKind,
  type InternalLinkRef,
} from "./model";
import type {
  InternalLinkLookup,
  LinkCardImage,
  ResolvedAreaLink,
  ResolvedDevelopmentLink,
  ResolvedInternalLink,
  ResolvedPropertyLink,
} from "./types";

/**
 * Look up everything an article links to, for one render.
 *
 * ## One query per kind, whatever the article holds
 *
 * An article with eight link blocks and a dozen text links costs at most three
 * queries — areas, projects, listings — plus a head-count per linked area.
 * Each block fetching its own record would be twenty round-trips on every
 * revalidation of every article, and the query modules in lib/queries are not
 * React-cached, so a repeated call really is repeated.
 *
 * ## Only what the public site shows
 *
 * The public, cookie-free client, so row-level security draws the same line
 * it draws for any visitor — plus the site's own publication filters: a
 * project needs `published_at`, a listing needs `status = 'published'` and no
 * `deleted_at`. A block pointing at anything else comes back `null` and draws
 * nothing.
 *
 * ## A failed read is not an absent record
 *
 * A kind whose query errors comes back `undefined`, not `null`. For a card the
 * two look the same — no card — but a text link treats them differently: gone
 * means drop the link and keep the words, unknown means keep the link and the
 * href it was stored with. That is the same line lib/queries/read-failure.ts
 * draws for pages, at the scale of one link, without a 500: an article with
 * one unreadable card is still an article worth serving.
 *
 * Every string is folded to `locale` here, before the shaping literals are
 * built — the order `lib/i18n/fold-harness.ts` exists to police.
 */
export async function resolveInternalLinks(
  refs: readonly InternalLinkRef[],
  locale: Locale,
  client: Client | null = isSupabaseConfigured
    ? createSupabasePublicClient()
    : null,
): Promise<InternalLinkLookup> {
  const asked = new Set<string>();
  const ids: Record<InternalLinkKind, string[]> = {
    area: [],
    development: [],
    property: [],
  };
  for (const ref of refs) {
    const key = linkKey(ref.kind, ref.id);
    if (asked.has(key)) continue;
    asked.add(key);
    ids[ref.kind].push(ref.id.toLowerCase());
  }

  const found = new Map<string, ResolvedInternalLink>();
  const answered = new Set<InternalLinkKind>();

  if (client) {
    const loaders: Record<
      InternalLinkKind,
      (c: Client, ids: string[], l: Locale) => Promise<ResolvedInternalLink[]>
    > = {
      area: loadAreas,
      development: loadDevelopments,
      property: loadProperties,
    };
    await Promise.all(
      INTERNAL_LINK_KINDS.filter((kind) => ids[kind].length > 0).map(
        async (kind) => {
          try {
            const rows = await loaders[kind](client, ids[kind], locale);
            for (const row of rows) found.set(linkKey(row.kind, row.id), row);
            answered.add(kind);
          } catch (error) {
            console.error(`[internal-links] ${kind} lookup failed`, error);
          }
        },
      ),
    );
  }

  return {
    get(ref) {
      const key = linkKey(ref.kind, ref.id);
      const hit = found.get(key);
      if (hit) return hit;
      // Never asked about, or asked and the database did not answer.
      if (!asked.has(key) || !answered.has(ref.kind)) return undefined;
      return null;
    },
  };
}

type Client = Pick<ReturnType<typeof createSupabasePublicClient>, "from">;

type Row = Record<string, unknown>;

class LookupError extends Error {
  constructor(scope: string, error: { message?: string }) {
    super(`${scope}: ${error.message ?? "unknown error"}`);
  }
}

/** A string value, or null — PostgREST hands back `unknown` here. */
function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** A joined row, folded — `localiseRow` walks one level, so joins need their own call. */
function join(value: unknown, locale: Locale): Row | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return localiseRow(value as Row, locale);
}

/**
 * A joined media asset as a card image. A trashed asset is no image at all —
 * the card falls back to its placeholder rather than to a 404.
 */
function image(value: unknown, locale: Locale, fallbackAlt: string) {
  const media = join(value, locale);
  if (!media || media.deleted_at) return null;
  const key = str(media.storage_key);
  // `mediaPublicUrl` answers "" when no project URL is configured, and an
  // empty `src` is an error in `next/image`, not a blank.
  const url = key ? mediaPublicUrl(key) : "";
  if (!url) return null;
  const out: LinkCardImage = { url, alt: str(media.alt_text) ?? fallbackAlt };
  return out;
}

const MEDIA = "storage_key, alt_text, alt_text_ar, deleted_at";

/** Exported for the fold proofs. */
export const AREA_FIELDS = `id, slug, name, name_ar, description, description_ar, hero:hero_image_id(${MEDIA}), parent:parent_id(name, name_ar, hero:hero_image_id(${MEDIA}))`;

export const DEVELOPMENT_FIELDS = `id, slug, name, name_ar, tagline, tagline_ar, starting_price, handover_date, developers:developer_id(name, name_ar), areas:area_id(name, name_ar), hero:hero_image_id(${MEDIA})`;

export const PROPERTY_FIELDS = `id, reference, slug, title, title_ar, price_aed, mode, type, beds, baths, built_up_ft2, areas:area_id(name, name_ar), property_media(role, media:media_assets(${MEDIA}))`;

async function loadAreas(
  client: Client,
  ids: string[],
  locale: Locale,
): Promise<ResolvedAreaLink[]> {
  const { data, error } = await client
    .from("areas")
    .select(AREA_FIELDS)
    .in("id", ids);
  if (error) throw new LookupError("areas", error);

  const rows = ((data ?? []) as unknown as Row[]).map((raw) =>
    shapeArea(raw, locale),
  );

  // The same count the /areas grid prints. Per area, and only for the areas
  // an article actually links — a handful at most. A failed count reads as
  // zero, which only hides the line; it is no reason to drop the card.
  await Promise.all(
    rows.map(async (row) => {
      const { count } = await client
        .from("properties")
        .select("id", { head: true, count: "exact" })
        .eq("area_id", row.id)
        .eq("status", "published")
        .is("deleted_at", null);
      row.listings = typeof count === "number" ? count : 0;
    }),
  );
  return rows;
}

/** Exported for the fold proofs. */
export function shapeArea(raw: Row, locale: Locale): ResolvedAreaLink {
  const row = localiseRow(raw, locale);
  const parent = join(row.parent, locale);
  const name = str(row.name) ?? String(row.slug);
  return {
    kind: "area",
    id: String(row.id).toLowerCase(),
    slug: String(row.slug),
    href: areaPath(String(row.slug)),
    name,
    parent: str(parent?.name),
    summary: str(row.description),
    // A sub-community rarely has a photograph of its own; its parent's reads
    // better than a placeholder.
    image:
      image(row.hero, locale, name) ?? image(parent?.hero, locale, name),
    listings: 0,
  };
}

async function loadDevelopments(
  client: Client,
  ids: string[],
  locale: Locale,
): Promise<ResolvedDevelopmentLink[]> {
  const { data, error } = await client
    .from("developments")
    .select(DEVELOPMENT_FIELDS)
    .in("id", ids)
    .not("published_at", "is", null);
  if (error) throw new LookupError("developments", error);
  return ((data ?? []) as unknown as Row[]).map((raw) =>
    shapeDevelopment(raw, locale),
  );
}

export function shapeDevelopment(
  raw: Row,
  locale: Locale,
): ResolvedDevelopmentLink {
  const row = localiseRow(raw, locale);
  const name = str(row.name) ?? String(row.slug);
  return {
    kind: "development",
    id: String(row.id).toLowerCase(),
    slug: String(row.slug),
    href: developmentUrl({ slug: String(row.slug) }),
    name,
    developer: str(join(row.developers, locale)?.name),
    area: str(join(row.areas, locale)?.name),
    tagline: str(row.tagline),
    startingPriceAed: num(row.starting_price),
    handoverDate: str(row.handover_date),
    image: image(row.hero, locale, name),
  };
}

async function loadProperties(
  client: Client,
  ids: string[],
  locale: Locale,
): Promise<ResolvedPropertyLink[]> {
  const { data, error } = await client
    .from("properties")
    .select(PROPERTY_FIELDS)
    .in("id", ids)
    .eq("status", "published")
    .is("deleted_at", null);
  if (error) throw new LookupError("properties", error);
  return ((data ?? []) as unknown as Row[]).map((raw) =>
    shapeProperty(raw, locale),
  );
}

export function shapeProperty(raw: Row, locale: Locale): ResolvedPropertyLink {
  const row = localiseRow(raw, locale);
  const reference = String(row.reference);
  const name = str(row.title) ?? reference;
  const media = Array.isArray(row.property_media)
    ? (row.property_media as Row[])
    : [];
  const hero = media.find((m) => m.role === "hero" && m.media);
  return {
    kind: "property",
    id: String(row.id).toLowerCase(),
    reference,
    href: propertyUrl({ slug: String(row.slug), reference }),
    name,
    area: str(join(row.areas, locale)?.name),
    mode: row.mode as ResolvedPropertyLink["mode"],
    type: row.type as ResolvedPropertyLink["type"],
    priceAed: num(row.price_aed),
    beds: num(row.beds),
    baths: num(row.baths),
    builtUpFt2: num(row.built_up_ft2),
    image: image(hero?.media, locale, name),
  };
}
