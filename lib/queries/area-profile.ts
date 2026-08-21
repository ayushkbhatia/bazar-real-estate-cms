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
import { arabicFor } from "@/lib/i18n/arabic-store";
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

/**
 * The seed guide, in the locale being rendered.
 *
 * ## Why the seed needed this at all
 *
 * `lib/seeds/areas.ts` is English editorial that lives in code: the intro, the
 * position line, the vibe, the amenity list, the school names, the commute
 * chips, the lifestyle prose and the dining picks. None of it had an Arabic
 * twin and none of it had an editor, so every word of it rendered in English
 * on `/ar` — 212 strings across 20 guides.
 *
 * ## Why the store rather than `_ar` keys in the seed file
 *
 * A `vibe_ar` beside every `vibe` was the first shape, and it was wrong for
 * one reason that outweighs how obvious it reads: it is a SECOND place Arabic
 * lives. The site has one store, keyed by the English it translates, and
 * `store-catalogue-agree.test.ts` exists to keep the message catalogue from
 * becoming a second one. 212 hand-maintained twins in a data file would be a
 * third, with nothing keeping it in step and no way for
 * `scripts/i18n/translate-content.ts` to fill it.
 *
 * Through the store, the seed joins on the same terms as everything else: the
 * pipeline can write it, `arabicFor` reads it, and "Saadiyat Beach Club" has
 * one Arabic wherever it appears.
 *
 * ## Why an explicit path list
 *
 * `localiseRow` guards its own store lookup on the twin COLUMN existing,
 * because a bare `arabicFor(value)` over a whole row would swap an `id`, a
 * `slug` or a status for a coincidental store hit. A seed object has no twin
 * columns to guard on, so the guard is this list instead: these paths carry
 * prose, and nothing else is looked up.
 */
const TRANSLATABLE = {
  /** Top-level strings. */
  own: ["intro", "position", "vibe", "lifestyle_prose"] as const,
  /** `field: [keys within each entry]`. */
  lists: {
    schools: ["name", "curriculum"],
    commute_chips: ["label"],
    dining_picks: ["name", "kind", "note"],
  } as Record<string, string[]>,
  /** Arrays of bare strings. */
  strings: ["amenities"] as const,
};

function ar(value: unknown): string | null {
  return typeof value === "string" ? arabicFor(value) : null;
}

function localiseSeed(
  seed: SeedAreaGuide | null,
  locale: Locale,
): SeedAreaGuide | null {
  if (!seed || locale === DEFAULT_LOCALE) return seed;
  const out = { ...seed } as unknown as Record<string, unknown>;

  /*
   * Untranslated falls back to English, which is invariant 2 of `localiseRow`
   * — "an untranslated row renders complete, never a hole". `vibe` is the one
   * deliberate exception, below.
   */
  for (const key of TRANSLATABLE.own) {
    const found = ar(out[key]);
    if (found) out[key] = found;
  }

  for (const [field, keys] of Object.entries(TRANSLATABLE.lists)) {
    const list = out[field];
    if (!Array.isArray(list)) continue;
    out[field] = list.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const row = { ...(entry as Record<string, unknown>) };
      for (const key of keys) {
        const found = ar(row[key]);
        if (found) row[key] = found;
      }
      return row;
    });
  }

  for (const field of TRANSLATABLE.strings) {
    const list = out[field];
    if (!Array.isArray(list)) continue;
    out[field] = list.map((v) => ar(v) ?? v);
  }

  return out as unknown as SeedAreaGuide;
}

/**
 * The vibe, and the one place the fold does NOT fall back to English.
 *
 * It is read into the hero eyebrow — "Community guide · Emerging, waterfront,
 * active-lifestyle" — so an untranslated vibe is three English words inside an
 * otherwise Arabic line, which reads worse than no descriptor at all. The
 * eyebrow degrades cleanly without one: `t("hero.guide")` renders
 * "دليل المجتمع" on its own.
 *
 * That is also the direction the section document already takes. A hero value
 * whose `_ar` twin is blank folds to null on `/ar` rather than to its English,
 * which is why the position line is absent rather than English on those pages.
 *
 * `localised` is the seed AFTER `localiseSeed`, so `vibe` is already Arabic
 * where the store had it; the comparison against the raw seed is what
 * distinguishes "translated" from "fell through".
 */
function vibeFor(
  raw: SeedAreaGuide | null,
  localised: SeedAreaGuide | null,
  locale: Locale,
): string | null {
  if (!raw || !localised) return null;
  if (locale === DEFAULT_LOCALE) return raw.vibe ?? null;
  return localised.vibe && localised.vibe !== raw.vibe ? localised.vibe : null;
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
  const { guide: rawGuide, seed: rawSeed } = input;
  if (!input.row && !rawSeed) return null;

  const locale = input.locale ?? DEFAULT_LOCALE;
  /*
   * Folded ONCE, here, and every read below goes through the result — the
   * bands, the lifestyle dossier and `profile.seed` all see the same language.
   * Folding at each read site instead is how `intro` came to be handled and
   * `amenities` did not.
   */
  const seed = localiseSeed(rawSeed, locale);
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
    vibe: vibeFor(rawSeed, seed, locale),
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
