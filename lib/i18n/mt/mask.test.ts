import { describe, expect, it } from "vitest";
import { mask, sentinelsIn, unmask } from "./mask";

/**
 * The property this file exists to hold: masking is lossless, and nothing that
 * carries a number a buyer or a regulator relies on ever reaches the model.
 */
describe("masking protected spans", () => {
  it("round-trips exactly", () => {
    const cases = [
      "Five-bedroom villa on Saadiyat Island for AED 12,500,000.",
      "Reference BR-1042 · ORN 28041 · permit DLD-4417 · 4.5% yield",
      "2,450 ft² · handover Q4 2026 · call +971 50 123 4567",
      "See https://bazar.ae/p/villa-1042 or email hello@bazar.ae",
      "No protected content at all in this sentence.",
      "",
    ];
    for (const text of cases) {
      const { masked, tokens } = mask(text);
      expect(unmask(masked, tokens), text).toBe(text);
    }
  });

  it("never lets a price reach the model", () => {
    const { masked, tokens, kinds } = mask("Yours for AED 12,500,000 today");
    expect(masked).toBe("Yours for ⟦0⟧ today");
    expect(tokens[0]).toBe("AED 12,500,000");
    expect(kinds[0]).toBe("price");
  });

  it("takes the whole price, not the bare number inside it", () => {
    // The overlap rule is what stops "AED" surviving alone while its digits
    // travel to the model and come back rounded.
    const { tokens } = mask("AED 2.5M");
    expect(tokens).toEqual(["AED 2.5M"]);
  });

  it("keeps a phone number whole, including the +", () => {
    // A bare + is a bidi neutral and jumps to the wrong end of an Arabic line.
    const { tokens } = mask("Call +971 50 123 4567 now");
    expect(tokens).toEqual(["+971 50 123 4567"]);
  });

  it("masks regulatory identifiers in either spelling", () => {
    const { tokens } = mask("ORN 28041 and BRN-1234 and RERA #99");
    expect(tokens).toEqual(["ORN 28041", "BRN-1234", "RERA #99"]);
  });

  it("does not let a URL be chopped up by the patterns after it", () => {
    // The URL contains a digit run that `reference` would otherwise claim.
    const { tokens } = mask("at https://bazar.ae/p/BR-1042?x=4.5%");
    expect(tokens).toEqual(["https://bazar.ae/p/BR-1042?x=4.5%"]);
  });

  it("numbers sentinels from zero, in document order", () => {
    const { masked } = mask("AED 900K for 1,200 ft² at 3%");
    expect(masked).toBe("⟦0⟧ for ⟦1⟧ at ⟦2⟧");
    expect(sentinelsIn(masked)).toEqual([0, 1, 2]);
  });
});

describe("unmasking", () => {
  it("substitutes a hand-authored Arabic proper noun via overrides", () => {
    // The payoff for hand-authoring areas.name_ar: the canonical toponym is
    // reused everywhere instead of being re-invented per call.
    const tokens = ["Saadiyat Island"];
    expect(unmask("فيلا في ⟦0⟧", tokens, { 0: "جزيرة السعديات" })).toBe(
      "فيلا في جزيرة السعديات",
    );
  });

  it("tolerates whitespace the model may add inside the brackets", () => {
    expect(unmask("price ⟦ 0 ⟧", ["AED 1"])).toBe("price AED 1");
  });

  it("leaves an out-of-range sentinel alone rather than dropping text", () => {
    // A hallucinated ⟦9⟧ must not silently become an empty string; validation
    // is what rejects the output, and it needs the evidence intact.
    expect(unmask("a ⟦9⟧ b", ["x"])).toBe("a ⟦9⟧ b");
  });

  it("survives reordering, which is the normal Arabic case", () => {
    // Arabic word order differs, so sentinels come back in a different order.
    // Position is irrelevant; identity is what matters.
    const { tokens } = mask("Villa at AED 5,000,000 ref BR-7");
    expect(unmask("⟦1⟧ فيلا بسعر ⟦0⟧", tokens)).toBe(
      "BR-7 فيلا بسعر AED 5,000,000",
    );
  });
});

describe("mask · proper nouns", () => {
  const TERMS = ["Saadiyat Island", "Al Maryah Island", "Al Maryah", "Yas Island", "Aldar Properties", "Bazar"];

  it("protects a name the model would otherwise re-invent", () => {
    const { masked, tokens, kinds } = mask("A villa on Saadiyat Island.", TERMS);
    expect(masked).toBe("A villa on ⟦0⟧.");
    expect(tokens[0]).toBe("Saadiyat Island");
    expect(kinds[0]).toBe("proper-noun");
  });

  it("prefers the longest name, so an island keeps its last word", () => {
    // With "Al Maryah" winning, the model is handed a dangling "Island".
    const { tokens } = mask("Offices at Al Maryah Island.", TERMS);
    expect(tokens).toEqual(["Al Maryah Island"]);
  });

  it("lets a price still beat a name that contains one", () => {
    const { tokens, kinds } = mask("Aldar Properties from AED 2.5M.", TERMS);
    expect(tokens[0]).toBe("Aldar Properties");
    expect(kinds[1]).toBe("price");
  });

  it("does not match inside a longer word", () => {
    // The explicit lookarounds, not \b — "Bazargan" is not "Bazar".
    const { tokens } = mask("Bazargan Trading", TERMS);
    expect(tokens).toEqual([]);
  });

  it("matches case-insensitively, and unmask restores what was written", () => {
    const { masked, tokens } = mask("SAADIYAT ISLAND is here", TERMS);
    expect(masked).toBe("⟦0⟧ is here");
    expect(unmask(masked, tokens)).toBe("SAADIYAT ISLAND is here");
  });

  it("substitutes the canonical Arabic through overrides — the whole point", () => {
    const { masked, tokens } = mask("A villa on Saadiyat Island.", TERMS);
    expect(unmask(masked, tokens, { 0: "جزيرة السعديات" })).toBe(
      "A villa on جزيرة السعديات.",
    );
  });

  it("leaves an unmapped name in Latin rather than inventing one", () => {
    // An entry with no approved Arabic still travels as a sentinel, so it
    // cannot trip `latin-leak` — and the English survives verbatim.
    const { masked, tokens } = mask("Near Yas Island.", TERMS);
    expect(unmask(masked, tokens, {})).toBe("Near Yas Island.");
  });

  it("changes nothing when no terms are given", () => {
    expect(mask("A villa on Saadiyat Island.")).toEqual(
      mask("A villa on Saadiyat Island.", []),
    );
  });
});
