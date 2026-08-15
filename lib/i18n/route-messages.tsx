import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import type { Locale } from "./locales";
import {
  pickClientMessages,
  type RouteNamespace,
} from "./namespaces";

/**
 * A namespace that crosses to the browser only on the routes that need it.
 *
 * `app/[locale]/layout.tsx:194` serialises `CLIENT_NAMESPACES` into the flight
 * payload of *every* route. That is the right default — `nav`, `listing`,
 * `search` and the rest are read on most pages, and a per-route calculation
 * would cost more than it saves.
 *
 * It stops being right at the size of a calculator. `tools` is ~400 keys of
 * mortgage and valuation copy; on the root list it rides along on the home
 * page, on `/buy`, on every article, on all 78 prerendered routes, and is read
 * on four. That is the exact failure `lib/i18n/namespaces.ts` was written to
 * prevent, arriving from the other direction: not a namespace that fails to
 * cross, but one that crosses everywhere.
 *
 * So the route mounts its own provider.
 *
 * ## Why the full bag and not just the extra
 *
 * A nested `NextIntlClientProvider` **replaces** the message bag; it does not
 * merge with the one above it. From `use-intl`'s provider:
 *
 * ```js
 * messages: void 0 === i ? w?.messages : i
 * ```
 *
 * The parent's messages are read only when the child passes `undefined`. Pass
 * `{tools}` alone and every `useTranslations("nav")` inside the subtree — the
 * mega-nav, the footer, the cookie banner — resolves to nothing and renders
 * its own dotted key path, silently, because `request.ts` sets
 * `getMessageFallback` to the key and only logs in development.
 *
 * Hence `pickClientMessages(all)` plus the extras: the same base every other
 * route gets, widened for this subtree only. The duplicate base costs one
 * serialisation of ~120 keys on four routes, against ~400 keys on all 78.
 *
 * `locale` is passed explicitly rather than left ambient, for the reason every
 * `getTranslations` call in this codebase does: without it `getLocale()` falls
 * through to `headers()`, which makes the segment dynamic and discards the
 * `revalidate` export. `scripts/ci/assert-static-routes.mjs` catches that, and
 * has caught it repeatedly.
 */
export async function RouteMessages({
  locale,
  namespaces,
  children,
}: {
  locale: Locale;
  namespaces: readonly RouteNamespace[];
  children: ReactNode;
}) {
  const all = await getMessages({ locale });
  const messages: Record<string, unknown> = pickClientMessages(all);
  for (const ns of namespaces) {
    if (ns in all) messages[ns] = (all as Record<string, unknown>)[ns];
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
