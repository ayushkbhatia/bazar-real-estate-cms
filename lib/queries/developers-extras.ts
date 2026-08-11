/**
 * Developer-profile queries (narrative overlay + dev list per developer).
 *
 * Distinct from `lib/queries/developments.ts`, which handles the
 * developments table itself. This file joins `developers` (master row)
 * with `developer_profiles` (narrative + awards) to render
 * /developers/[slug]. Falls back to `lib/seeds/developers.ts` when
 * Supabase is offline or empty.
 */

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { SEED_DEVELOPERS } from "@/lib/seeds/developers";
import type {
  DeveloperProfileRow,
  DeveloperAward,
} from "@/lib/types/sprint-8";

export type DeveloperDetail = {
  id: string;
  slug: string;
  name: string;
  founded_year: number | null;
  description: string | null;
  logo_url: string | null;
  // From developer_profiles overlay:
  bio: string | null;
  headquarters: string | null;
  website: string | null;
  awards: DeveloperAward[];
  signature_styles: string[];
  current_focus: string | null;
};

export type DeveloperDevelopment = {
  id: string;
  name: string;
  slug: string;
  status: string;
  handover_date: string | null;
  starting_price: number | null;
  area: { name: string; slug: string } | null;
};

export type DeveloperListEntry = {
  id: string;
  slug: string;
  name: string;
  founded_year: number | null;
  description: string | null;
  /** Public URL of the uploaded logo, or null to fall back to a mark. */
  logo_url: string | null;
};

const LIST_COLUMNS =
  "id, slug, name, founded_year, description, logo:logo_id(storage_key)";

/** PostgREST returns an embedded row as an object or a one-element array. */
function firstStorageKey(value: unknown): string | null {
  const single = Array.isArray(value) ? value[0] : value;
  const key = (single as { storage_key?: unknown } | null)?.storage_key;
  return typeof key === "string" ? key : null;
}

// ─────────────────────────────────────────────────────────────────────
// listDevelopers
// ─────────────────────────────────────────────────────────────────────
export async function listDevelopers(): Promise<DeveloperListEntry[]> {
  if (!isSupabaseConfigured) return seedDeveloperList();
  try {
    const sb = createSupabasePublicClient();
    const { data, error } = await sb
      .from("developers")
      .select(LIST_COLUMNS)
      .order("name", { ascending: true });
    if (error || !data || data.length === 0) return seedDeveloperList();
    return data.map((r) => {
      const key = firstStorageKey(r.logo);
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        founded_year: r.founded_year,
        description: r.description,
        logo_url: key ? mediaPublicUrl(key) : null,
      };
    });
  } catch {
    return seedDeveloperList();
  }
}

function seedDeveloperList(): DeveloperListEntry[] {
  return SEED_DEVELOPERS.map((s) => ({
    id: `seed:${s.slug}`,
    slug: s.slug,
    name: s.name,
    founded_year: s.founded_year,
    description: s.blurb,
    logo_url: null,
  }));
}

// ─────────────────────────────────────────────────────────────────────
// listDeveloperRecords — the admin catalogue view
// ─────────────────────────────────────────────────────────────────────

export type DeveloperRecordRow = DeveloperListEntry & {
  logo_id: string | null;
  /** Published + draft developments filed under this developer. */
  development_count: number;
  /** Properties filed under it — what makes the row load-bearing. */
  property_count: number;
};

/**
 * Every developer with the counts that say whether it is in use.
 *
 * Three roundtrips whatever the catalogue size: the rows, then one pass over
 * `developments` and one over `properties` tallied in memory. A `count()` per
 * developer would be ~35 queries today and grows with every row staff add.
 */
export async function listDeveloperRecords(): Promise<DeveloperRecordRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const sb = createSupabasePublicClient();
    const [{ data: rows }, { data: developments }, { data: properties }] =
      await Promise.all([
        sb
          .from("developers")
          .select(`${LIST_COLUMNS}, logo_id`)
          .order("name", { ascending: true }),
        sb.from("developments").select("developer_id"),
        sb.from("properties").select("developer_id"),
      ]);
    if (!rows) return [];

    const tally = (list: { developer_id: string | null }[] | null) => {
      const out = new Map<string, number>();
      for (const r of list ?? []) {
        if (r.developer_id) out.set(r.developer_id, (out.get(r.developer_id) ?? 0) + 1);
      }
      return out;
    };
    const devCounts = tally(developments);
    const propCounts = tally(properties);

    return rows.map((r) => {
      const key = firstStorageKey(r.logo);
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        founded_year: r.founded_year,
        description: r.description,
        logo_url: key ? mediaPublicUrl(key) : null,
        logo_id: r.logo_id,
        development_count: devCounts.get(r.id) ?? 0,
        property_count: propCounts.get(r.id) ?? 0,
      };
    });
  } catch {
    return [];
  }
}

/** One developer record for the editor. Null when the id matches nothing. */
export async function getDeveloperRecord(
  id: string,
): Promise<DeveloperRecordRow | null> {
  const rows = await listDeveloperRecords();
  return rows.find((r) => r.id === id) ?? null;
}

