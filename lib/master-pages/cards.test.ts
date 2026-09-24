import { describe, expect, it } from "vitest";
import { stripIsolates } from "@/lib/i18n/bidi";
import { resolveSections, validateSections } from "@/lib/master-pages";
import {
  CARDS,
  CARD_SOURCES,
  cardAdminPath,
  cardPageDef,
  cardSection,
  cardTextFields,
  findCardOverrides,
  getCard,
  isCardKey,
  previewCardText,
  releaseCardOverrides,
  sameWording,
  spliceCardSection,
} from "./cards";
import { developmentPageCopyDef } from "./development-page";
import type { StoredSection } from "./types";

const advisor = getCard("project-advisor")!;

/** The card's wording as a never-edited document resolves it. */
function shipped() {
  return resolveSections(cardPageDef(advisor), null, "bilingual")[0].values;
}

describe("the cards registry", () => {
  it("points every card at a section its source document declares", () => {
    for (const card of CARDS) {
      expect(() => cardSection(card)).not.toThrow();
      expect(cardTextFields(card).length).toBeGreaterThan(0);
    }
  });

  it("has unique keys, each routable", () => {
    const keys = CARDS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(isCardKey(key)).toBe(true);
      expect(cardAdminPath({ key })).toBe(`/admin/pages/cards/${key}`);
    }
    expect(isCardKey("nope")).toBe(false);
    expect(getCard("nope")).toBeNull();
  });

  it("gives the project advisor card its pull quote, in both languages", () => {
    const fields = cardSection(advisor).fields.map((f) => f.key);
    expect(fields).toContain("quote");
    const values = shipped();
    expect(values.quote).toMatch(/^We don't show twenty units/);
    expect(values.quote_ar).toMatch(/^لا نعرض عشرين وحدة/);
  });

  it("only lets a card preview when the component can be drawn from props", () => {
    // The listing cards embed a live form; a mock of it would drift.
    expect(CARDS.filter((c) => c.preview).map((c) => c.key)).toEqual([
      "project-advisor",
    ]);
  });

  it("narrows validation to the card's section so a save cannot blank the rest", () => {
    const result = validateSections(cardPageDef(advisor), [
      { key: "advisor", enabled: true, values: { quote: "  A new line.  " } },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sections.map((s) => s.key)).toEqual(["advisor"]);
    expect(result.sections[0].values.quote).toBe("A new line.");
  });
});

describe("spliceCardSection", () => {
  const def = CARD_SOURCES["development-copy"].def();
  const card: StoredSection = {
    key: "advisor",
    enabled: true,
    values: { quote: "New" },
  };

  it("replaces the card's section in place and keeps every other one", () => {
    const stored: StoredSection[] = [
      { key: "hero", enabled: true, values: { brochure_label: "Mine" } },
      { key: "advisor", enabled: true, values: { quote: "Old" } },
      { key: "faq", enabled: true, values: { heading: "Qs" } },
    ];
    const out = spliceCardSection(def, stored, card);
    expect(out.map((s) => s.key)).toEqual(["hero", "advisor", "faq"]);
    expect(out[0]).toBe(stored[0]);
    expect(out[1].values.quote).toBe("New");
    expect(out[2]).toBe(stored[2]);
  });

  it("appends the section when the stored document predates it", () => {
    const stored: StoredSection[] = [
      { key: "hero", enabled: true, values: {} },
    ];
    expect(spliceCardSection(def, stored, card).map((s) => s.key)).toEqual([
      "hero",
      "advisor",
    ]);
  });

  it("writes the other sections EMPTY when nothing is stored, so they keep reading the code defaults", () => {
    const out = spliceCardSection(def, null, card);
    expect(out.map((s) => s.key)).toEqual(def.sections.map((s) => s.key));
    for (const s of out) {
      if (s.key === "advisor") expect(s.values.quote).toBe("New");
      else expect(s.values).toEqual({});
    }
    // …and an empty section resolves to exactly what an unsaved one does.
    const resolved = resolveSections(
      developmentPageCopyDef(),
      out,
      "bilingual",
    );
    const fresh = resolveSections(developmentPageCopyDef(), null, "bilingual");
    expect(resolved.find((s) => s.key === "hero")!.values).toEqual(
      fresh.find((s) => s.key === "hero")!.values,
    );
  });
});

describe("findCardOverrides", () => {
  const fields = cardTextFields(advisor);
  const card = shipped();

  it("reads the 22 hand-typed projects as matching the card", () => {
    // The shape every pre-existing project document has in production.
    const overrides = findCardOverrides(fields, card, {
      eyebrow: "Need Assistance?",
      eyebrow_ar: "هل تحتاج إلى مساعدة؟",
      heading: "Speak With an Advisor",
      heading_ar: "تحدث مع مستشار عقاري",
      quote: null,
    });
    expect(overrides.map((o) => [o.field, o.matchesCard])).toEqual([
      ["eyebrow", true],
      ["heading", true],
    ]);
  });

  it("tells wording of a project's own from a repeat of the card's", () => {
    const [o] = findCardOverrides(fields, card, {
      quote: "Two units, and we know why.",
      quote_ar: card.quote_ar,
    });
    expect(o.field).toBe("quote");
    expect(o.matchesCard).toBe(false);
  });

  it("flags English with no Arabic — /ar would show the English", () => {
    const [o] = findCardOverrides(fields, card, { quote: card.quote });
    expect(o.arabicMissing).toBe(true);
    expect(o.matchesCard).toBe(true);
  });

  it("ignores whitespace and bidi isolates when comparing", () => {
    expect(sameWording("Need  Assistance? ", "Need Assistance?")).toBe(true);
    expect(sameWording("⁨Bazar⁩", "Bazar")).toBe(true);
    expect(sameWording("Bazar", null)).toBe(false);
  });

  it("releases both halves of a field and nothing else", () => {
    const out = releaseCardOverrides(
      { eyebrow: "E", eyebrow_ar: "ع", heading: "H", intro: "Mine" },
      ["eyebrow"],
    );
    expect(out).toEqual({
      eyebrow: null,
      eyebrow_ar: null,
      heading: "H",
      intro: "Mine",
    });
  });
});

describe("previewCardText", () => {
  const tokens = {
    name: "Saadiyat Lagoons",
    area: "Saadiyat",
    developer: "Aldar",
    plan: "60/40",
    advisor: "Bazar Real Estate",
    advisor_first: "Bazar",
  };

  it("draws the unsaved quote, and fills tokens", () => {
    const text = previewCardText(
      advisor,
      { ...shipped(), quote: "Ask {advisor_first} about {name}." },
      null,
      "en",
      tokens,
    );
    expect(text("quote")).toEqual({
      text: "Ask Bazar about Saadiyat Lagoons.",
      source: "card",
    });
    expect(text("call_label").text).toBe("Call Bazar");
  });

  it("isolates the advisor's name in Arabic, as the live page does", () => {
    const text = previewCardText(advisor, shipped(), null, "ar", tokens);
    const call = text("call_label").text!;
    expect(call).not.toBe(stripIsolates(call));
    expect(stripIsolates(call)).toBe("اتصل بـBazar");
  });

  it("lets a project's own wording win, drawn as typed", () => {
    const text = previewCardText(
      advisor,
      shipped(),
      { quote: "Our own, for {name}." },
      "en",
      tokens,
    );
    // The page reads overrides with `sv()`, which fills no tokens.
    expect(text("quote")).toEqual({
      text: "Our own, for {name}.",
      source: "project",
    });
  });

  it("falls back to the SHIPPED Arabic when the Arabic box is cleared", () => {
    const text = previewCardText(
      advisor,
      { ...shipped(), quote: "Brand new English.", quote_ar: "" },
      null,
      "ar",
      tokens,
    );
    expect(text("quote").text).toBe(shipped().quote_ar);
  });
});
