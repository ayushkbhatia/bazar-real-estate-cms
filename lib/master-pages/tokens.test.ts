import { describe, expect, it } from "vitest";
import { defaultDocument, validateSections } from "./index";
import { CARDS, cardPageDef } from "./cards";
import { PROPERTY_TOKENS, propertyPageCopyDef } from "./property-page";
import { unknownTokenIssues, unknownTokensIn } from "./tokens";
import type { StoredSection } from "./types";

const LISTING = Object.values(PROPERTY_TOKENS);

/** One section of the listing copy document, validated as a save would. */
function listingSave(key: string, values: StoredSection["values"]) {
  const def = propertyPageCopyDef();
  const result = validateSections(def, [{ key, enabled: true, values }]);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return unknownTokenIssues(def, result.sections, LISTING);
}

describe("unknownTokensIn", () => {
  it("names each token not in the list, once", () => {
    expect(
      unknownTokensIn("{name} at {name} in {area} by {titel}", LISTING),
    ).toEqual(["{name}", "{titel}"]);
  });

  it("passes plain text and non-strings", () => {
    expect(unknownTokensIn("Ask anything.", LISTING)).toEqual([]);
    expect(unknownTokensIn(null, LISTING)).toEqual([]);
    expect(unknownTokensIn(true, LISTING)).toEqual([]);
  });
});

describe("unknownTokenIssues", () => {
  it("accepts the enquiry wording the client saved on production", () => {
    // `subpage/property/copy` as stored on 2026-09-24: `{title}` and
    // `{area}` throughout, both of them listing tokens.
    expect(
      listingSave("enquiry", {
        eyebrow: "Enquire about this property",
        eyebrow_ar: "استفسر عن هذا العقار",
        heading: "Ask anything about {title}.",
        heading_ar: "اسأل عن أي تفاصيل تخص العقار {title}.",
        dialog_title: "Enquire about {title}",
        dialog_title_ar: "استفسر عن {title}",
        dialog_note:
          "Please fill out the information below to learn more about {title} in {area}.",
        dialog_note_ar:
          "يرجى تعبئة المعلومات أدناه لمعرفة المزيد عن {title} في {area}.",
        dialog_note_no_advisor:
          "Please fill out the information below to learn more about {title} in {area}.",
        valuation_prompt: "Own elsewhere in {area}?",
        valuation_cta: "Request a Property Valuation",
      }),
    ).toEqual([]);
  });

  it("refuses the project card's token on a listing card, naming the ones that work", () => {
    const issues = listingSave("enquiry", { heading: "Ask about {name}." });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      section: "Enquiry card and dialog",
      field: "Heading",
    });
    expect(issues[0]!.message).toContain("{name} is not a token");
    expect(issues[0]!.message).toContain(
      "{reference}, {title}, {area}, {advisor} or {type}",
    );
  });

  it("checks the Arabic twin too, and says which box", () => {
    const issues = listingSave("enquiry", {
      heading: "Ask anything about {title}.",
      heading_ar: "اسأل عن {العنوان}.",
    });
    // `\w` does not match Arabic letters, so a token typed in Arabic is not a
    // token at all — it renders as typed, which is what it looks like.
    expect(issues).toEqual([]);

    const typo = listingSave("enquiry", {
      heading: "Ask anything about {title}.",
      heading_ar: "اسأل عن {titel}.",
    });
    expect(typo.map((i) => i.field)).toEqual(["Heading (Arabic)"]);
  });

  it("checks inside list items — the shared FAQ questions", () => {
    const issues = listingSave("faq", {
      eyebrow: "FAQ",
      heading: "Common questions.",
      items: [
        { q: "Is {reference} freehold?", a: "Ask {advisor}." },
        { q: "Where is {project}?", a: "In {area}." },
      ],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.field).toBe("Questions shown on every listing 2 · Question");
    expect(issues[0]!.message).toContain("{project}");
  });

  it("lists several unknown tokens in one message", () => {
    const [issue] = listingSave("similar", {
      eyebrow: "More in {suburb} near {city}",
      heading: "Nearby",
    });
    expect(issue!.message).toMatch(/^\{suburb\} or \{city\} are not tokens/);
  });

  it("passes every card's shipped wording against the tokens that card offers", () => {
    for (const card of CARDS) {
      const def = cardPageDef(card);
      expect(
        unknownTokenIssues(def, defaultDocument(def), card.tokens),
        card.key,
      ).toEqual([]);
    }
  });

  it("passes the whole shipped listing document", () => {
    const def = propertyPageCopyDef();
    expect(unknownTokenIssues(def, defaultDocument(def), LISTING)).toEqual([]);
  });
});
