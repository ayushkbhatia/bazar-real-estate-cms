import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { screen } from "@testing-library/react";
import {
  FSI,
  LRI,
  PDI,
  hasLegacyMarks,
  isolateAuto,
  isolateForLocale,
  isolateLtr,
  stripIsolates,
} from "./bidi";
import { EnglishFallback } from "./english-fallback";
import { renderWithIntl } from "./test-utils";
import { ALL_LOCALES } from "./locales";

/**
 * The failures these protect against are invisible to an English reader and
 * invisible in a diff — the marks have no glyph. Each case below is one of the
 * four `docs/I18N.md:178-180` names by hand.
 */
describe("isolateLtr", () => {
  it("wraps a phone number so the + cannot migrate", () => {
    // Unisolated, `+971 50 123 4567` renders as `971 50 123 4567+` in an
    // Arabic paragraph: `+` is neutral, sees RTL to its left, and lands at the
    // far end of the run.
    expect(isolateLtr("+971 50 123 4567")).toBe(`${LRI}+971 50 123 4567${PDI}`);
  });

  it("wraps a reference code, whose hyphen would otherwise reorder it", () => {
    // `BR-1042` becomes `1042-BR` — two Latin runs swapped around a neutral.
    expect(stripIsolates(isolateLtr("BR-1042"))).toBe("BR-1042");
    expect(isolateLtr("BR-1042")).toContain(LRI);
  });

  it("returns blank for blank rather than two invisible marks", () => {
    // An empty isolate is inert but makes .length lie and pollutes snapshots.
    expect(isolateLtr("")).toBe("");
    expect(isolateLtr(null)).toBe("");
    expect(isolateLtr(undefined)).toBe("");
  });
});

describe("isolateAuto", () => {
  it("uses FSI, so a value that may arrive in either script is handled", () => {
    // The DB case: areas.name folds to Arabic on /ar and stays Latin when the
    // twin is blank. The caller cannot know which it got.
    expect(isolateAuto("Saadiyat Island")).toBe(`${FSI}Saadiyat Island${PDI}`);
    expect(isolateAuto("جزيرة السعديات")).toBe(`${FSI}جزيرة السعديات${PDI}`);
  });
});

describe("isolateForLocale", () => {
  it("leaves English byte-identical", () => {
    // The property every PR in this epic is held to while LOCALES is ["en"].
    // The marks are invisible but they do travel into <title>, feed XML and
    // PDF strings, where a downstream consumer may not strip them.
    expect(isolateForLocale("AED 1,850/ft²", "en")).toBe("AED 1,850/ft²");
  });

  it("isolates on Arabic", () => {
    expect(isolateForLocale("AED 1,850/ft²", "ar")).toBe(
      `${FSI}AED 1,850/ft²${PDI}`,
    );
  });
});

describe("legacy embedding marks", () => {
  it("recognises the deprecated overrides", () => {
    // An unterminated RLO reverses everything after it, across element
    // boundaries. Isolates cannot do that, which is the whole reason
    // docs/I18N.md:183 says "never".
    expect(hasLegacyMarks("‮reversed")).toBe(true);
    expect(hasLegacyMarks("‫embedded")).toBe(true);
    expect(hasLegacyMarks(isolateLtr("BR-1042"))).toBe(false);
  });

  it("finds none in the message catalogues", () => {
    // A translator pasting from a tool that emits RLE would ship a mark that
    // silently reorders text after the string it appears in. Nothing else in
    // the suite would see it — the marks have no glyph.
    const offenders: string[] = [];
    for (const locale of ALL_LOCALES) {
      const dir = join(import.meta.dirname, "..", "..", "messages", locale);
      for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
        const raw = readFileSync(join(dir, file), "utf8");
        if (hasLegacyMarks(raw)) offenders.push(`messages/${locale}/${file}`);
      }
    }
    expect(
      offenders,
      `These catalogues carry a deprecated bidi embedding or override. Use the ` +
        `isolates from lib/i18n/bidi instead — embeddings leak across element ` +
        `boundaries.`,
    ).toEqual([]);
  });
});

describe("<EnglishFallback>", () => {
  it("marks the run as English and left-to-right", () => {
    // globals.css:920 keys Arabic typography on :lang(ar) rather than
    // [dir="rtl"] specifically so this subtree keeps the Latin face. Without
    // something emitting lang="en", that design is inert.
    renderWithIntl(<EnglishFallback>Vacant on transfer</EnglishFallback>);
    const span = screen.getByText("Vacant on transfer");
    expect(span).toHaveAttribute("lang", "en");
    expect(span).toHaveAttribute("dir", "ltr");
  });

  it("renders the same under ar — it is deliberately not locale-conditional", () => {
    // A locale check would mean every caller needs the locale in hand, and the
    // callers that most need this sit deepest in the tree.
    renderWithIntl(<EnglishFallback>Vacant on transfer</EnglishFallback>, {
      locale: "ar",
    });
    expect(screen.getByText("Vacant on transfer")).toHaveAttribute(
      "lang",
      "en",
    );
  });
});

describe("renderWithIntl", () => {
  it("provides real catalogue messages, not fixtures", async () => {
    // Reading the catalogue off disk is what makes a renamed key fail the test
    // that renders it. A fixture would let a test pass against a key that does
    // not exist — the self-certification problem fold-proofs.test.ts exists to
    // prevent on the DB side.
    const { useTranslations } = await import("next-intl");
    function Probe() {
      const t = useTranslations("common");
      return <span>{t("returnHome")}</span>;
    }
    renderWithIntl(<Probe />);
    expect(screen.getByText("Return home")).toBeInTheDocument();
  });
});
