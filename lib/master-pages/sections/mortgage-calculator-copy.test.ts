import { describe, expect, it } from "vitest";
import en from "@/messages/en/tools.json";
import ar from "@/messages/ar/tools.json";
import { defaultDocument, getMasterPage, resolveSections } from "../index";
import { flattenCatalogue, isCountedMessage, type Catalogue } from "../catalogue-copy";
import type { MasterPageDef, SectionValues } from "../types";
import {
  MORTGAGE_CALCULATOR_COPY_KEYS,
  MORTGAGE_CALCULATOR_COPY_SECTIONS,
  calculatorCopyIssues,
  calculatorCopyOverlay,
  calculatorCopyStoredValues,
  isCalculatorCopySection,
} from "./mortgage-calculator-copy";

const EN = new Map(flattenCatalogue(en.mortgage as Catalogue));
const AR = new Map(flattenCatalogue(ar.mortgage as Catalogue));
const page = getMasterPage("mortgage") as MasterPageDef;

const docWith = (sectionKey: string, values: SectionValues) =>
  defaultDocument(page).map((s) => (s.key === sectionKey ? { ...s, values: { ...s.values, ...values } } : s));

describe("Mortgage page → calculator copy", () => {
  it("offers every tools.mortgage message except counted phrases, each once", () => {
    const fields = MORTGAGE_CALCULATOR_COPY_SECTIONS.flatMap((s) => s.fields.map((f) => f.key));
    expect(new Set(fields).size).toBe(fields.length);
    for (const [key, message] of EN) {
      if (isCountedMessage(message)) expect(fields, key).not.toContain(key);
      else expect(fields, key).toContain(key);
    }
    expect(fields.length).toBe(MORTGAGE_CALCULATOR_COPY_KEYS.length);
  });

  it("starts from the catalogue: English as the default, its Arabic as the twin", () => {
    for (const section of MORTGAGE_CALCULATOR_COPY_SECTIONS) {
      for (const field of section.fields) {
        expect(section.defaults[field.key], field.key).toBe(EN.get(field.key));
        expect(section.defaults[`${field.key}_ar`], field.key).toBe(AR.get(field.key));
      }
    }
  });

  it("sits on the Mortgage page after its bands, locked, and is listed with the service pages", () => {
    const keys = page.sections.map((s) => s.key);
    const copy = keys.filter(isCalculatorCopySection);
    expect(copy).toEqual(["calc_inputs", "calc_results", "calc_closing", "calc_compare", "calc_summary"]);
    expect(keys.slice(-copy.length)).toEqual(copy);
    expect(page.sections.filter((s) => isCalculatorCopySection(s.key)).every((s) => s.locked)).toBe(true);
    expect(page.label).toBe("Mortgage");
    expect(page.group).toBe("services");
  });

  it("lets an edit through that keeps the placeholders", () => {
    expect(calculatorCopyIssues(docWith("calc_inputs", { propertyPrice: "Home price · {symbol}" }))).toEqual([]);
  });

  it("refuses a dropped or invented placeholder and a stray brace, in either language", () => {
    expect(calculatorCopyIssues(docWith("calc_inputs", { propertyPrice: "Home price" }))[0]!.message).toContain("Keep {symbol}");
    expect(calculatorCopyIssues(docWith("calc_inputs", { propertyPrice: "Price {symbol} {name}" }))[0]!.message).toContain("{name}");
    const arabic = calculatorCopyIssues(docWith("calc_inputs", { propertyPrice_ar: "سعر العقار" }));
    expect(arabic[0]!.field).toContain("(Arabic)");
    expect(calculatorCopyIssues(docWith("calc_results", { monthlyPayment: "Monthly {" })).length).toBeGreaterThan(0);
  });

  it("stores only what differs from the catalogue, and leaves the page's bands alone", () => {
    const stored = calculatorCopyStoredValues(docWith("calc_inputs", { interestRate: "Rate" }));
    expect(stored.find((s) => s.key === "calc_inputs")!.values).toEqual({ interestRate: "Rate" });
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
});
