/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import commonAr from "@/messages/ar/common.json";
import commonEn from "@/messages/en/common.json";
import { mask, unmask } from "./mask";
import { PROPER_NOUNS, nounMap, nounTerms, overridesFor } from "./proper-nouns";

describe("the proper-noun list", () => {
  it("names each entry once", () => {
    const dupes = PROPER_NOUNS.map((n) => n.en).filter(
      (en, i, all) => all.indexOf(en) !== i,
    );
    expect(dupes).toEqual([]);
  });

  it("gives every entry a source, because this list is a claim about the world", () => {
    const unsourced = PROPER_NOUNS.filter((n) => !n.source.trim()).map((n) => n.en);
    expect(unsourced).toEqual([]);
  });

  it("keeps `keep-latin` and `ar: null` in step", () => {
    // Either direction breaking means the list says one thing and does another:
    // a keep-latin entry with Arabic would substitute it anyway, and a null
    // with any other confidence is an unrecorded gap.
    for (const n of PROPER_NOUNS) {
      expect(n.ar === null, `${n.en}`).toBe(n.confidence === "keep-latin");
    }
  });

  it("spells the client's own name the way the catalogue does", () => {
    // One spelling of "Bazar", guarded in both places. It appears in about and
    // why-band copy on nearly every page, so a second spelling here would be
    // visible site-wide and invisible in review.
    const brand = PROPER_NOUNS.find((n) => n.kind === "brand")!;
    expect(brand.en).toBe(commonEn.brand);
    expect(brand.ar).toBe(commonAr.brand);
  });

  it("writes Arabic in Arabic, with Western digits", () => {
    // SHARED_RULES in prompt.ts requires Western digits site-wide. A stray
    // Latin word here would also defeat the point — it would be substituted in
    // and then flagged as `latin-leak` by the validator.
    for (const n of PROPER_NOUNS) {
      if (!n.ar) continue;
      expect(/[٠-٩۰-۹]/.test(n.ar), `${n.en} — Arabic-Indic digits`).toBe(false);
      expect(/[A-Za-z]{4,}/.test(n.ar), `${n.en} — Latin run`).toBe(false);
    }
  });

  it("records how many still need sign-off", () => {
    // Shrink-only. `proposed` means no Arabic was found in use, so it is a
    // guess with a label — fine to ship behind a fallback, not fine to forget.
    const proposed = PROPER_NOUNS.filter((n) => n.confidence === "proposed");
    expect(proposed.length).toBeLessThanOrEqual(2);
  });

  it("covers the corpus", () => {
    expect(PROPER_NOUNS.length).toBeGreaterThan(70);
    for (const kind of ["area", "developer", "development"] as const) {
      expect(PROPER_NOUNS.filter((n) => n.kind === kind).length).toBeGreaterThan(10);
    }
  });
});

describe("nounTerms", () => {
  it("orders longest first, so a longer name wins the alternation", () => {
    const terms = nounTerms();
    for (let i = 1; i < terms.length; i++) {
      expect(terms[i - 1]!.length).toBeGreaterThanOrEqual(terms[i]!.length);
    }
  });
});

describe("overridesFor", () => {
  it("substitutes only what mask matched as a name", () => {
    const result = mask("A villa on Saadiyat Island from AED 2.5M.", nounTerms());
    const overrides = overridesFor(result);
    const idx = result.kinds.indexOf("proper-noun");
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(overrides[idx]).toBe("جزيرة السعديات");
    // The price is masked too, and must not acquire an Arabic place name.
    const priceIdx = result.kinds.indexOf("price");
    expect(overrides[priceIdx]).toBeUndefined();
  });

  it("leaves a keep-latin name alone rather than substituting nothing", () => {
    const result = mask("Bulgari Residences on Jubail Island.", nounTerms());
    const out = unmask(result.masked, result.tokens, overridesFor(result));
    expect(out).toContain("Bulgari Residences");
    expect(out).toContain("جزيرة الجبيل");
  });

  it("is the whole round trip: English in, canonical Arabic out", () => {
    const terms = nounTerms();
    const result = mask("Aldar Properties at Yas Island, from Bazar.", terms);
    expect(unmask(result.masked, result.tokens, overridesFor(result))).toBe(
      "الدار العقارية at جزيرة ياس, from بازار.",
    );
  });

  it("gives the same Arabic to the same name in different sentences", () => {
    // The reason the list exists. Without it the model re-invents a
    // transliteration per call and no two pages agree.
    const terms = nounTerms();
    const one = mask("Homes on Al Reem Island.", terms);
    const two = mask("Al Reem Island offices.", terms);
    expect(overridesFor(one)[one.kinds.indexOf("proper-noun")]).toBe(
      overridesFor(two)[two.kinds.indexOf("proper-noun")],
    );
  });

  it("matches whatever case the copy happens to use", () => {
    const result = mask("SAADIYAT ISLAND", nounTerms());
    expect(overridesFor(result)[0]).toBe("جزيرة السعديات");
  });
});

describe("nounMap", () => {
  it("keeps a null rather than dropping the entry", () => {
    // "no approved Arabic" and "not a known name" are different answers, and
    // only the first means "mask it and leave the Latin".
    const map = nounMap();
    expect(map.has("bulgari residences")).toBe(true);
    expect(map.get("bulgari residences")).toBeNull();
    expect(map.has("not a real place")).toBe(false);
  });
});
