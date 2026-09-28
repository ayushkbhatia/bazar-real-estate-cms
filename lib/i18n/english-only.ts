/**
 * Paths served in English only, whatever the visitor's language.
 *
 *   - `/admin` — the CMS, permanently (ADR-0007).
 *   - `/mortgages` — the mortgage application flow, for now. SPEC §1 ships it
 *     in English; its Arabic catalogue is a machine draft nobody has approved,
 *     and the consent it shows is legal text (decision D12). Taking it off
 *     this list is the Arabic launch for the flow.
 *
 * Three places ask, and they have to agree or a visitor loops: the proxy
 * redirects `/ar/<path>` back to English and never sends an Arabic-preferring
 * visitor from `<path>` to `/ar/<path>`; `localiseHref` never prefixes a link
 * to one; and `withLocaleRedirects` never gives a redirect to one an `/ar`
 * destination.
 */

export const ENGLISH_ONLY_PREFIXES = ["/admin", "/mortgages"] as const;

/** `/mortgages/apply?service=x` → true. Takes an unprefixed path; query and hash are ignored. */
export function isEnglishOnlyPath(path: string): boolean {
  const cut = path.search(/[?#]/);
  const pathname = cut === -1 ? path : path.slice(0, cut);
  return ENGLISH_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