/** Same, by public slug — what the record editor's URL carries. */
export async function getDeveloperRecordBySlug(
  slug: string,
): Promise<DeveloperRecordRow | null> {
  const rows = await listDeveloperRecords();
  return rows.find((r) => r.slug === slug) ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// listDeveloperListings
// ─────────────────────────────────────────────────────────────────────

export type DeveloperListing = {
  id: string;
  reference: string;
  slug: string;
  title: string;
  price_aed: number;
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  flags: Record<string, unknown> | null;
  area: { name: string; slug: string } | null;
  hero: { storage_key: string; alt_text: string | null } | null;
};

/**
 * Published listings filed under one developer.
 *
 * Deliberately its own query rather than a filter on `listPublishedProperties`:
 * that function's module is shared with several in-flight branches, and the
 * profile page needs a narrower row than the search grid does. The select
 * mirrors the card's props — anything the card doesn't render isn't fetched.
 */
export async function listDeveloperListings(
  developerId: string,
  limit = 6,
): Promise<DeveloperListing[]> {
  if (!isSupabaseConfigured || !developerId || developerId.startsWith("seed:")) {
    return [];
  }
  try {
    const sb = createSupabasePublicClient();
    const { data, error } = await sb
      .from("properties")
      .select(
        // `properties` has three FKs into `areas` (area, sub-community, building),
        // so the embed has to name the constraint — the bare alias is ambiguous.
        "id, reference, slug, title, price_aed, beds, baths, built_up_ft2, flags, published_at, areas!properties_area_id_fkey(name, slug), property_media(role, media:media_assets(storage_key, alt_text))",
      )
      .eq("developer_id", developerId)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];

    return data.map((r) => {
      const areaArr = r.areas as
        | { name: string; slug: string }
        | { name: string; slug: string }[]
        | null;
      const joins = (r.property_media ?? []) as {
        role: string;
        media: { storage_key: string; alt_text: string | null } | null;
      }[];
      const hero = joins.find((j) => j.role === "hero" && j.media)?.media ?? null;
      return {
        id: r.id,
        reference: r.reference,
        slug: r.slug,
        title: r.title,
        price_aed: Number(r.price_aed) || 0,
        beds: r.beds,
        baths: r.baths,
        built_up_ft2: r.built_up_ft2,
        flags: (r.flags as Record<string, unknown> | null) ?? null,
        area: (Array.isArray(areaArr) ? areaArr[0] : areaArr) ?? null,
        hero,
      };
    });
  } catch {
    return [];
  }
}

/** How many published listings this developer has, for the "view all" link. */
export async function countDeveloperListings(
  developerId: string,
): Promise<number> {
  if (!isSupabaseConfigured || !developerId || developerId.startsWith("seed:")) {
    return 0;
  }
  try {
    const sb = createSupabasePublicClient();
    const { count } = await sb
      .from("properties")
      .select("id", { head: true, count: "exact" })
      .eq("developer_id", developerId)
      .eq("status", "published")
      .is("deleted_at", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────
// getDeveloperBySlug
// ─────────────────────────────────────────────────────────────────────
export async function getDeveloperBySlug(
  slug: string,
): Promise<DeveloperDetail | null> {
  if (!slug) return null;

  if (isSupabaseConfigured) {
    try {
      const sb = createSupabasePublicClient();
      const { data: dev } = await sb
        .from("developers")
        .select(
          "id, slug, name, founded_year, description, logo:logo_id(storage_key)",
        )
        .eq("slug", slug)
        .maybeSingle();
      if (dev) {
        const { data: profile } = await sb
          .from("developer_profiles")
          .select("*")
          .eq("developer_id", dev.id)
          .not("published_at", "is", null)
          .maybeSingle();
        const p = (profile as DeveloperProfileRow | null) ?? null;
        const logoArr = dev.logo as
          | { storage_key: string }
          | { storage_key: string }[]
          | null;
        const logoSingle = Array.isArray(logoArr) ? logoArr[0] : logoArr;
        return {
          id: dev.id,
          slug: dev.slug,
          name: dev.name,
          founded_year: dev.founded_year,
          description: dev.description,
          // A storage key is not something a caller can put in an `src`, and
          // this used to hand one back raw — every consumer would have had to
          // know about buckets. Resolve it here, like the area hero does.
          logo_url: logoSingle ? mediaPublicUrl(logoSingle.storage_key) : null,
          bio: p?.bio ?? null,
          headquarters: p?.headquarters ?? null,
          website: p?.website ?? null,
          awards: p?.awards ?? [],
          signature_styles: p?.signature_styles ?? [],
          current_focus: p?.current_focus ?? null,
        };
      }
    } catch {
      // fall through to seed
    }
  }

  const seed = SEED_DEVELOPERS.find((d) => d.slug === slug);
  if (!seed) return null;
  return {
    id: `seed:${seed.slug}`,
    slug: seed.slug,
    name: seed.name,
    founded_year: seed.founded_year,
    description: seed.blurb,
    logo_url: null,
    bio: seed.bio,
    headquarters: seed.headquarters,
    website: null,
    awards: seed.awards.map((name) => ({
      name,
      year: 0,
      body: "",
    })),
    signature_styles: [],
    current_focus: null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// listDeveloperDevelopments
// ─────────────────────────────────────────────────────────────────────
export async function listDeveloperDevelopments(
  developerId: string,
): Promise<DeveloperDevelopment[]> {
  if (!isSupabaseConfigured || !developerId || developerId.startsWith("seed:")) {
    return [];
  }
  try {
    const sb = createSupabasePublicClient();
    const { data, error } = await sb
      .from("developments")
      .select(
        "id, name, slug, status, handover_date, starting_price, area:area_id(name, slug)",
      )
      .eq("developer_id", developerId)
      .not("published_at", "is", null)
      .order("handover_date", { ascending: false });
    if (error || !data) return [];
    return data.map((r) => {
      const areaArr = r.area as
        | { name: string; slug: string }
        | { name: string; slug: string }[]
        | null;
      const areaSingle = Array.isArray(areaArr) ? areaArr[0] : areaArr;
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        status: r.status,
        handover_date: r.handover_date,
        starting_price: r.starting_price,
        area: areaSingle ?? null,
      };
    });
  } catch {
    return [];
  }
}
