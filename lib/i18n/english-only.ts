/**
 * Paths served in English only, whatever the visitor's language.
 *
 *   - `/admin` — the CMS, permanently (ADR-0007).
 *
 * The mortgage application flow (`/mortgages`) was on this list until its
 * Arabic launched (decision D12, 22 Oct 2026): `/ar/mortgages/…` now serves
 * the flow in Arabic, and a link from an /ar page leads there.
 *
 * Three places ask, and they have to agree or a visitor loops: the proxy
 * redirects `/ar/<path>` back to English and never sends an Arabic-preferring
 * visitor from `<path>` to `/ar/<path>`; `localiseHref` never prefixes a link
 * to one; and `withLocaleRedirects` never gives a redirect to one an `/ar`
 * destination.
 */

export const ENGLISH_ONLY_PREFIXES = ["/admin"] as const;

/** `/admin/enquiries?x=1` → true. Takes an unprefixed path; query and hash are ignored. */
export function isEnglishOnlyPath(path: string): boolean {
  const cut = path.search(/[?#]/);
  const pathname = cut === -1 ? path : path.slice(0, cut);
  return ENGLISH_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
