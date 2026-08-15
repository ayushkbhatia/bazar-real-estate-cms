import { NextIntlClientProvider } from "next-intl";
import {
  render,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_LOCALE, type Locale } from "./locales";
import { CLIENT_NAMESPACES, type RouteNamespace } from "./namespaces";

/**
 * `render()` with an intl provider around it.
 *
 * Without this, the first component converted to `useTranslations` **throws**
 * rather than failing an assertion: `use-intl` raises *"No intl context found.
 * Have you configured the provider?"*. `vitest.setup.ts` is six lines and
 * mounts nothing, and no test file anywhere mocks next-intl — so 28 files that
 * render components with `@testing-library/react` are one conversion away from
 * a stack trace that says nothing about the change that caused it.
 *
 * Real messages, read off disk, not fixtures. A fixture would let a test pass
 * against a key that does not exist, which is the same self-certification
 * problem `fold-proofs.test.ts` exists to prevent on the DB side. Reading the
 * catalogue means a renamed key fails the test that renders it.
 *
 * Only `CLIENT_NAMESPACES` are loaded, deliberately — that is exactly what the
 * browser receives at runtime. A component reaching for a namespace outside it
 * should fail here for the same reason it fails in production, rather than
 * passing in tests and rendering a raw key path on the live site.
 *
 * A route-scoped namespace (`ROUTE_NAMESPACES`) is the one exception, and it
 * is passed the same way the route passes it: explicitly, via `namespaces`.
 * That keeps the harness honest in both directions — a component under
 * `/tools` gets `tools` only because its test said so, exactly as it gets it
 * in the browser only because `tools/layout.tsx` said so.
 */

const ROOT = join(import.meta.dirname, "..", "..");

function messagesFor(
  locale: Locale,
  extra: readonly RouteNamespace[] = [],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const ns of [...CLIENT_NAMESPACES, ...extra]) {
    out[ns] = JSON.parse(
      readFileSync(join(ROOT, "messages", locale, `${ns}.json`), "utf8"),
    );
  }
  return out;
}

export function IntlHarness({
  children,
  locale = DEFAULT_LOCALE,
  namespaces = [],
}: {
  children: ReactNode;
  locale?: Locale;
  namespaces?: readonly RouteNamespace[];
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messagesFor(locale, namespaces)}
    >
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * Drop-in for `render()` from @testing-library/react.
 *
 * `locale` defaults to English so an existing test keeps asserting on the same
 * strings. Pass `"ar"` to check that a component survives RTL — which is worth
 * doing for anything that measures, scrolls, or positions. Pass `namespaces`
 * for a component that lives under a route mounting its own bag.
 */
export function renderWithIntl(
  ui: ReactElement,
  options: Omit<RenderOptions, "wrapper"> & {
    locale?: Locale;
    namespaces?: readonly RouteNamespace[];
  } = {},
): RenderResult {
  const { locale = DEFAULT_LOCALE, namespaces, ...rest } = options;
  return render(ui, {
    wrapper: ({ children }) => (
      <IntlHarness locale={locale} namespaces={namespaces}>
        {children}
      </IntlHarness>
    ),
    ...rest,
  });
}
