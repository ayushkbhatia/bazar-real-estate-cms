/**
 * Area profile — the one shape `/areas/[slug]` renders from.
 *
 * Before this existed the public guide page was gated on `lib/seeds/areas.ts`:
 * an area that only lived in Postgres (anything staff created after launch)
 * resolved to `null` and the route 404-ed, so adding an area in the CMS
 * produced a catalogue row with no page behind it.
 *
 * The resolver flips the precedence. The **database row is what makes an area
 * real**; the seed guide and the `area_guides` overlay are editorial enrichment
 * layered on top. A brand-new area therefore gets a working page the moment
 * it's created — hero, map, listings, valuation prompt — and the data-heavy
 * bands (stats, schools, lifestyle, similar) self-hide until someone fills
 * them in.
 *
 * Precedence, field by field: `area_guides` (published) → seed guide → the
 * `areas` row itself → neutral fallback.
 */

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { localiseRow } from "@/lib/i18n/localise";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { SEED_AREA_GUIDES, type SeedAreaGuide } from "@/lib/seeds/areas";
import type { AreaGuideRow } from "@/lib/types/sprint-8";
import type { AreaKind } from "@/lib/schemas/area";

export type AreaProfileStats = {
  medianAptPerFt2: number | null;
  medianVillaPerFt2: number | null;
  avgDaysOnMarket: number | null;
  yoyChangePct: number | null;
};

export type AreaProfileSchool = {
  name: string;
  curriculum: string | null;
  distance_km: number | null;
  rating?: string | null;
};

export type AreaProfile = {
  /** Postgres id, or null for a seed-only area (no row yet). */
  id: string | null;
  slug: string;
  name: string;
  kind: AreaKind;
  intro: string;
  /** Small mono line under the intro — seed-only editorial, may be null. */
  position: string | null;
  vibe: string | null;
  /** Placeholder-image caption when no cover image is set. */
  heroLabel: string;
  /** Null when nobody has supplied figures — the stats band then hides. */
  stats: AreaProfileStats | null;
  schools: AreaProfileSchool[];
  amenities: string[];
  similarSlugs: string[];
  geo: { lat: number; lng: number } | null;
  metaTitle: string | null;
  metaDescription: string | null;
  /**
   * The seed record when one exists. Sections that are still seed-shaped
   * (the lifestyle dossier) take it and self-hide when it's null.
   */
  seed: SeedAreaGuide | null;
};

export type AreaRecordRow = {
  id: string;
  slug: string;
  name: string;
  name_ar?: string | null;
  kind: AreaKind;
  description: string | null;
  description_ar?: string | null;
  geo: unknown;
  seo_meta: unknown;
};

// ─────────────────────────────────────────────────────────────────────
// Pure composition — no Supabase, unit-tested directly.
// ─────────────────────────────────────────────────────────────────────

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** `{lat,lng}` jsonb → a validated pair, or null. */
function readGeo(value: unknown): { lat: number; lng: number } | null {
  if (!value || typeof value !== "object") return null;
  const g = value as { lat?: unknown; lng?: unknown };
  const lat = num(g.lat);
  const lng = num(g.lng);
  if (lat === null || lng === null) return null;
  return { lat, lng };
}

function readSeoMeta(value: unknown): {
  title: string | null;
  description: string | null;
} {
  if (!value || typeof value !== "object")
    return { title: null, description: null };
  const m = value as { meta_title?: unknown; meta_description?: unknown };
  return {
    title:
      typeof m.meta_title === "string" && m.meta_title ? m.meta_title : null,
    description:
      typeof m.meta_description === "string" && m.meta_description
        ? m.meta_description
        : null,
  };
}

/**
 * A stats band with nothing in it is worse than no band. Collapse an
 * all-null set to `null` so the section drops out entirely.
 */
function statsOrNull(s: AreaProfileStats): AreaProfileStats | null {
  const empty =
    s.medianAptPerFt2 === null &&
    s.medianVillaPerFt2 === null &&
    s.avgDaysOnMarket === null &&
    s.yoyChangePct === null;
  return empty ? null : s;
}

function statsFromGuide(guide: AreaGuideRow | null): AreaProfileStats | null {
  if (!guide?.stats) return null;
  const s = guide.stats as Record<string, unknown>;
  return statsOrNull({
    medianAptPerFt2: num(s.medianApt),
    medianVillaPerFt2: num(s.medianVilla),
    avgDaysOnMarket: num(s.daysOnMarket),
    yoyChangePct: num(s.yoyChange),
  });
}

