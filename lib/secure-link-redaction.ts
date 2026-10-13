/**
 * Secure links carry their token in the path (docs/mortgage SPEC §8): an
 * applicant's at `/mortgages/r/<token>` and the API routes behind it at
 * `/api/mortgage/links/<token>/…`. The partner banks' package links
 * (`/mortgages/p/<token>`, `/api/mortgage/packages/<token>/…`) went with the
 * banks in 0156, but links already emailed to banks still carry live-looking
 * tokens, so they stay redacted. The token is the whole secret, so nothing
 * that records URLs may keep it:
 * PostHog (`lib/posthog.tsx`), Vercel Analytics
 * (`app/_consent/analytics-gate.tsx`) and error reporting (`lib/pii-scrub.ts`)
 * pass every URL through this.
 */

const SECURE_LINK = /\/(mortgages\/[rp]|api\/mortgage\/(?:links|packages))\/[^/?#\s]+/g;

/** `…/mortgages/p/<token>?x` → `…/mortgages/p/[token]?x`, anywhere in the string. */
export function redactSecureLinkPaths(value: string): string {
  return value.includes("/mortgage") ? value.replace(SECURE_LINK, "/$1/[token]") : value;
}
