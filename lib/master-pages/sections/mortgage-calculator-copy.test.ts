import { describe, expect, it } from "vitest";
import en from "@/messages/en/tools.json";
import ar from "@/messages/ar/tools.json";
import { defaultDocument, getMasterPage, resolveSections } from "../index";
import { flattenCatalogue, isCountedMessage, type Catalogue } from "../catalogue-copy";
import type { MasterPageDef, SectionValues } from "../types";
import {
  MORTGAGE_CALCULATOR_COPY_KEYS,
  MORTGAGE_CALCULATOR_COPY_SECTIONS,
  calculatorCopyHostedBy,
  calculatorCopyIssues,
  calculatorCopyOverlay,
  calculatorCopyStoredValues,
  isCalculatorCopySection,
} from "./mortgage-calculator-copy";

const EN = new Map(flattenCatalogue(en.mortgage as Catalogue));
const AR = new Map(flattenCatalogue(ar.mortgage as Catalogue));
const page = getMasterPage("mortgage") as MasterPageDef;

/** Every calculator-copy field, wherever it sits: its own sections, or the Mortgage calculator band. */
const copySections = [
  ...MORTGAGE_CALCULATOR_COPY_SECTIONS,
  { key: "scenario", ...calculatorCopyHostedBy("scenario") },
];

const docWith = (sectionKey: string, values: SectionValues) =>
  defaultDocument(page).map((s) => (s.key === sectionKey ? { ...s, values: { ...s.values, ...values } } : s));

describe("Mortgage page → calculator copy", () => {
  it("offers every tools.mortgage message except counted phrases, each once", () => {
    const fields = copySections.flatMap((s) => s.fields.map((f) => f.key));
    expect(new Set(fields).size).toBe(fields.length);
    for (const [key, message] of EN) {
      if (isCountedMessage(message)) expect(fields, key).not.toContain(key);
      else expect(fields, key).toContain(key);
    }
    expect(fields.length).toBe(MORTGAGE_CALCULATOR_COPY_KEYS.length);
  });

  it("starts from the catalogue: English as the default, its Arabic as the twin", () => {
    for (const section of copySections) {
      for (const field of section.fields) {
        expect(section.defaults[field.key], field.key).toBe(EN.get(field.key));
        expect(section.defaults[`${field.key}_ar`], field.key).toBe(AR.get(field.key));
      }
    }
  });

  it("sits on the Mortgage page after its bands, locked, and is listed with the service pages", () => {
    const keys = page.sections.map((s) => s.key);
    const copy = keys.filter(isCalculatorCopySection);
    expect(copy).toEqual(["calc_results", "calc_closing", "calc_compare", "calc_summary"]);
    expect(keys.slice(-copy.length)).toEqual(copy);
    expect(page.sections.filter((s) => isCalculatorCopySection(s.key)).every((s) => s.locked)).toBe(true);
    expect(page.label).toBe("Mortgage");
    expect(page.group).toBe("services");
  });

  it("puts the inputs' words on the Mortgage calculator section, beside the controls they name", () => {
    const scenario = page.sections.find((s) => s.key === "scenario")!;
    const keys = scenario.fields.map((f) => f.key);
    for (const key of ["interestRate", "term", "mortgageType", "typeFixed", "typeVariable", "typeHybrid", "buyerStatus", "statusUaeNational"]) {
      expect(keys, key).toContain(key);
    }
    expect(keys.indexOf("typeFixed")).toBeGreaterThan(keys.indexOf("type_default"));
    expect(scenario.fields.find((f) => f.key === "typeFixed")!.label).toBe("Mortgage type · Fixed button");
    expect(scenario.defaults.typeFixed_ar).toBe(AR.get("typeFixed"));
    expect(page.sections.some((s) => s.key === "calc_inputs")).toBe(false);
  });

  it("lets an edit through that keeps the placeholders", () => {
    expect(calculatorCopyIssues(docWith("scenario", { propertyPrice: "Home price · {symbol}" }))).toEqual([]);
  });

  it("refuses a dropped or invented placeholder and a stray brace, in either language", () => {
    expect(calculatorCopyIssues(docWith("scenario", { propertyPrice: "Home price" }))[0]!.message).toContain("Keep {symbol}");
    expect(calculatorCopyIssues(docWith("scenario", { propertyPrice: "Price {symbol} {name}" }))[0]!.message).toContain("{name}");
    const arabic = calculatorCopyIssues(docWith("scenario", { propertyPrice_ar: "سعر العقار" }));
    expect(arabic[0]!.field).toContain("(Arabic)");
    expect(calculatorCopyIssues(docWith("calc_results", { monthlyPayment: "Monthly {" })).length).toBeGreaterThan(0);
  });

  it("stores only what differs from the catalogue, and leaves the page's bands alone", () => {
    const stored = calculatorCopyStoredValues(docWith("scenario", { interestRate: "Rate", eyebrow: "" }));
    const scenario = stored.find((s) => s.key === "scenario")!.values;
    // The catalogue's words drop out; the band's own fields stay as they are,
    // a cleared eyebrow included.
    expect(scenario.interestRate).toBe("Rate");
    expect(scenario.typeFixed).toBeUndefined();
    expect(scenario.typeFixed_ar).toBeUndefined();
    expect(scenario.eyebrow).toBe("");
    expect(scenario.title).toBe(defaultDocument(page).find((s) => s.key === "scenario")!.values.title);
    expect(stored.find((s) => s.key === "calc_closing")!.values).toEqual({});
    const hero = defaultDocument(page).find((s) => s.key === "hero")!;
    expect(stored.find((s) => s.key === "hero")).toEqual(hero);
  });

  it("overlays only the edited messages, nested as the catalogue is, per locale", () => {
    const saved = calculatorCopyStoredValues(
      docWith("calc_closing", { "cashLine.dld_transfer": "Transfer fee · {pct}", "cashLine.dld_transfer_ar": "رسوم النقل · {pct}" }),
    );
    expect(calculatorCopyOverlay(resolveSections(page, saved, "en"), "en")).toEqual({
      cashLine: { dld_transfer: "Transfer fee · {pct}" },
    });
    expect(calculatorCopyOverlay(resolveSections(page, saved, "ar"), "ar")).toEqual({
      cashLine: { dld_transfer: "رسوم النقل · {pct}" },
    });
    expect(calculatorCopyOverlay(resolveSections(page, null, "ar"), "ar")).toEqual({});
  });

  it("overlays the Fixed / Variable / Hybrid and buyer-status wording from the Mortgage calculator section", () => {
    const saved = calculatorCopyStoredValues(
      docWith("scenario", { typeFixed: "Fixed rate", typeFixed_ar: "ثابت الفائدة", buyerStatus: "You are a", title: "Your numbers" }),
    );
    expect(calculatorCopyOverlay(resolveSections(page, saved, "en"), "en")).toEqual({
      typeFixed: "Fixed rate",
      buyerStatus: "You are a",
    });
    expect(calculatorCopyOverlay(resolveSections(page, saved, "ar"), "ar")).toEqual({ typeFixed: "ثابت الفائدة" });
  });
});
