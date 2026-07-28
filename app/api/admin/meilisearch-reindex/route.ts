/**
 * Sprint 12 — admin-triggered Meilisearch full reindex.
 *
 * POST /api/admin/meilisearch-reindex (admin only). Deletes the
 * `properties` index then runs the same scan-and-upsert loop as the
 * sync cron. Use after schema/index-shape changes that need a clean
 * rebuild.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import { currentUserIsAdmin } from "@/lib/queries/staff";
import {
  ensurePropertiesIndex,
  meilisearchAdminClient,
  PROPERTIES_INDEX,
  upsertProperties,
  type IndexedProperty,
} from "@/lib/meilisearch";
import type { Database } from "@/db/types";

function adminClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Service-role Supabase not configured");
  }
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const PAGE_SIZE = 500;

export async function POST(_req: NextRequest) {
  if (!(await currentUserIsAdmin())) {
    return NextResponse.json(
      { ok: false, reason: "Admin role required" },
      { status: 403 },
    );
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { ok: false, reason: "Supabase not configured" },
      { status: 503 },
    );
  }

  const meili = meilisearchAdminClient();
  if (!meili) {
    return NextResponse.json(
      { ok: false, reason: "Meilisearch not configured" },
      { status: 503 },
    );
  }

  try {
    // Drop + recreate index settings.
    try {
      await meili.deleteIndex(PROPERTIES_INDEX);
    } catch {
      // ignore if it doesn't exist yet
    }
    await ensurePropertiesIndex();

    const supabase = adminClient();
    let offset = 0;
    let totalIndexed = 0;

    while (true) {
      const { data, error } = await supabase
        .from("properties")
        .select(
          "id, reference, slug, title, short_description, price_aed, mode, type, beds, baths, built_up_ft2, amenities, bazar_verified, published_at, areas:area_id(slug, name), property_media(role, media:media_assets(storage_key))",
        )
        .eq("status", "published")
        .is("deleted_at", null)
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;

      const docs: IndexedProperty[] = (data as unknown as RawRow[]).map((r) => {
        const area = Array.isArray(r.areas) ? r.areas[0] : r.areas;
        const heroJoin = (r.property_media ?? []).find(
          (m) => m.role === "hero",
        );
        const heroMedia = heroJoin
          ? Array.isArray(heroJoin.media)
            ? heroJoin.media[0] ?? null
            : heroJoin.media
          : null;
        return {
          id: r.id,
          reference: r.reference,
          slug: r.slug,
          title: r.title,
          short_description: r.short_description,
          price_aed: Number(r.price_aed),
          mode: r.mode,
          type: r.type,
          beds: r.beds,
          baths: r.baths,
          built_up_ft2: r.built_up_ft2,
          area_slug: area?.slug ?? null,
          area_name: area?.name ?? null,
          amenities: r.amenities ?? [],
          bazar_verified: Boolean(r.bazar_verified ?? false),
          published_at_unix: r.published_at
            ? Math.floor(new Date(r.published_at).getTime() / 1000)
            : null,
          hero_storage_key: heroMedia?.storage_key ?? null,
        };
      });

      const res = await upsertProperties(docs);
      totalIndexed += res.count;
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    return NextResponse.json({ ok: true, indexed: totalIndexed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/meilisearch-reindex]", message);
    return NextResponse.json(
      { ok: false, reason: message },
      { status: 500 },
    );
  }
}

type RawRow = {
  id: string;
  reference: string;
  slug: string;
  title: string;
  short_description: string | null;
  price_aed: number | string;
  mode: "buy" | "rent" | "off_plan" | "commercial";
  type: string;
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  amenities: string[] | null;
  bazar_verified?: boolean;
  published_at: string | null;
  areas:
    | { slug: string; name: string }
    | { slug: string; name: string }[]
    | null;
  property_media:
    | {
        role: string;
        media:
          | { storage_key: string }
          | { storage_key: string }[]
          | null;
      }[]
    | null;
};
