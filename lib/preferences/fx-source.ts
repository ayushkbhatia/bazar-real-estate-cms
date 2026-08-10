import "server-only";

/**
 * Server-side source for the one FX rate that actually floats: EUR.
 *
 * ## Why not scrape centralbank.ae
 *
 * The CBUAE publishes its rates at
 * https://www.centralbank.ae/en/forex-eibor/exchange-rates/ — the canonical
 * reference for AED cross-rates. It is not machine-readable: the page sits
 * behind a Cloudflare interstitial (a server-side fetch returns the
 * "Just a moment..." challenge, not the table), the rates are injected by an
 * Umbraco surface controller that returns HTML rather than JSON, and the
 * markup is unversioned. Any scraper we wrote would fail silently the first
 * time either changes.
 *
 * The CBUAE derives its EUR figure the same way we do — from the USD peg and
 * the market EUR/USD — so the ECB's published reference rate reproduces it to
 * within rounding. The ECB feed is a stable, key-less, documented XML endpoint
 * intended for exactly this use.
 *
 * ## Why no cron and no table
 *
 * `fetch` is wrapped in Next's data cache with a 24h revalidate, so the
 * upstream is hit at most once a day per region and the value survives cold
 * starts. That deliberately avoids the project's known cron gap (see
 * docs/FOLLOWUPS.md) — a failed refresh here degrades to `STATIC_RATES`
 * instead of leaving a DB column stale with nothing watching it.
 */

import { STATIC_RATES, USD_PER_AED, type FxRates } from "./rates";

const ECB_DAILY_XML =
  "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

const ONE_DAY_SECONDS = 60 * 60 * 24;

/** `<Cube time='2026-08-07'>` → 2026-08-07 */
const TIME_RE = /<Cube\s+time=['"]([\d-]+)['"]/;
/** `<Cube currency='USD' rate='1.1535'/>` → 1.1535 */
const USD_RE = /<Cube\s+currency=['"]USD['"]\s+rate=['"]([\d.]+)['"]/;

/**
 * Parse the ECB daily reference feed into AED-denominated rates.
 *
 * The feed is quoted as "units of X per 1 EUR", so the USD line is USD/EUR.
 * EUR per AED = (USD per AED) / (USD per EUR).
 *
 * Exported for tests — it is pure, and the network call is the only part
 * worth stubbing.
 */
export function parseEcbDaily(xml: string): FxRates | null {
  const usdPerEur = Number(xml.match(USD_RE)?.[1]);
  if (!Number.isFinite(usdPerEur) || usdPerEur <= 0) return null;

  // Sanity band. EUR/USD has not left 0.7–2.0 in the euro's lifetime; a value
  // outside it means we parsed something that is not a rate.
  if (usdPerEur < 0.7 || usdPerEur > 2) return null;

  const asOf = xml.match(TIME_RE)?.[1];
  if (!asOf) return null;

  return {
    rates: {
      AED: 1,
      USD: USD_PER_AED,
      EUR: USD_PER_AED / usdPerEur,
    },
    as_of: asOf,
    source: "ecb",
  };
}

/** What we serve when the upstream is unreachable or unparseable. */
export function staticFxRates(): FxRates {
  return { rates: { ...STATIC_RATES }, as_of: "static", source: "static" };
}

/**
 * Fetch today's rates. Never throws — callers get `staticFxRates()` on any
 * failure so a dead upstream cannot take a page down.
 */
export async function fetchFxRates(): Promise<FxRates> {
  try {
    const res = await fetch(ECB_DAILY_XML, {
      next: { revalidate: ONE_DAY_SECONDS },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return staticFxRates();
    return parseEcbDaily(await res.text()) ?? staticFxRates();
  } catch {
    return staticFxRates();
  }
}
