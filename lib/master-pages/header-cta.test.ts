import { describe, expect, it } from "vitest";
import {
  HEADER_CTA_FALLBACK_HREF,
  HEADER_CTA_PAGE_SLUG,
  HEADER_CTA_SECTION,
  headerCtaDef,
} from "./header-cta";
import { resolveSections, str, validateSections } from "./index";
import { arabicTwins } from "./twins";
import { SUBPAGE_SLUG_PREFIX } from "./subpages";

/**
 * The header's call-to-action button.
 *
 * The bug this registry closes was not a missing translation in the abstract:
 * `/ar` on a phone rendered an Arabic drawer with `List Your Property` pinned
 * across the bottom of it, and `List` in the bar above, because both were
 * English literals in the JSX. The desktop pill read `nav.listProperty` and
 * was fine, which is why it survived every Arabic sweep.
 *
 * These assertions pin the two things that would bring it back: an English
 * default reaching `/ar`, and a translatable field shipped without a twin.
 */

const AR_DEFAULTS = Object.keys(HEADER_CTA_SECTION.defaults).filter((k) =>
  k.endsWith("_ar"),
);

describe("header CTA copy", () => {
  it("ships Arabic beside every translatable English default", () => {
    const twins = arabicTwins(HEADER_CTA_SECTION.fields).map((f) => f.key);
    expect(twins.length).toBeGreaterThan(0);
    for (const key of twins) {
      expect(
        HEADER_CTA_SECTION.defaults[key],
        `${key} has no shipped Arabic`,
      ).toBeTruthy();
    }
    // Nothing declared as Arabic that no field asks for — a stray `_ar` key is
    // storage `mergeValues` would drop on the first save.
    expect(AR_DEFAULTS.sort()).toEqual(twins.sort());
  });

  it("never repeats the English as the Arabic", () => {
    for (const arKey of AR_DEFAULTS) {
      const en = HEADER_CTA_SECTION.defaults[arKey.slice(0, -3)];
      expect(HEADER_CTA_SECTION.defaults[arKey]).not.toBe(en);
    }
  });

  it("gives the short label its own Arabic, not a truncation of the long one", () => {
    // The two render in different places and one is not a prefix of the other
    // in either language — the whole reason `short_label` is a field rather
    // than a `slice()` in the nav.
    const long = String(HEADER_CTA_SECTION.defaults.label_ar);
    const short = String(HEADER_CTA_SECTION.defaults.short_label_ar);
    expect(short).not.toBe(long);
    expect(short.length).toBeLessThan(long.length);
  });

  it("keeps the short label short enough for a 390px header", () => {
    const field = HEADER_CTA_SECTION.fields.find((f) => f.key === "short_label");
    expect(field && "max" in field ? field.max : undefined).toBeLessThanOrEqual(
      16,
    );
  });

  it("folds to Arabic with no English left behind", () => {
    const [section] = resolveSections(headerCtaDef(), null, "ar");
    for (const key of AR_DEFAULTS.map((k) => k.slice(0, -3))) {
      expect(str(section!.values, key)).toBe(
        HEADER_CTA_SECTION.defaults[`${key}_ar`],
      );
    }
    // The fold strips the storage shape — a renderer can never read `_ar`.
    expect(Object.keys(section!.values).some((k) => k.endsWith("_ar"))).toBe(
      false,
    );
  });

  it("leaves the link untranslated", () => {
    const [section] = resolveSections(headerCtaDef(), null, "ar");
    expect(str(section!.values, "href")).toBe(HEADER_CTA_FALLBACK_HREF);
  });

  it("renders the English byte-identically to what the header shipped with", () => {
    const [section] = resolveSections(headerCtaDef(), null, "en");
    expect(str(section!.values, "label")).toBe("List Your Property");
    expect(str(section!.values, "short_label")).toBe("List");
    expect(str(section!.values, "href")).toBe("/services/sell");
  });

  it("survives the editor's save, twins and all", () => {
    // The whole point of the screen. A save that dropped `label_ar` would put
    // the English back on /ar and look like nothing happened — the exact
    // silent loss `lib/master-pages/i18n.test.ts` guards generically, pinned
    // here on the values this document actually holds.
    const edited = {
      key: "cta",
      enabled: true,
      values: {
        label: "Sell with Bazar",
        label_ar: "بِع مع بازار",
        short_label: "Sell",
        short_label_ar: "بِع",
        href: "/services/sell",
      },
    };
    const result = validateSections(headerCtaDef(), [edited]);
    expect(result.ok, JSON.stringify("issues" in result ? result.issues : [])).toBe(
      true,
    );
    if (!result.ok) return;

    const [section] = resolveSections(headerCtaDef(), result.sections, "ar");
    expect(str(section!.values, "label")).toBe("بِع مع بازار");
    expect(str(section!.values, "short_label")).toBe("بِع");
    // The link is not folded, so one address serves both languages.
    expect(str(section!.values, "href")).toBe("/services/sell");

    const [english] = resolveSections(headerCtaDef(), result.sections, "en");
    expect(str(english!.values, "label")).toBe("Sell with Bazar");
  });

  it("refuses a short label too wide for the bar it renders in", () => {
    const tooLong = {
      key: "cta",
      enabled: true,
      values: {
        ...HEADER_CTA_SECTION.defaults,
        short_label: "List Your Property Today",
      },
    };
    const result = validateSections(headerCtaDef(), [tooLong]);
    expect(result.ok).toBe(false);
  });

  it("stores under the subpage prefix, so it stays out of /pages", () => {
    // `lib/queries/pages.ts` filters the Pages list and the public route on
    // this prefix. A slug without it would publish the document at
    // /pages/nav/cta and list it beside real pages.
    expect(HEADER_CTA_PAGE_SLUG.startsWith(SUBPAGE_SLUG_PREFIX)).toBe(true);
  });
});