function statsFromSeed(seed: SeedAreaGuide | null): AreaProfileStats | null {
  if (!seed) return null;
  // Seeds carry 0 for "we don't publish a villa median here" — read that as
  // absent rather than as a headline zero.
  const zeroAsNull = (n: number) => (n > 0 ? n : null);
  return statsOrNull({
    medianAptPerFt2: zeroAsNull(seed.stats.median_apt_aed_per_ft2),
    medianVillaPerFt2: zeroAsNull(seed.stats.median_villa_aed_per_ft2),
    avgDaysOnMarket: zeroAsNull(seed.stats.avg_dom_days),
    yoyChangePct: seed.stats.yoy_change_pct || null,
  });
}

function schoolsFrom(
  guide: AreaGuideRow | null,
  seed: SeedAreaGuide | null,
): AreaProfileSchool[] {
  if (guide && guide.schools?.length) {
    return guide.schools.map((s) => ({
      name: s.name,
      curriculum: null,
      distance_km: num(s.distance_km),
      rating: null,
    }));
  }
  if (seed) {
    return seed.schools.map((s) => ({
      name: s.name,
      curriculum: s.curriculum,
      distance_km: s.distance_km,
      rating: s.rating ?? null,
    }));
  }
  return [];
}

function amenitiesFrom(
  guide: AreaGuideRow | null,
  seed: SeedAreaGuide | null,
): string[] {
  if (guide && guide.amenities?.length)
    return guide.amenities.map((a) => a.name);
  return seed?.amenities ?? [];
}

/**
 * Merge the three layers into the shape the page renders.
 *
 * Returns null only when the slug matches nothing at all — that's the one
 * case that should still 404.
 */
