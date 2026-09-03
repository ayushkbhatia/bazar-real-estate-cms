import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { ALL_LOCALES } from "@/lib/i18n/locales";
import { AREA_UNITS, CURRENCIES } from "./types";
import {
  DEFAULT_UNIT_LABELS,
  UNIT_LABELS_AR,
  UNIT_LABELS_EN,
  UNIT_LABEL_DEFAULTS,
  resolveUnitLabels,
  unitLabelsFor,
} from "./unit-labels";
import {
  areaUnitLabel,
  currencySymbol,
  formatArea,
  formatAreaRange,
  formatMoneyValue,
  formatPrice,
  formatPricePerArea,
} from "./formatters";
import { parseUnitLabels } from "@/lib/schemas/unit-labels";

describe("the unit dictionary", () => {
  it("covers every locale, currency and area unit", () => {
    for (const locale of ALL_LOCALES) {
      const labels = unitLabelsFor(locale);
      for (const c of CURRENCIES) {
        expect(labels.currency[c], `${locale}.currency.${c}`).toBeTruthy();
        expect(
          labels.currencyLong[c],
          `${locale}.currencyLong.${c}`,
        ).toBeTruthy();
      }
      for (const u of AREA_UNITS) {
        expect(labels.area[u], `${locale}.area.${u}`).toBeTruthy();
        expect(labels.areaLong[u], `${locale}.areaLong.${u}`).toBeTruthy();
      }
    }
  });

  /**
   * The mirror of `messages.test.ts`'s rule for the catalogue: an Arabic value
   * byte-identical to its English sibling is the signature of someone pasting
   * the English across to make a coverage check pass. Here it would also be the
   * bug this whole feature exists to fix, shipped as its own fix.
   */
  it("says something different in Arabic", () => {
    for (const c of CURRENCIES) {
      expect(UNIT_LABELS_AR.currency[c]).not.toBe(UNIT_LABELS_EN.currency[c]);
      expect(UNIT_LABELS_AR.currencyLong[c]).not.toBe(
        UNIT_LABELS_EN.currencyLong[c],
      );
    }
    for (const u of AREA_UNITS) {
      expect(UNIT_LABELS_AR.area[u]).not.toBe(UNIT_LABELS_EN.area[u]);
      expect(UNIT_LABELS_AR.areaLong[u]).not.toBe(UNIT_LABELS_EN.areaLong[u]);
    }
  });

  it("writes the dirham as a word, which is the point of the exercise", () => {
    expect(UNIT_LABELS_AR.currency.AED).toBe("درهم");
  });

  it("keeps English as the fallback for anything outside the provider", () => {
    expect(DEFAULT_UNIT_LABELS).toBe(UNIT_LABELS_EN);
    expect(UNIT_LABEL_DEFAULTS.en).toBe(UNIT_LABELS_EN);
  });
});

describe("resolveUnitLabels", () => {
  it("returns the shipped words for an empty bag", () => {
    expect(resolveUnitLabels("ar", {})).toEqual(UNIT_LABELS_AR);
    expect(resolveUnitLabels("ar", null)).toEqual(UNIT_LABELS_AR);
    expect(resolveUnitLabels("en", { ar: { currency: { AED: "x" } } })).toEqual(
      UNIT_LABELS_EN,
    );
  });

  it("folds a CMS override over one key and leaves the rest alone", () => {
    const out = resolveUnitLabels("ar", { ar: { currency: { AED: "د.إ" } } });
    expect(out.currency.AED).toBe("د.إ");
    expect(out.currency.USD).toBe(UNIT_LABELS_AR.currency.USD);
    expect(out.area.ft2).toBe(UNIT_LABELS_AR.area.ft2);
  });

  /**
   * The one an operator will actually exercise: clearing a box has to mean
   * "put the shipped word back", not "print nothing beside the price".
   */
  it("treats a blank override as no override", () => {
    const out = resolveUnitLabels("ar", {
      ar: { currency: { AED: "" }, area: { ft2: "   " } },
    });
    expect(out.currency.AED).toBe(UNIT_LABELS_AR.currency.AED);
    expect(out.area.ft2).toBe(UNIT_LABELS_AR.area.ft2);
  });

  it("survives a malformed bag rather than rendering a hole", () => {
    expect(resolveUnitLabels("ar", parseUnitLabels("nonsense"))).toEqual(
      UNIT_LABELS_AR,
    );
    expect(resolveUnitLabels("ar", parseUnitLabels({ ar: 42 }))).toEqual(
      UNIT_LABELS_AR,
    );
    expect(
      resolveUnitLabels(
        "ar",
        parseUnitLabels({ ar: { currency: { XYZ: "!" } } }),
      ).currency.AED,
    ).toBe(UNIT_LABELS_AR.currency.AED);
  });

  it("never lets the CMS move the currency to the other side of the number", () => {
    // `currencyLeads` is grammar and comes from the locale, not the bag.
    const out = resolveUnitLabels("ar", {
      ar: { currency: { AED: "درهم" } },
    });
    expect(out.currencyLeads).toBe(false);
    expect(resolveUnitLabels("en", {}).currencyLeads).toBe(true);
  });
});

