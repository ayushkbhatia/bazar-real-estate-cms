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
import { s8 } from "@/lib/supabase/sprint-8";
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
        const { data: profile } = await s8(sb)
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
          logo_url: logoSingle?.storage_key ?? null,
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
