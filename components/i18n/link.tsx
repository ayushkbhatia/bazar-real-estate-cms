"use client";

/**
 * `next/link`, with the current locale kept.
 *
 * ## Why this exists
 *
 * Every internal href in this codebase is written absolute and English —
 * `/insights`, `/p/${slug}`, `/services/sell`. That was correct while one
 * locale was served and it silently became a bug the day `LOCALES` grew:
 * the locale lives in the URL, so a link that omits it is a link back to
 * English. On `/ar/buy` that was 46 of 56 internal links. A visitor who
 * switched to Arabic had to switch again on every single page.
 *
 * Rewriting 94 files' worth of hrefs by hand is the version of this fix that
 * rots — the 95th href, added next sprint, would be English again. So the
 * prefix is applied at the one place every href already passes through, and
 * `lib/i18n/no-bare-link.test.ts` fails the build if a public file imports
 * `next/link` directly again.
 *
 * ## Why the locale comes from `usePathname`, not `useLocale`
 *
 * next-intl's `useLocale()` would be the obvious source and it is the wrong
 * one here: in a Client Component it reads `NextIntlClientProvider`, and this
 * component is imported by files that render *above* that provider
 * (`app/[locale]/layout.tsx` itself) and outside it (`not-found`, the consent
 * banner). Those would throw. The visitor-facing pathname is available
 * everywhere, needs no provider, and is by definition the authority on which
 * locale is being served — the locale IS the URL.
 *
 * `usePathname` is also safe for prerendering, unlike `useSearchParams`: it
 * does not opt the subtree out of static rendering, which matters because
 * this component ends up in the shared public chrome, i.e. on all ~234
 * prerendered routes. `npm run check:routes` is what would catch a
 * regression there.
 *
 * ## English is byte-identical
 *
 * `localiseHref` returns the href untouched for the default locale, so every
 * English page renders exactly the HTML it rendered before. That is what
 * makes a 94-file swap a safe single pass rather than a staged migration.
 */

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef } from "react";

import { DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { localeFromPathname, localiseHref } from "@/lib/i18n/routing";

type NextLinkProps = React.ComponentPropsWithoutRef<typeof NextLink>;

const Link = forwardRef<HTMLAnchorElement, NextLinkProps>(function Link(
  { href, ...props },
  ref,
) {
  const pathname = usePathname();
  // Null pathname happens in error boundaries, where English is the right
  // answer and a thrown hook would replace one broken page with a blank one.
  const locale = localeFromPathname(pathname ?? "/") ?? DEFAULT_LOCALE;

  return (
    <NextLink
      ref={ref}
      // A `UrlObject` href is passed through untouched. Nothing in the repo
      // uses that form today (checked: zero `href={{`), and guessing at the
      // right place to inject a segment into one is worse than leaving it to
      // whoever writes the first.
      href={typeof href === "string" ? localiseHref(href, locale) : href}
      {...props}
    />
  );
});

export default Link;