describe("formatters read the dictionary", () => {
  const ar = { labels: UNIT_LABELS_AR };

  it("puts the currency after the figure in Arabic and before it in English", () => {
    expect(formatPrice(4_250_000, { currency: "AED" })).toBe("AED 4.3M");
    expect(formatPrice(4_250_000, { currency: "AED", ...ar })).toBe(
      "4.3 مليون درهم",
    );
    expect(formatMoneyValue(1_050_000, { currency: "AED", ...ar })).toBe(
      "1,050,000 درهم",
    );
  });

  it("keeps the area unit trailing in both languages", () => {
    expect(formatArea(1000, { area_unit: "ft2" })).toBe("1,000 ft²");
    expect(formatArea(1000, { area_unit: "ft2", ...ar })).toBe("1,000 قدم²");
    expect(areaUnitLabel({ area_unit: "m2", ...ar })).toBe("م²");
    expect(formatAreaRange(1240, 1480, { area_unit: "ft2", ...ar })).toBe(
      "1,240 – 1,480 قدم²",
    );
  });

  it("composes a rate out of both halves", () => {
    expect(
      formatPricePerArea(2000, { currency: "AED", area_unit: "ft2", ...ar }),
    ).toBe("2,000/قدم² درهم");
    expect(currencySymbol({ currency: "USD", ...ar })).toBe("دولار");
  });

  /**
   * The compact suffix is a word in Arabic, not a letter. Left as "M" it put a
   * lone Latin character between the figure and "درهم" — the bug the first cut
   * of this dictionary shipped, found by reading a rendered card rather than by
   * any test, which is why there is one here now.
   */
  it("writes the magnitude suffix as a word in Arabic", () => {
    expect(formatPrice(4_250_000, { currency: "AED", ...ar })).toBe(
      "4.3 مليون درهم",
    );
    expect(formatPrice(750_000, { currency: "AED", ...ar })).toBe(
      "750 ألف درهم",
    );
    expect(formatPrice(750_000, { currency: "AED" })).toBe("AED 750K");
    // No stray Latin left anywhere in the Arabic form.
    expect(formatPrice(4_250_000, { currency: "AED", ...ar })).not.toMatch(
      /[A-Za-z]/,
    );
  });

  it("falls back to English when no dictionary reached it", () => {
    expect(formatPrice(4_250_000, { currency: "AED" })).toBe("AED 4.3M");
    expect(areaUnitLabel()).toBe("ft²");
    expect(currencySymbol({ currency: "AED" })).toBe("AED");
  });
});

/**
 * The ratchet.
 *
 * The dictionary is only worth having if nothing routes around it, and the way
 * it gets routed around is not a wrong import — it is somebody typing "ft²"
 * into a component because that is what the design says. TypeScript cannot see
 * that; this can.
 *
 * Scope is the public marketplace only. `/admin` is English by design, the OG
 * images are pinned English in both locales by `lib/og/arabic-og.test.ts`
 * (Satori shapes Arabic but does not reorder it), and the PDFs embed Latin
 * faces. Each of those is a decision with its own reasons, not an oversight.
 */
describe("no hard-coded currency or unit glyphs on the public site", () => {
  const ROOT = path.join(process.cwd(), "app", "[locale]", "(public)");

  /** Files that legitimately hold one, with the reason they may. */
  const ALLOWED = new Map<string, string>([
    [
      "opengraph-image.tsx",
      "OG cards are English in both locales — see lib/og/arabic-og.test.ts.",
    ],
  ]);

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
        out.push(full);
    }
    return out;
  }

  /**
   * Strip comments before scanning. This file's own subject matter means the
   * components explaining it are full of the glyphs it hunts for, and a
   * ratchet that fires on the paragraph documenting the fix is a ratchet
   * somebody disables.
   */
  function stripComments(source: string): string[] {
    const out: string[] = [];
    let inBlock = false;
    for (const raw of source.split("\n")) {
      let line = raw;
      if (inBlock) {
        const end = line.indexOf("*/");
        if (end === -1) {
          out.push("");
          continue;
        }
        line = line.slice(end + 2);
        inBlock = false;
      }
      line = line.replace(/\/\*.*?\*\//g, "");
      const open = line.indexOf("/*");
      if (open !== -1) {
        inBlock = true;
        line = line.slice(0, open);
      }
      const slash = line.indexOf("//");
      if (slash !== -1) line = line.slice(0, slash);
      out.push(line);
    }
    return out;
  }

  it("finds none", () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      if (ALLOWED.has(path.basename(file))) continue;
      stripComments(fs.readFileSync(file, "utf8")).forEach((code, i) => {
        const where = `${path.relative(process.cwd(), file)}:${i + 1}`;
        // The area glyphs are never anything but a label — there is no enum
        // member spelled "ft²" — so any quoted one is a hard finding.
        if (/["'`](ft²|m²)["'`]/.test(code)) offenders.push(where);
        // "AED" is BOTH a label and a `Currency` member, and the member is
        // legitimate: `prefs.currency === "AED"` picks a branch, it does not
        // print a word. Comparisons are what tell the two apart, so a line
        // holding one is exempt and a bare quoted "AED" is not.
        else if (
          /["'`]AED["'`]/.test(code) &&
          !/(===|!==|==|!=)\s*["'`]AED["'`]/.test(code) &&
          !/["'`]AED["'`]\s*(===|!==|==|!=)/.test(code)
        )
          offenders.push(where);
      });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
