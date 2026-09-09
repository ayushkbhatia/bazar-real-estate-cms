import type { NextConfig } from "next";
import { DEFAULT_LOCALE, LOCALES } from "./locales";
import { isNonLocalisedPath } from "./non-localised";

/**
 * Give every redirect a twin under each non-default locale prefix.
 *
 * ## The hole this closes
 *
 * `redirects()` matches on the literal pathname, before routing, and every
 * rule in this repo was written when `/buy` was the only spelling of `/buy`.
 * The locale segment landed in P1 and none of them grew one, so:
 *
 * ```
 * /communities/yas-island      308 → /areas/yas-island
 * /ar/communities/yas-island   404
 * ```
 *
 * Same for `/contact-us`, `/blog`, `/sign-in`, and all ~90 WordPress paths in
 * `lib/legacy-redirects.ts`: the entire redirect map was English-only. Found
 * on production 2026-09-09, reached from the Arabic footer — whose rows still
 * carry the pre-rename `/communities` href, which English survives on the
 * redirect and Arabic does not.
 *
 * Generating the twins rather than hand-writing them is the point. A rule
 * added next sprint gets its `/ar` half for free, and a locale added after
 * that gets the whole map for free — which is the failure mode that produced
 * this bug in the first place.
 *
 * ## Why the destination is not blindly prefixed
 *
 * Three kinds of destination must stay unprefixed, and sending a visitor to a
 * locale-prefixed version of any of them is a second 404 or a second hop:
 *
 *   - **Non-localised routes** (`lib/i18n/non-localised.ts`) — `/api/*`,
 *     `/sold/*`, `/sso/*` and friends live outside `[locale]` by contract.
 *   - **`/admin`** — the CMS is English-only (ADR-0007) and `proxy.ts`
 *     bounces `/ar/admin` straight back out, so `/ar/sign-in` → `/ar/admin/login`
 *     would redirect twice to reach where one hop already goes.
 *   - **Absolute URLs** — another origin has no locale of ours.
 *
 * Everything else is a page under `[locale]`, and its twin keeps the reader in
 * the language they were reading. That is the whole reason to generate the
 * twin rather than point it at the English page: a visitor who clicks an
 * Arabic link should not be switched to English by a redirect.
 */

/** One entry of `redirects()`, from the config type. See `lib/legacy-redirects.ts`. */
type Redirect = Awaited<
  ReturnType<NonNullable<NextConfig["redirects"]>>
>[number];

/** True for a destination that must never gain a locale segment. */
function staysUnprefixed(destination: string): boolean {
  // Absolute, protocol-relative, or anything that is not a path of ours.
  if (!destination.startsWith("/") || destination.startsWith("//")) return true;
  if (isNonLocalisedPath(destination)) return true;
  return destination === "/admin" || destination.startsWith("/admin/");
}

export function localiseDestination(
  destination: string,
  locale: string,
): string {
  return staysUnprefixed(destination)
    ? destination
    : `/${locale}${destination}`;
}

/**
 * The rules as given, followed by one prefixed copy per non-default locale.
 *
 * Relative order is preserved inside each locale's block, which matters: the
 * WordPress map is deliberately last so its catch-alls cannot shadow a rule
 * above it, and the `/contact-us/qr` rule is deliberately before `/contact-us`.
 * Prefixed sources can never collide with bare ones, so the blocks are
 * independent of each other.
 */
export function withLocaleRedirects(rules: Redirect[]): Redirect[] {
  const twins = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).flatMap(
    (locale) =>
      rules.map((rule) => ({
        ...rule,
        source: `/${locale}${rule.source}`,
        destination: localiseDestination(rule.destination, locale),
      })),
  );
  return [...rules, ...twins];
}
