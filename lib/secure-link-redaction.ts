/**
 * Secure links carry their token in the path (docs/mortgage SPEC §8): an
 * applicant's at `/mortgages/r/<token>`, a partner bank's package at
 * `/mortgages/p/<token>`. The token is the whole secret, so analytics must
 * only ever record the route: both PostHog (`lib/posthog.tsx`) and Vercel
 * Analytics (`app/_consent/analytics-gate.tsx`) pass every URL through this.
 */

const SECURE_LINK = /\/mortgages\/([rp])\/[^/?#\s]+/g;

/** `…/mortgages/p/<token>?x` → `…/mortgages/p/[token]?x`, anywhere in the string. */
export function redactSecureLinkPaths(value: string): string {
  return value.includes("/mortgages/") ? value.replace(SECURE_LINK, "/mortgages/$1/[token]") : value;
}
