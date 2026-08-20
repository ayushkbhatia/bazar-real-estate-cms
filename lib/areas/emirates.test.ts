import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EMIRATE_SLUGS, emirateMessageKey } from "./emirates";

/**
 * Three components used to carry their own `[{slug, label}]` literal, and all
 * three printed English on /ar. This holds the replacement to the one property
 * that made the bug possible: every slug the map can hold must resolve to a
 * key that actually exists in both catalogues. A key that resolves to nothing
 * renders the dotted path in production and throws nothing — `request.ts` sets
 * `getMessageFallback` to the key and only logs in development.
 */

const MESSAGES = join(import.meta.dirname, "../../messages");

function common(locale: "en" | "ar"): Record<string, unknown> {
  return JSON.parse(readFileSync(join(MESSAGES, locale, "common.json"), "utf8"));
}

function at(bag: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], bag);
}

describe("emirateMessageKey", () => {
  it("resolves every slug the map can hold, in both catalogues", () => {
    for (const locale of ["en", "ar"] as const) {
      const bag = common(locale);
      for (const slug of EMIRATE_SLUGS) {
        const value = at(bag, emirateMessageKey(slug));
        expect(typeof value, `${locale}: ${slug}`).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back to Abu Dhabi for an unknown slug", () => {
    // `area.emirate` arrives from the database, so a third emirate seeded
    // before its label exists must not render a dotted key path.
    expect(emirateMessageKey("sharjah")).toBe("emirates.abuDhabi");
    expect(emirateMessageKey("")).toBe("emirates.abuDhabi");
  });

  it("gives the two emirates different Arabic", () => {
    const ar = common("ar");
    expect(at(ar, "emirates.abuDhabi")).not.toBe(at(ar, "emirates.dubai"));
  });
});
