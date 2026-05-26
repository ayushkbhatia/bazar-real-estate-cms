/**
 * T1-B cleanup: daily FX-rates refresh cron.
 *
 * Pulls EUR/USD vs AED from the European Central Bank's free
 * reference-rate feed and updates the in-memory cache. ECB rates are
 * EUR-quoted so we triangulate: USD/AED via USD/EUR × EUR/AED; the
 * AED/EUR base comes from ECB directly.
 *
 * Scheduled in `vercel.json` at 06:00 UTC daily. Idempotent. Bearer
 * secret-gated. Falls back gracefully when ECB is unreachable.
 *
 * v1 caches in module memory + a JSON cache row. A persistent
 * `fx_rates` table can land later if we need cross-process freshness;
 * the popover's static fallback in `lib/preferences/rates.ts` is the
 * runtime safety net.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ECB_DAILY =
  "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

// Module-memory cache. Vercel function instances cycle frequently in
// prod so this is best-effort — visitors get the curated env-driven
// fallback when this is cold.
let lastRefreshed: string | null = null;
let cachedAedPerEur: number | null = null;
let cachedAedPerUsd: number | null = null;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!env.CRON_SECRET) {
    if (env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 },
      );
    }
  } else if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(ECB_DAILY, {
      headers: { Accept: "application/xml" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `ECB feed ${res.status}` },
        { status: 502 },
      );
    }
    const xml = await res.text();
    // ECB feed shape:
    //   <Cube currency='USD' rate='1.0853'/>
    //   <Cube currency='AED' rate='3.985'/>
    // Where 1 EUR = `rate` of the listed currency.
    const usdMatch = /currency=['"]USD['"]\s+rate=['"]([\d.]+)['"]/.exec(xml);
    const aedMatch = /currency=['"]AED['"]\s+rate=['"]([\d.]+)['"]/.exec(xml);
    const usdPerEur = usdMatch ? Number(usdMatch[1]) : null;
    const aedPerEur = aedMatch ? Number(aedMatch[1]) : null;
    if (!usdPerEur || !aedPerEur) {
      return NextResponse.json(
        { ok: false, error: "Could not parse ECB feed" },
        { status: 502 },
      );
    }
    // Triangulate AED/USD = AED/EUR ÷ USD/EUR
    const aedPerUsd = aedPerEur / usdPerEur;
    cachedAedPerEur = aedPerEur;
    cachedAedPerUsd = aedPerUsd;
    lastRefreshed = new Date().toISOString();
    return NextResponse.json({
      ok: true,
      refreshed_at: lastRefreshed,
      aed_per_eur: aedPerEur,
      aed_per_usd: aedPerUsd,
      usd_per_aed: 1 / aedPerUsd,
      eur_per_aed: 1 / aedPerEur,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 },
    );
  }
}

/** Public read for the preferences module — returns null when the cron
 *  hasn't run yet (or the cache instance is fresh). */
export function readCachedRates(): {
  aed_per_eur: number;
  aed_per_usd: number;
  refreshed_at: string;
} | null {
  if (cachedAedPerEur && cachedAedPerUsd && lastRefreshed) {
    return {
      aed_per_eur: cachedAedPerEur,
      aed_per_usd: cachedAedPerUsd,
      refreshed_at: lastRefreshed,
    };
  }
  return null;
}
