/**
 * Sprint 13 — shared loader for syndication feeds.
 *
 * Pulls every published property in one paged scan and shapes it into
 * the FeedProperty contract used by both Property Finder + Bayut
 * renderers. Service-role client so the cron + feed routes can read
 * without authentication.
 */

import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { s8 } from "@/lib/supabase/sprint-8";
import type { FeedProperty } from "./property-finder";
import type { Database } from "@/db/types";

const PAGE_SIZE = 500;

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

export async function loadFeedProperties(): Promise<FeedProperty[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = adminClient();
  const out: FeedProperty[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await s8(supabase)
      .from("properties")
      .select(
        "reference, slug, title, description, type, mode, beds, baths, built_up_ft2, price_aed, geo, listing_permit_no, listing_permit_expires_at, published_at, areas:area_id(name, slug), assigned_agent:assigned_agent_id(display_name, brn), property_media(role, media:media_assets(storage_key))",
      )
      .eq("status", "published")
      .is("deleted_at", null)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;

    for (const row of data as RawRow[]) {
      const area = Array.isArray(row.areas) ? row.areas[0] : row.areas;
      const agent = Array.isArray(row.assigned_agent)
        ? row.assigned_agent[0]
        : row.assigned_agent;
      const heroJoin = (row.property_media ?? []).find(
        (m) => m.role === "hero",
      );
      const heroMedia = heroJoin
        ? Array.isArray(heroJoin.media)
          ? heroJoin.media[0] ?? null
          : heroJoin.media
        : null;
      const heroUrl = heroMedia ? mediaPublicUrl(heroMedia.storage_key) : null;

      out.push({
        reference: row.reference,
        slug: row.slug,
        title: row.title,
        description: row.description,
        type: row.type,
        mode: row.mode,
        beds: row.beds,
        baths: row.baths,
        built_up_ft2: row.built_up_ft2,
        price_aed: Number(row.price_aed),
        area_name: area?.name ?? null,
        area_slug: area?.slug ?? null,
        geo:
          row.geo && typeof row.geo === "object"
            ? {
                lat: Number((row.geo as { lat?: number }).lat ?? 0),
                lng: Number((row.geo as { lng?: number }).lng ?? 0),
              }
            : null,
        hero_url: heroUrl,
        permit_number: row.listing_permit_no,
        permit_expires_at: row.listing_permit_expires_at,
        agent_name: agent?.display_name ?? null,
        agent_brn: agent?.brn ?? null,
        agent_phone: null, // agent table has no phone column yet
        agent_email: null,
        published_at: row.published_at,
      });
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return out;
}

type RawRow = {
  reference: string;
  slug: string;
  title: string;
  description: string | null;
  type: string;
  mode: "buy" | "rent" | "off_plan" | "commercial";
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  price_aed: number | string;
  geo: unknown;
  listing_permit_no: string | null;
  listing_permit_expires_at: string | null;
  published_at: string | null;
  areas:
    | { name: string; slug: string }
    | { name: string; slug: string }[]
    | null;
  assigned_agent:
    | { display_name: string; brn: string | null }
    | { display_name: string; brn: string | null }[]
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
