/**
 * G-18 — the store and the message catalogue must not disagree.
 *
 * `messages.test.ts` asserts that the same English gives the same Arabic
 * *within* the catalogue, and its own docblock calls that the strongest check
 * in the suite: it is the only one that can see a fluent mistake, and its first
 * run caught six already-merged defects. It has never reached across to
 * `ARABIC_STORE`, which is a second source of Arabic for the same site.
 *
 * That was survivable while the store only fed master-page sections and form
 * copy. It is not any more: `localiseRow` now resolves a blank `_ar` twin
 * through the store, so the store feeds every flat column as well. A single
 * page can render "Location" as الموقع in its chrome (catalogue) and موقع in a
 * data field (store) — same English, two Arabics, one screen.
 *
 * 36 such disagreements existed when this landed, including Location, Back,
 * Category and a whole valuation-gate form. They were reconciled toward the
 * CATALOGUE, which is the more curated of the two: it went through the
 * extraction waves and human review, where the store is machine output by
 * construction (`by: "machine"` on all 2,237 original entries).
 *
 * Precedence, so the next person does not have to guess: **the catalogue
 * wins.** If a string lives in both, change the catalogue and let the store
 * follow.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ARABIC_STORE } from "./arabic-store";

const MESSAGES = join(import.meta.dirname, "../../messages");

/** `{a: {b: "x"}}` → `{"a.b": "x"}`, matching next-intl's key paths. */
function flatten(
  value: unknown,
  out: Record<string, string> = {},
  prefix = "",
): Record<string, string> {
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === "string") out[path] = entry;
    else if (entry && typeof entry === "object") flatten(entry, out, path);
  }
  return out;
}

function catalogue(locale: "en" | "ar"): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of readdirSync(join(MESSAGES, locale))) {
    Object.assign(
      out,
      flatten(JSON.parse(readFileSync(join(MESSAGES, locale, file), "utf8"))),
    );
  }
  return out;
}

describe("G-18 · the store agrees with the catalogue", () => {
  const en = catalogue("en");
  const ar = catalogue("ar");

  it("gives one Arabic per English across both sources", () => {
    const clashes: string[] = [];
    for (const [key, english] of Object.entries(en)) {
      const stored = ARABIC_STORE[english.trim()];
      const translated = ar[key];
      if (!stored || !translated) continue;
      if (stored.ar.trim() !== translated.trim()) {
        clashes.push(
          `${key}\n    English:   ${english}\n    catalogue: ${translated}\n    store:     ${stored.ar}`,
        );
      }
    }

    expect(
      clashes,
      `The catalogue and ARABIC_STORE give different Arabic for the same ` +
        `English. Both render on the same page — the catalogue in the chrome, ` +
        `the store behind any blank _ar twin — so a visitor sees two ` +
        `translations of one phrase.\n\nThe catalogue wins: copy its value ` +
        `into lib/master-pages/arabic/master.json.\n\n${clashes.join("\n\n")}`,
    ).toEqual([]);
  });

  it("scans a believable number of strings", () => {
    // Guards the shape of the check itself: a flatten that returned nothing
    // would make the assertion above vacuously true.
    expect(Object.keys(en).length).toBeGreaterThan(900);
    expect(Object.keys(ARABIC_STORE).length).toBeGreaterThan(2000);
  });
});
