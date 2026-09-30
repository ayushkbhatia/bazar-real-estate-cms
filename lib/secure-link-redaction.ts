/**
 * Secure links carry their token in the path (docs/mortgage SPEC §8): an
 * applicant's at `/mortgages/r/<token>`, a partner bank's package at
 * `/mortgages/p/<token>`, and the API routes behind them at
 * `/api/mortgage/links/<token>/…` and `/api/mortgage/packages/<token>/…`. The
 * token is the whole secret, so nothing that records URLs may keep it:
 * PostHog (`lib/posthog.tsx`), Vercel Analytics
 * (`app/_consent/analytics-gate.tsx`) and error reporting (`lib/pii-scrub.ts`)
 * pass every URL through this.
 */

const SECURE_LINK = /\/(mortgages\/[rp]|api\/mortgage\/(?:links|packages))\/[^/?#\s]+/g;

/** `…/mortgages/p/<token>?x` → `…/mortgages/p/[token]?x`, anywhere in the string. */
export function redactSecureLinkPaths(value: string): string {
  return value.includes("/mortgage") ? value.replace(SECURE_LINK, "/$1/[token]") : value;
}
