/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_LOCALES } from "./locales";
import {
  CLIENT_NAMESPACES,
  NAMESPACES,
  ROUTE_NAMESPACES,
  pickClientMessages,
} from "./namespaces";

/**
 * Two failures this file exists to make loud, both of which render a broken
 * page in production while throwing nothing.
 *
 * `request.ts` sets `getMessageFallback` to the dotted key path and `onError`
 * to log only in development. So a message next-intl cannot resolve renders as
 * the literal string `tools.heading` on the live site — no exception, no Sentry
 * event, no failing test. The two ways to get there:
 *
 *  1. A namespace file exists under `messages/` but is not in `NAMESPACES`, so
 *     it is never loaded. This was the live state: the list was hardcoded in
 *     `request.ts` while `messages.test.ts` discovered namespaces by reading
 *     the directory, so adding a file passed CI and was invisible to the app.
 *
 *  2. A Client Component reads a namespace that is not in `CLIENT_NAMESPACES`,
 *     so it never crossed into the RSC payload. This one only became possible
 *     with the narrowed `messages` prop — the previous behaviour shipped
 *     everything, which was safe and unaffordable.
 */

const REPO_ROOT = join(import.meta.dirname, "..", "..");

function sourceFiles(): string[] {
  return execFileSync(
    "git",
    ["ls-files", "app/**/*.tsx", "components/**/*.tsx", "lib/**/*.tsx"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean);
}

/** `useTranslations("x")` / `getTranslations("x")` / `getTranslations({namespace:"x"})`. */
const NS_CALL_RE =
  /\b(?:useTranslations|getTranslations)\s*\(\s*(?:\{[^}]*namespace\s*:\s*)?["'`]([\w-]+)["'`]/g;

describe("message namespaces", () => {
  it("loads every namespace file that exists on disk", () => {
    for (const locale of ALL_LOCALES) {
      const onDisk = readdirSync(join(REPO_ROOT, "messages", locale))
        .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
        .map((f) => f.replace(/\.json$/, ""))
        .sort();

      expect(
        onDisk,
        `messages/${locale} and NAMESPACES in lib/i18n/namespaces.ts disagree. ` +
          `A file that is not in NAMESPACES is never loaded, and every key in ` +
          `it renders as its own dotted path on the live site.`,
      ).toEqual([...NAMESPACES].sort());
    }
  });

  it("keeps the client subset inside the full list", () => {
    for (const ns of CLIENT_NAMESPACES) {
      expect(NAMESPACES as readonly string[]).toContain(ns);
    }
  });

  /**
   * The guard that makes the narrowed `messages` prop safe to keep narrow.
   *
   * Adding a namespace to `CLIENT_NAMESPACES` costs bytes on all 78
   * prerendered routes, so the answer to a failure here is usually *"move the
   * component to `getTranslations`"*, not *"widen the list"*. The public tree
   * is 184 server components to 86 client ones — the server path is the
   * default, not the exception.
   */
  it("ships every namespace a Client Component reads", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles()) {
      const src = readFileSync(join(REPO_ROOT, file), "utf8");
      // Only "use client" files pull from the serialised payload. A server
      // component reading the same namespace costs the browser nothing.
      if (!/^\s*["']use client["']/m.test(src)) continue;

      for (const [, ns] of src.matchAll(NS_CALL_RE)) {
        if ((CLIENT_NAMESPACES as readonly string[]).includes(ns!)) continue;
        // A route-scoped namespace is mounted by one segment's layout, so it
        // is legal inside that segment and nowhere else.
        const prefixes: readonly string[] =
          ROUTE_NAMESPACES[ns as keyof typeof ROUTE_NAMESPACES] ?? [];
        if (prefixes.some((p) => file.startsWith(p))) continue;
        offenders.push(`${file} → "${ns}"`);
      }
    }

    expect(
      [...new Set(offenders)].sort(),
      `These Client Components read a namespace that is not serialised to the ` +
        `browser, so every key in them renders as its dotted path:\n` +
        `${[...new Set(offenders)].sort().join("\n")}\n\n` +
        `Prefer moving the component to a Server Component with ` +
        `getTranslations. Only add to CLIENT_NAMESPACES when it genuinely ` +
        `needs to be interactive — it costs bytes on all 78 prerendered ` +
        `routes. For a large namespace read by one route family, add it to ` +
        `ROUTE_NAMESPACES and mount <RouteMessages> in that segment's layout.`,
    ).toEqual([]);
  });

  /**
   * The half that catches the mistake nobody would spot in review.
   *
   * A route-scoped namespace lives or dies on a layout mounting it. Delete
   * that layout, move the segment, or add a prefix to `ROUTE_NAMESPACES` and
   * forget the layout, and every key under it renders as `tools.monthlyPayment`
   * on the live site — no exception, no Sentry event, no failing test.
   */
  it("mounts every route-scoped namespace in the segment that claims it", () => {
    const layouts = new Map(
      sourceFiles()
        .filter((f) => /\/layout\.tsx$/.test(f))
        .map((f) => [f, readFileSync(join(REPO_ROOT, f), "utf8")] as const),
    );

    const missing: string[] = [];
    for (const [ns, prefixes] of Object.entries(ROUTE_NAMESPACES)) {
      for (const prefix of prefixes as readonly string[]) {
        const mounted = [...layouts].some(
          ([file, src]) =>
            file.startsWith(prefix) &&
            /<RouteMessages\b/.test(src) &&
            new RegExp(`["']${ns}["']`).test(src),
        );
        if (!mounted) missing.push(`${prefix} → "${ns}"`);
      }
    }

    expect(
      missing.sort(),
      `ROUTE_NAMESPACES promises these segments mount a namespace, and no ` +
        `layout under them does:\n${missing.sort().join("\n")}\n\n` +
        `Add a layout.tsx that renders <RouteMessages namespaces={[…]}> — ` +
        `without it every key in the namespace renders as its own dotted key ` +
        `path on the live site and nothing throws.`,
    ).toEqual([]);
  });

  it("keeps route-scoped namespaces off the global client list", () => {
    // Both lists is not a contradiction the code would catch — it would just
    // silently pay the global cost while looking scoped.
    for (const ns of Object.keys(ROUTE_NAMESPACES)) {
      expect(CLIENT_NAMESPACES as readonly string[]).not.toContain(ns);
      expect(NAMESPACES as readonly string[]).toContain(ns);
    }
  });

  it("scans a believable number of files", () => {
    // Guards against the glob silently matching nothing, which would make
    // every assertion above vacuously true.
    expect(sourceFiles().length).toBeGreaterThan(400);
  });
});

describe("pickClientMessages", () => {
  it("keeps only the client namespaces", () => {
    const picked = pickClientMessages({
      common: { a: "1" },
      consent: { d: "4" },
      search: { e: "5" },
      property: { f: "6" },
      development: { g: "7" },
      editorial: { h: "8" },
      nav: { b: "2" },
      listing: { c: "3" },
    });
    expect(Object.keys(picked)).toEqual([...CLIENT_NAMESPACES]);
    expect(picked.common).toEqual({ a: "1" });
  });

  it("omits a client namespace that is absent rather than writing undefined", () => {
    // `undefined` in the bag would serialise as a key with no value and make
    // next-intl's own error message point at the wrong thing.
    // `footer` is the one namespace that never crosses — everything else is
    // read by a Client Component somewhere.
    const picked = pickClientMessages({ footer: { b: "2" } });
    expect(Object.keys(picked)).toEqual([]);
  });
});
