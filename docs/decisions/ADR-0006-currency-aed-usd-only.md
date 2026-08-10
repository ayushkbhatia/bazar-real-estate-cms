# ADR-0006: Currency is AED and USD only — no floating rates, no FX fetching

**Status:** Accepted
**Date:** 2026-08-10
**Supersedes:** the `NEXT_PUBLIC_FX_USD_PER_AED` env var (no longer read)

## Context

The public site lets a visitor view prices in a currency other than the one
the schema stores. Every price is stored in AED, so the display layer needs
AED → X rates.

The preferences layer originally offered AED, USD and EUR, with both rates as
constants in `lib/preferences/rates.ts`:

| Currency | Value shipped | Correct value | Error |
|---|---|---|---|
| USD | `0.272`, env-overridable | `1 / 3.6725 = 0.2722940` | 0.08% low |
| EUR | `0.25` hardcoded | ≈ `0.2361` (ECB 2026-08-07) | **5.9% high** |

A comment in that file noted that a daily cron to refresh them had once
existed but "only ever wrote to module memory that nothing read", and was
deleted rather than wired up. So there was no refresh mechanism at all.

The two currencies are not the same kind of problem:

- **USD is a peg, not a rate.** The AED has been fixed at 3.6725 AED/USD since
  1997. There is nothing to fetch and nothing to configure. Shipping a rounded
  `0.272` in an env var made a constant look like a tunable *and* got the last
  digit wrong.
- **EUR is a rate.** The euro floats against the dollar. A hardcoded figure
  does not merely start wrong — it drifts further wrong every day, silently,
  with nothing to signal it.

## Decision

**The site offers AED and USD. EUR is removed.**

`USD_PER_AED` is the exact reciprocal of the peg, and it is the only
conversion the site performs. `Currency` is `"AED" | "USD"`.

### Why EUR is out rather than fixed

EUR *was* fixed first: a working implementation fetched the ECB daily
reference rates, derived `EUR per AED = (1 / 3.6725) / (USD per EUR)`, cached
it for 24h behind `/api/fx`, and fell back to a static constant on failure.
It was accurate and it worked.

It was removed anyway, because supporting one floating currency means owning
all of this permanently:

- an outbound dependency on a third party, on the render path
- a staleness question with no good answer (a rate is either live, which
  costs a fetch, or cached, which means a number that is quietly out of date)
- a "what do we show when the fetch fails" story
- a rounding and as-of-date story if a figure is ever quoted back to a client

None of that buys anything on a marketplace that prices, contracts, and
settles in AED. The euro figure is decorative; the complexity behind it is
not. Dropping it makes the whole FX layer disappear: no fetch, no route, no
cache, no fallback, no ADR-shaped caveats — two constants and a multiply.

USD survives because it is free. It is a peg, so it carries none of the above.

### Why not centralbank.ae, if a floating currency is ever added

Recorded here so the next person does not repeat the investigation. The
CBUAE publishes the authoritative AED cross-rates at
<https://www.centralbank.ae/en/forex-eibor/exchange-rates/>. It is the right
*source of truth* and the wrong *integration*:

1. The page sits behind a Cloudflare interstitial — a server-side `fetch`
   returns the "Just a moment..." challenge HTML, not the rate table.
2. There is no JSON API. Rates come from an Umbraco surface controller
   (`/umbraco/Surface/Exchange/GetExchangeRateAllCurrencyDate`) returning
   unversioned HTML.
3. A scraper against unversioned markup fails *silently* — it keeps returning
   a plausible-looking stale number rather than an error.

The ECB daily reference feed (`eurofxref-daily.xml`) is the practical source:
key-less, documented, stable, and quoted per EUR, so any currency derives
through the peg as `X per AED = (1 / 3.6725) / (X per USD)`. The CBUAE derives
its own cross-rates the same way, so the two agree to rounding.

## Consequences

- USD is exact and no longer configurable, which is correct for a peg.
- No outbound FX dependency, no `/api/fx` route, no cron, no table, no key.
- `isCurrency("EUR")` is now false, so a visitor holding a `bz_prefs=c=EUR`
  cookie from the brief window it was live decodes to the AED default rather
  than an unrenderable state. Covered by a test.
- Adding a third currency is a real project, not a config line — which is the
  honest signal. Start from the ECB derivation above.
- If the peg is ever revalued (it has not moved since 1997), `AED_PER_USD` in
  `lib/preferences/rates.ts` is the single line to change.
- `NEXT_PUBLIC_FX_USD_PER_AED` is now unread. It stays declared in
  `lib/env.ts` (a shared file) until someone is cleaning that up anyway; see
  `docs/FOLLOWUPS.md`.
