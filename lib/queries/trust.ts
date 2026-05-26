/**
 * Trust-strip data: aggregated rating + count we display in the home and
 * /about pages.
 *
 * T1-D cleanup: live Google Places API integration when
 * `GOOGLE_PLACES_API_KEY` + `GOOGLE_PLACES_PLACE_ID` are set. Falls back
 * to the curated snapshot when either env var is missing, so dev /
 * preview keep working without burning quota.
 *
 * Results are cached in module memory for `CACHE_TTL_MS` so the cron-style
 * daily refresh implied by the plan happens naturally — the first request
 * each ~24h pays the upstream call.
 */

import { env } from "@/lib/env";

export type ReviewsSnapshot = {
  /** Average rating, 0-5. */
  rating: number;
  /** Total review count. */
  count: number;
  /** Display name of the review platform. */
  platform: "Google" | "Feefo";
  /** Deep-link to the reviews destination. */
  href: string;
  /** When the snapshot was last refreshed. */
  refreshed_at: string;
  /** True when the snapshot came from the curated fallback (not live). */
  is_fallback: boolean;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let cached: ReviewsSnapshot | null = null;
let cacheUntil = 0;

const FALLBACK_SNAPSHOT: ReviewsSnapshot = {
  rating: 4.9,
  count: 87,
  platform: "Google",
  href: "https://www.google.com/search?q=bazar+real+estate+abu+dhabi+reviews",
  refreshed_at: new Date().toISOString(),
  is_fallback: true,
};

export async function getGoogleReviewsSnapshot(): Promise<ReviewsSnapshot> {
  // Cache hit
  if (cached && Date.now() < cacheUntil) return cached;

  const apiKey = env.GOOGLE_PLACES_API_KEY;
  const placeId = env.GOOGLE_PLACES_PLACE_ID;
  if (!apiKey || !placeId) {
    // No live integration — return the curated fallback. Cache it briefly
    // so concurrent requests on the same page render don't re-resolve env.
    cached = FALLBACK_SNAPSHOT;
    cacheUntil = Date.now() + 60 * 1000;
    return cached;
  }

  try {
    // Places API "Find Details" endpoint. We only need `rating` +
    // `user_ratings_total` + the Google Maps URL.
    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/details/json",
    );
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("fields", "rating,user_ratings_total,url");
    url.searchParams.set("key", apiKey);
    const res = await fetch(url.toString(), {
      // Server-side cache: 24h to stay well under Google's free-tier quota.
      next: { revalidate: CACHE_TTL_MS / 1000 },
    });
    if (!res.ok) throw new Error(`Places API status ${res.status}`);
    const data = (await res.json()) as {
      status: string;
      result?: {
        rating?: number;
        user_ratings_total?: number;
        url?: string;
      };
    };
    if (data.status !== "OK" || !data.result?.rating) {
      throw new Error(`Places API ${data.status}`);
    }
    cached = {
      rating: data.result.rating,
      count: data.result.user_ratings_total ?? 0,
      platform: "Google",
      href: data.result.url ?? FALLBACK_SNAPSHOT.href,
      refreshed_at: new Date().toISOString(),
      is_fallback: false,
    };
    cacheUntil = Date.now() + CACHE_TTL_MS;
    return cached;
  } catch (err) {
    // Best-effort: log and fall through to the curated snapshot rather
    // than blocking the home page render.
    console.warn("[trust] Google Places fetch failed:", err);
    cached = FALLBACK_SNAPSHOT;
    cacheUntil = Date.now() + 5 * 60 * 1000; // short retry window
    return cached;
  }
}

export const DLD_BROKER_PERMIT = "ORN 28041";
