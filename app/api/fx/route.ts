import { NextResponse } from "next/server";
import { fetchFxRates } from "@/lib/preferences/fx-source";

/**
 * Public FX endpoint consumed by `PreferencesProvider` on mount.
 *
 * Only the EUR figure is live — USD is the AED peg and is a constant. The
 * upstream fetch is itself cached for 24h by Next's data cache; the extra
 * hour of route-level caching keeps repeat visitors off the function
 * entirely. `fetchFxRates` never throws, so this always returns 200 with
 * usable numbers — `source: "static"` signals a degraded (stale) answer.
 */
export const revalidate = 3600;

export async function GET() {
  const fx = await fetchFxRates();
  return NextResponse.json(fx, {
    headers: {
      // Long SWR window: a day-old FX display rate is fine, a blocking
      // round-trip on every navigation is not.
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
