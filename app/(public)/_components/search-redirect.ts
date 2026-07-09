import { filterParsers } from "@/lib/filters/property";

/**
 * Keys that mean "the visitor is running a search", not just landing on the
 * marketing page. When any of these is present on a landing route (/buy,
 * /rent, /off-plan) we bounce to the `…/search` sub-route so old deep-links
 * (e.g. /buy?type=apartment) keep working after the search relocation.
 * Non-filter params (utm_*, ref, etc.) are ignored so campaign links still
 * land on the marketing page.
 */
const FILTER_KEYS = new Set<string>([...Object.keys(filterParsers), "view"]);

export function searchRedirectTarget(
  base: string,
  raw: Record<string, string | string[] | undefined>,
): string | null {
  const keys = Object.keys(raw);
  if (!keys.some((k) => FILTER_KEYS.has(k))) return null;

  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => usp.append(k, x));
    else usp.append(k, v);
  }
  const qs = usp.toString();
  return `${base}/search${qs ? `?${qs}` : ""}`;
}
