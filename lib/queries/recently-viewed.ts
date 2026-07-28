/**
 * Recently-viewed properties per account.
 *
 * `recordView()` is called from /p/[slug] (server action, idempotent —
 * upserts viewed_at on conflict). `listRecentlyViewed()` powers the
 * Recently-viewed tab on /account/saved. Anonymous views aren't tracked
 * here; they live in the browser session only.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type RecentlyViewedEntry = {
  property_id: string;
  reference: string;
  slug: string;
  title: string;
  price_aed: number;
  hero_storage_key: string | null;
  viewed_at: string;
};

/** Upsert a recently-viewed row. Caller passes the resolved user.id —
 *  this avoids re-fetching the session inside what is often a render path. */
export async function recordView(
  userId: string,
  propertyId: string,
): Promise<void> {
  if (!isSupabaseConfigured || !userId || !propertyId) return;
  try {
    const sb = await createSupabaseServerClient();
    await sb
      .from("recently_viewed")
      .upsert(
        { user_id: userId, property_id: propertyId, viewed_at: new Date().toISOString() },
        { onConflict: "user_id,property_id" },
      );
  } catch (e) {
    // recently-viewed is best-effort; don't surface failures.
    console.error("[recordView]", e);
  }
}

/** Most recent N views for a user. */
export async function listRecentlyViewed(
  userId: string,
  limit = 12,
): Promise<RecentlyViewedEntry[]> {
  if (!isSupabaseConfigured || !userId) return [];
  try {
    const sb = await createSupabaseServerClient();
    const { data } = await sb
      .from("recently_viewed")
      .select(
        "property_id, viewed_at, property:property_id(reference, slug, title, price_aed, property_media(role, media:media_assets(storage_key)))",
      )
      .eq("user_id", userId)
      .order("viewed_at", { ascending: false })
      .limit(limit);
    if (!data) return [];
    return (data as RawRecentlyViewed[])
      .map((r) => {
        const prop = Array.isArray(r.property) ? r.property[0] : r.property;
        if (!prop) return null;
        const heroMedia =
          (prop.property_media ?? []).find(
            (m: RawMedia) => m.role === "hero",
          ) ??
          (prop.property_media ?? [])[0] ??
          null;
        const heroStorageKey = heroMedia?.media
          ? Array.isArray(heroMedia.media)
            ? heroMedia.media[0]?.storage_key ?? null
            : heroMedia.media.storage_key ?? null
          : null;
        return {
          property_id: r.property_id,
          reference: prop.reference,
          slug: prop.slug,
          title: prop.title,
          price_aed: prop.price_aed,
          hero_storage_key: heroStorageKey,
          viewed_at: r.viewed_at,
        };
      })
      .filter((e): e is RecentlyViewedEntry => e !== null);
  } catch {
    return [];
  }
}

type RawMedia = {
  role: string;
  media:
    | { storage_key: string }
    | { storage_key: string }[]
    | null;
};

type RawRecentlyViewed = {
  property_id: string;
  viewed_at: string;
  property:
    | {
        reference: string;
        slug: string;
        title: string;
        price_aed: number;
        property_media: RawMedia[];
      }
    | {
        reference: string;
        slug: string;
        title: string;
        price_aed: number;
        property_media: RawMedia[];
      }[]
    | null;
};
