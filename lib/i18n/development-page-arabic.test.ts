import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ARABIC_STORE } from "./arabic-store";
import { icuArguments } from "./icu";
import en from "../../messages/en/development.json";
import ar from "../../messages/ar/development.json";

const REPO_ROOT = path.join(__dirname, "..", "..");

/**
 * What was still English on `/ar/developments/<slug>` after the amenity cards
 * were fixed, and why each piece needed a different answer.
 *
 * Measured on the reported page: 13 text nodes carried a whole English phrase
 * and 28 were mostly-ASCII. Afterwards: 0 and 1, the one being
 * `info@bazarrealestate.ae`, which is an address rather than a word.
 */

describe("the catalogue carries both languages for the project page", () => {
  const walk = (o: unknown, p = ""): string[] =>
    typeof o === "object" && o !== null
      ? Object.entries(o).flatMap(([k, v]) => walk(v, p ? `${p}.${k}` : k))
      : [p];

  it("every English key has an Arabic twin", () => {
    expect(walk(ar).sort()).toEqual(walk(en).sort());
  });

  it("no Arabic value is left as its English self", () => {
    const flat = (o: unknown, p = ""): [string, string][] =>
      typeof o === "object" && o !== null
        ? Object.entries(o).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k))
        : [[p, String(o)]];
    const arFlat = Object.fromEntries(flat(ar));
    for (const [key, value] of flat(en)) {
      // Anything with letters in it should have moved.
      if (!/[A-Za-z]{3}/.test(value)) continue;
      expect(arFlat[key], `${key} was not translated`).not.toBe(value);
      expect(arFlat[key], `${key} has no Arabic`).toMatch(/[؀-ۿ]/);
    }
  });

  it("keeps every ICU argument the English uses", () => {
    // The repo's own parser, not a regex: `card.handover` is a `select` whose
    // branch bodies are `{Q1}`…`{Q4}`, and a naive `\{(\w+)` reads those as
    // four more arguments.
    const args = (s: string) => [...icuArguments(s)].sort();
    const flat = (o: unknown, p = ""): [string, string][] =>
      typeof o === "object" && o !== null
        ? Object.entries(o).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k))
        : [[p, String(o)]];
    const arFlat = Object.fromEntries(flat(ar));
    for (const [key, value] of flat(en)) {
      // A dropped `{name}` renders the literal braces to a reader.
      expect(args(arFlat[key] ?? ""), `${key} lost an argument`).toEqual(
        args(value),
      );
    }
  });
});

describe("the auto-generated FAQ is a template, not a concatenation", () => {
  const src = readFileSync(
    path.join(
      REPO_ROOT,
      "app/[locale]/(public)/developments/[slug]/_components/development-faq.tsx",
    ),
    "utf8",
  );

  /**
   * Every answer used to be a template literal, which is why `/ar` published
   * "ذا كانوبيز آت ياس بوينت sits within جزيرة ياس, Abu Dhabi." — the tokens
   * folded and the sentence did not. The regression to guard is someone
   * adding an eighth question the quick way.
   */
  it("no English sentence is assembled inline", () => {
    // Comments stripped first: the docblock in that file quotes the broken
    // output verbatim, which is the clearest record of what went wrong and
    // must not be what trips this guard.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const phrase of [
      "sits within",
      "is developed by",
      "Currently scheduled for",
      "shows live availability",
      "designated freehold area",
    ]) {
      expect(code, `"${phrase}" is back in the component`).not.toContain(
        phrase,
      );
    }
  });

  it("the questions and answers come from the catalogue", () => {
    for (const key of [
      "developerQ",
      "developerA",
      "locationQ",
      "locationA",
      "handoverQ",
      "handoverA",
      "planQ",
      "planA",
      "unitsQ",
      "unitsA",
      "foreignQ",
      "foreignA",
      "escrowQ",
      "escrowA",
    ]) {
      expect(src).toContain(`t("${key}"`);
      expect((en as Record<string, Record<string, string>>).faq[key]).toBeTruthy();
    }
  });
});

describe("the sub-nav no longer prints the CMS's own labels", () => {
  it("has a public label for every anchored section", () => {
    // Mirrors ANCHORED_SECTIONS in the page.
    for (const key of [
      "overview",
      "master-plan",
      "payment-plan",
      "units",
      "floor-plans",
      "renders",
      "features",
      "unit-plans",
      "location",
      "developer",
      "faq",
    ]) {
      expect(
        (en as Record<string, Record<string, string>>).nav[key],
        `no public label for the "${key}" anchor`,
      ).toBeTruthy();
    }
  });
});

describe("the payment plan's stored words are translated", () => {
  /**
   * Display-only, deliberately: `splitPaymentPlan` finds the handover row by
   * testing `label` against an English regex, so the Arabic must never reach
   * the data. These are the labels and plan names actually stored in
   * production.
   */
  const stored = [
    "Booking",
    "During Construction",
    "On Handover",
    "Handover",
    "Foundations",
    "Within 30 days",
    "40/60 Payment Plan",
    "50/50 Payment Plan",
    "60/40 post-handover",
    "Q3 2030",
    "Q1 2027",
  ];

  for (const en of stored) {
    it(`has Arabic for ${JSON.stringify(en)}`, () => {
      const entry = ARABIC_STORE[en];
      expect(entry, `no store entry for ${en}`).toBeDefined();
      expect(entry!.ar).toMatch(/[؀-ۿ]/);
    });
  }

  it("leaves a bare numeral alone — that is data in the wrong box, not copy", () => {
    // Two projects have "20" / "40" in a milestone's `timing`. Translating a
    // numeral would be inventing content; the fold keeps the English, which is
    // the same numeral.
    expect(ARABIC_STORE["20"]).toBeUndefined();
    expect(ARABIC_STORE["40"]).toBeUndefined();
  });
});

describe("a project's search appearance reaches Arabic", () => {
  it("has Arabic for the reported page's title and description", () => {
    const title =
      "The Canopies at Yas Point by ALDAR Properties | Yas Island, Abu Dhabi";
    expect(ARABIC_STORE[title]?.ar).toMatch(/[؀-ۿ]/);
    // The <title> was the last English thing on the page.
    expect(ARABIC_STORE[title]!.ar).not.toContain("Yas Point by");
  });
});
