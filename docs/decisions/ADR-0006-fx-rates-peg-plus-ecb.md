# ADR-0006: FX rates — hardcode the peg, fetch only what floats

**Status:** Accepted
**Date:** 2026-08-10
**Supersedes:** the `NEXT_PUBLIC_FX_USD_PER_AED` env var (removed from use)

## Context

The public site lets a visitor view prices in AED, USD or EUR. Every price in
the schema is stored in AED, so the display layer needs AED → X rates.

Before this ADR both rates were constants in `lib/preferences/rates.ts`:

| Currency | Old value | Correct value | Error |
|---|---|---|---|
| USD | `0.272` (env-overridable) | `1 / 3.6725 = 0.2722940` | 0.08% low |
| EUR | `0.25` (hardcoded) | ≈ `0.2361` at ECB 2026-08-07 | **5.9% high** |

The two errors have different characters, and that difference drives the
decision:

- **USD is not a rate.** The AED has been pegged to the dollar at
  **3.6725 AED/USD** since 1997. There is nothing to fetch, and nothing to
  configure. Storing a rounded 0.272 in an env var made a constant look like a
  tunable, and shipped a number that was simply wrong in the last digit.
- **EUR is a rate.** The euro floats against the dollar, so EUR/AED moves every
  day. A hardcoded 0.25 doesn't just start wrong — it silently drifts further
  wrong forever, with nothing to signal it.

The CBUAE publishes the authoritative AED cross-rates at
<https://www.centralbank.ae/en/forex-eibor/exchange-rates/>.

## Decision

**USD:** a constant, `USD_PER_AED = 1 / 3.6725`, exported from
`lib/preferences/rates.ts`. `getRate("USD")` returns it unconditionally — a
live quote cannot displace it even if one is supplied. `NEXT_PUBLIC_FX_USD_PER_AED`
is no longer read.

**EUR:** fetched daily from the **ECB** euro reference rates feed
(`eurofxref-daily.xml`), and derived as
`EUR per AED = (1 / 3.6725) / (USD per EUR)`.

### Why not scrape centralbank.ae

It is the right *source of truth*, and the wrong *integration*:

1. The page sits behind a Cloudflare interstitial. A server-side `fetch` from
   Vercel returns the "Just a moment..." challenge HTML, not the rate table.
   (Verified while writing this ADR.)
2. There is no JSON API. Rates come from an Umbraco surface controller
   (`/umbraco/Surface/Exchange/GetExchangeRateAllCurrencyDate`) that returns
   unversioned HTML.
3. A scraper against unversioned markup fails *silently* — it returns a
   plausible-looking stale number rather than an error.

The CBUAE derives its own EUR figure from the same peg and the same market
EUR/USD, so the ECB feed reproduces it to within rounding. The ECB endpoint is
key-less, documented, stable, and intended for exactly this use.

### Why no cron and no `fx_rates` table

The upstream `fetch` is wrapped in Next's data cache with a 24-hour
`revalidate`, and served through `/api/fx` (1h route cache, 24h
stale-while-revalidate). The upstream is hit at most once a day per region.

This deliberately avoids the project's known cron gap (see `docs/FOLLOWUPS.md`
— the 7 scheduled jobs have never run in production). A cron writing to a DB
column fails *quietly*: the column keeps its last value and the site keeps
serving it. The cache approach fails *loudly enough* — a failed refresh falls
straight through to `STATIC_RATES`, which is documented as approximate.

### Failure behaviour

`fetchFxRates()` never throws. On timeout, non-200, parse failure, or an
EUR/USD outside the sanity band 0.7–2.0, it returns `staticFxRates()` with
`source: "static"`. `PreferencesProvider` fetches `/api/fx` once per document
and pushes the result into the rates module via `setLiveRates`; until then —
and during SSR, which always renders the AED default anyway — the static
fallback is used. Non-finite or non-positive values in the payload are dropped
rather than stored.

## Consequences

- EUR display prices are accurate to the day instead of ~6% out.
- USD is exact and no longer configurable, which is correct: it is a peg.
- One new public endpoint (`/api/fx`), no new table, no new cron, no new key.
- If the peg is ever revalued (it has not moved since 1997), `AED_PER_USD` in
  `lib/preferences/rates.ts` is the single line to change.
- Adding a fourth currency means adding it to the ECB parse and to `Currency` —
  the derivation via EUR/X already generalises.
- `NEXT_PUBLIC_FX_USD_PER_AED` is now unread. It stays declared in `lib/env.ts`
  (a shared file) until someone is cleaning that up anyway; see
  `docs/FOLLOWUPS.md`.
