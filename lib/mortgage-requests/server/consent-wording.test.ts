import { describe, expect, it } from "vitest";
import en from "@/messages/en/mortgage.json";
import ar from "@/messages/ar/mortgage.json";
import { defaultDocument } from "@/lib/master-pages";
import { wizardPageDef, wizardStoredValues } from "@/lib/master-pages/wizards";
import type { SectionValues } from "@/lib/master-pages";
import { consentWordingFrom } from "./consent-wording";

const def = wizardPageDef("mortgage-application");
const saved = (values: SectionValues) =>
  wizardStoredValues(defaultDocument(def).map((s) => (s.key === "documents" ? { ...s, values: { ...s.values, ...values } } : s)));

describe("the consent wording a record stores", () => {
  it("is the catalogue's, in the page's language, when nothing is saved", () => {
    expect(consentWordingFrom(null, "en")).toBe(en.consent.label);
    expect(consentWordingFrom(null, "ar")).toBe(ar.consent.label);
    expect(consentWordingFrom("not a document", "ar")).toBe(ar.consent.label);
  });

  it("is the editor's, when Bazar rewrote it — each language its own", () => {
    const blocks = saved({ "consent.label": "I agree to share my documents.", "consent.label_ar": "أوافق على مشاركة مستنداتي." });
    expect(consentWordingFrom(blocks, "en")).toBe("I agree to share my documents.");
    expect(consentWordingFrom(blocks, "ar")).toBe("أوافق على مشاركة مستنداتي.");
  });

  it("keeps the catalogue's Arabic when only the English was rewritten", () => {
    const blocks = saved({ "consent.label": "I agree to share my documents." });
    expect(consentWordingFrom(blocks, "ar")).toBe(ar.consent.label);
  });
});
