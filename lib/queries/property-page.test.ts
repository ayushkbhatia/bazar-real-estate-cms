/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { FSI, PDI, stripIsolates } from "@/lib/i18n/bidi";
import { subPageSlug } from "@/lib/master-pages/subpages";
import { getPropertyPageCopy, propertyPageCopySlug } from "./property-page";

/**
 * One listing's shared wording, as the page receives it.
 *
 * Runs with no Supabase configured — the fallback branch, which resolves the
 * registry defaults exactly as an unsaved document does — so the assertions
 * describe what every listing renders until someone edits the document.
 */
const EN = {
  reference: "BAZ-AD-09790",
  title: "Al Ghadeer Gardens",
  area: "Al Ghadeer",
  advisor: "Bazar Real Estate",
  type: "villa",
};

const AR = {
  reference: "BAZ-AD-09790",
  title: "الغدير جاردنز",
  area: "الغدير",
  advisor: "بازار للعقارات",
  type: "فيلا",
};

describe("the listing page's shared wording", () => {
  it("lives at the property sub-page slug", () => {
    expect(propertyPageCopySlug()).toBe(subPageSlug("property", "copy"));
    expect(propertyPageCopySlug()).toBe("subpage/property/copy");
  });

  it("renders the English the page's literals used to, byte for byte", async () => {
    const copy = await getPropertyPageCopy(EN, "en");
    expect(copy.text("specification", "eyebrow")).toBe("Specification");
    expect(copy.text("specification", "heading")).toBe("The full detail.");
    expect(copy.text("advisor-note", "eyebrow")).toBe("Advisor's note");
    expect(copy.text("advisor", "eyebrow")).toBe("Lead advisor");
    expect(copy.text("advisor", "enquire_label")).toBe(
      "Enquire about BAZ-AD-09790",
    );
    expect(copy.text("enquiry", "valuation_prompt")).toBe(
      "Own elsewhere in Al Ghadeer?",
    );
    expect(copy.text("enquiry", "dialog_title")).toBe(
      "Enquire about Al Ghadeer Gardens",
    );
    expect(copy.text("similar", "eyebrow")).toBe("More in Al Ghadeer");
    expect(copy.text("similar", "heading")).toBe("Nearby Properties");
    expect(copy.text("faq", "heading")).toBe(
      "Common questions, plainly answered.",
    );
    // No isolate marks anywhere in English — they would travel into the
    // FAQPage JSON-LD and the page's text for no reason.
    expect(copy.faq.map((f) => f.q + f.a).join("")).not.toMatch(/[⁦-⁩]/);
  });

  it("keeps the shared questions' English exactly as the component had them", async () => {
    const { faq } = await getPropertyPageCopy(EN, "en");
    expect(faq.map((f) => f.q)).toEqual([
      "What does the transfer process look like?",
      "What are the service charges?",
      "Is BAZ-AD-09790 mortgageable?",
    ]);
    expect(faq[0]!.a).toMatch(/^DLD-registered villa transfers follow/);
  });

  it("renders Arabic on /ar, with no English word left in a heading", async () => {
    const copy = await getPropertyPageCopy(AR, "ar");
    for (const [section, field] of [
      ["advisor-note", "eyebrow"],
      ["description", "eyebrow"],
      ["floor-plan", "eyebrow"],
      ["floor-plan", "heading"],
      ["amenities", "eyebrow"],
      ["location", "eyebrow"],
      ["specification", "eyebrow"],
      ["specification", "heading"],
      ["advisor", "eyebrow"],
      ["enquiry", "eyebrow"],
      ["enquiry", "valuation_prompt"],
      ["enquiry", "valuation_cta"],
      ["faq", "eyebrow"],
      ["faq", "heading"],
      ["similar", "eyebrow"],
      ["similar", "heading"],
    ] as const) {
      const value = stripIsolates(copy.text(section, field));
      expect(value, `${section}.${field}`).toMatch(/[؀-ۿ]/);
      expect(value, `${section}.${field}`).not.toMatch(/[A-Za-z]{3,}/);
    }
    for (const { q, a } of copy.faq) {
      // The reference is the only Latin allowed in an answer or a question.
      expect(stripIsolates(q).replace("BAZ-AD-09790", "")).not.toMatch(
        /[A-Za-z]{3,}/,
      );
      expect(stripIsolates(a)).toMatch(/[؀-ۿ]/);
    }
  });

  it("isolates the reference inside an Arabic sentence", async () => {
    // Unisolated, the bidi algorithm renders `BAZ-AD-09790` as
    // `09790-BAZ-AD` between Arabic words.
    const copy = await getPropertyPageCopy(AR, "ar");
    expect(copy.text("advisor", "enquire_label")).toContain(
      `${FSI}BAZ-AD-09790${PDI}`,
    );
    const mortgage = copy.faq.find((f) => f.q.includes("BAZ-AD-09790"))!;
    expect(mortgage.q).toContain(`${FSI}BAZ-AD-09790${PDI}`);
  });

  it("puts the Arabic type into the shared transfer answer", async () => {
    const { faq } = await getPropertyPageCopy(AR, "ar");
    // The component used to print the raw enum into both languages:
    // "تضم villa المكوّنة من 4 غرف نوم".
    expect(stripIsolates(faq[0]!.a)).toContain("نقل ملكية فيلا");
    expect(faq[0]!.a).not.toContain("villa");
  });

  it("lets a call site replace a token, for the no-area fallbacks", async () => {
    const copy = await getPropertyPageCopy({ ...EN, area: "the UAE" }, "en");
    expect(copy.text("similar", "eyebrow")).toBe("More in the UAE");
    expect(
      copy.text("enquiry", "valuation_prompt", { area: "this area" }),
    ).toBe("Own elsewhere in this area?");
  });

  it("leaves the reference token in place for the templates drawn as elements", async () => {
    const copy = await getPropertyPageCopy(EN, "en");
    expect(copy.template("enquiry", "heading")).toBe(
      "Ask anything about {reference}.",
    );
    expect(copy.template("enquiry", "dialog_note")).toBe(
      "Reference {reference} · goes straight to {advisor}, the advisor on this listing.",
    );
  });

  it("answers blank rather than throwing for a field it does not declare", async () => {
    const copy = await getPropertyPageCopy(EN, "en");
    expect(copy.text("specification", "nonsense")).toBe("");
    expect(copy.text("nonsense", "eyebrow")).toBe("");
  });
});