export function composeAreaProfile(input: {
  /** The RAW row, twins included — this function folds it. */
  row: AreaRecordRow | null;
  guide: AreaGuideRow | null;
  seed: SeedAreaGuide | null;
  locale?: Locale;
}): AreaProfile | null {
  const { guide: rawGuide, seed } = input;
  if (!input.row && !seed) return null;

  const locale = input.locale ?? DEFAULT_LOCALE;
  // Folded here rather than by the caller, because the intro precedence below
  // has to know whether a translation exists — see the comment on `intro`.
  const row = input.row
    ? (localiseRow(
        input.row as unknown as Record<string, unknown>,
        locale,
      ) as unknown as AreaRecordRow)
    : null;
  const guide = rawGuide
    ? (localiseRow(
        rawGuide as unknown as Record<string, unknown>,
        locale,
      ) as unknown as AreaGuideRow)
    : null;
  /* True when the record carries an authored Arabic description. */
  const hasTranslatedDescription =
    locale !== DEFAULT_LOCALE &&
    typeof input.row?.description_ar === "string" &&
    input.row.description_ar.trim() !== "";

  const slug = row?.slug ?? seed!.slug;
  const name = row?.name ?? seed!.name;
  const seo = readSeoMeta(row?.seo_meta);

  return {
    id: row?.id ?? null,
    slug,
    name,
    kind: row?.kind ?? "area",
    /*
     * `seed?.intro` is English-only editorial that lives in code
     * (lib/seeds/areas.ts) and has no Arabic twin. Left in place it would win
     * over a description the team has actually translated, dropping a
     * paragraph of English into the top of an Arabic page — so on a non-default
     * locale it steps aside for an authored translation. English is untouched:
     * `hasTranslatedDescription` is false whenever the locale is the default.
     */
    intro:
      guide?.intro_md ||
      (hasTranslatedDescription ? row?.description : seed?.intro) ||
      seed?.intro ||
      row?.description ||
      "",
    position: seed?.position ?? null,
    vibe: seed?.vibe ?? null,
    heroLabel: seed?.hero_label ?? slug,
    stats: statsFromGuide(guide) ?? statsFromSeed(seed),
    schools: schoolsFrom(guide, seed),
    amenities: amenitiesFrom(guide, seed),
    similarSlugs: guide?.related_areas?.length
      ? guide.related_areas
      : (seed?.similar_areas ?? []),
    geo: readGeo(row?.geo),
    metaTitle: seo.title,
    metaDescription: seo.description,
    seed: seed ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// getAreaProfile
// ─────────────────────────────────────────────────────────────────────

const AREA_COLUMNS =
  "id, slug, name, name_ar, kind, description, description_ar, geo, seo_meta";

/**
 * Resolve one area for the public guide page.
 *
 * Slugs are unique across the whole table (0076), so the lookup takes the
 * first match rather than `.maybeSingle()` — a legacy duplicate under a
 * different parent then renders the older record instead of throwing.
 */
export async function getAreaProfile(
  slug: string,
  /*
   * Optional for the same reason as `getPublishedPropertyByReference`:
   * `areas/[slug]/opengraph-image.tsx` is a metadata route with no
   * `setRequestLocale` above it, and an ambient read there would drop a
   * prerendered route off the G-1 baseline.
   */
  locale?: Locale,
): Promise<AreaProfile | null> {
  if (!slug) return null;
  const seed = SEED_AREA_GUIDES.find((g) => g.slug === slug) ?? null;
  const active = locale ?? (await currentLocale());
  if (!isSupabaseConfigured)
    return composeAreaProfile({ row: null, guide: null, seed, locale: active });

  try {
    const sb = createSupabasePublicClient();
    const { data: rows } = await sb
      .from("areas")
      .select(AREA_COLUMNS)
      .eq("slug", slug)
      .order("created_at", { ascending: true })
      .limit(1);
    const row = (rows?.[0] as AreaRecordRow | undefined) ?? null;
    if (!row)
      return composeAreaProfile({
        row: null,
        guide: null,
        seed,
        locale: active,
      });

    const { data: guide } = await sb
      .from("area_guides")
      .select("*")
      .eq("area_id", row.id)
      .not("published_at", "is", null)
      .maybeSingle();

    return composeAreaProfile({
      row,
      guide: (guide as AreaGuideRow | null) ?? null,
      seed,
      locale: active,
    });
  } catch {
    return composeAreaProfile({ row: null, guide: null, seed, locale: active });
  }
}

// ─────────────────────────────────────────────────────────────────────
// listAreaDirectory
// ─────────────────────────────────────────────────────────────────────

export type AreaDirectoryChild = {
  id: string;
  slug: string;
  name: string;
  listingCount: number;
};

export type AreaDirectoryEntry = AreaDirectoryChild & {
  children: AreaDirectoryChild[];
};

/**
 * Every area and sub-community in the catalogue, alphabetical, with live
 * published-listing counts.
 *
 * The `/areas` card grid is a curated eight; without a complete index a newly
 * created area is reachable only by typing its URL. This is that index —
 * two Supabase roundtrips regardless of how many areas exist (the counts are
 * tallied in memory, not one `count()` per row).
 */
export async function listAreaDirectory(): Promise<AreaDirectoryEntry[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const sb = createSupabasePublicClient();
    const [{ data: rows }, { data: props }] = await Promise.all([
      sb
        .from("areas")
        .select("id, slug, name, name_ar, kind, parent_id")
        .in("kind", ["area", "sub_community"])
        .order("name", { ascending: true }),
      sb.from("properties").select("area_id").eq("status", "published"),
    ]);
    if (!rows || rows.length === 0) return [];

    const counts = new Map<string, number>();
    for (const p of props ?? []) {
      const id = (p as { area_id: string | null }).area_id;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    // Display names on the A-Z directory. `slug` stays untouched — it is the
    // URL, and folding an identity is how filtering breaks on /ar.
    const directoryLocale = await currentLocale();
    const shape = (r: { id: string; slug: string; name: string }) => {
      const t = localiseRow(
        r as unknown as Record<string, unknown>,
        directoryLocale,
      ) as unknown as { id: string; slug: string; name: string };
      return {
        id: r.id,
        slug: r.slug,
        name: t.name,
        listingCount: counts.get(r.id) ?? 0,
      };
    };

    const areas = rows.filter((r) => r.kind === "area");
    const byParent = new Map<string, AreaDirectoryChild[]>();
    for (const r of rows) {
      if (r.kind !== "sub_community" || !r.parent_id) continue;
      const list = byParent.get(r.parent_id) ?? [];
      list.push(shape(r));
      byParent.set(r.parent_id, list);
    }

    return areas.map((a) => ({
      ...shape(a),
      children: byParent.get(a.id) ?? [],
    }));
  } catch {
    return [];
  }
}
