import { describe, it, expect } from "vitest";
import { getFormDef } from "@/lib/forms/registry";
import {
  OWNER_FORM_KEYS,
  budgetLabel,
  compactAed,
  isOwnerLead,
  leadFacts,
  type LeadFactsInput,
} from "./profile";

function input(overrides: Partial<LeadFactsInput> = {}): LeadFactsInput {
  return {
    source: "contact_page",
    formKey: null,
    def: null,
    inferred: null,
    budgetMin: null,
    budgetMax: null,
    timeline: null,
    preApproved: false,
    locale: "en",
    propertyMode: null,
    ...overrides,
  };
}

function withForm(key: string, overrides: Partial<LeadFactsInput> = {}) {
  return input({ formKey: key, def: getFormDef(key), ...overrides });
}

const valueOf = (facts: ReturnType<typeof leadFacts>, label: string) =>
  facts.find((f) => f.label === label)?.value;

describe("OWNER_FORM_KEYS", () => {
  it("names only forms that exist — a rename must fail here, not relabel landlords", () => {
    for (const key of OWNER_FORM_KEYS) {
      expect(getFormDef(key), key).not.toBeNull();
    }
  });
});

describe("leadFacts — intent", () => {
  it("reads 'rent' as letting out on an owner's form…", () => {
    const facts = leadFacts(
      withForm("home_list_property", { inferred: { intent: "rent" } }),
    );
    expect(valueOf(facts, "Intent")).toBe("Letting out");
  });

  it("…and as renting on a tenant's", () => {
    const facts = leadFacts(
      withForm("rent_lead_band", { inferred: { intent: "rent" } }),
    );
    expect(valueOf(facts, "Intent")).toBe("Renting");
  });

  it("falls back to the form's own intent when nobody asked", () => {
    expect(valueOf(leadFacts(withForm("buy_hero_enquiry")), "Intent")).toBe(
      "Buying",
    );
    expect(valueOf(leadFacts(withForm("rent_hero_enquiry")), "Intent")).toBe(
      "Renting",
    );
  });

  it("reads a listing enquiry by the listing's mode", () => {
    expect(
      valueOf(
        leadFacts(input({ source: "property_page", propertyMode: "rent" })),
        "Intent",
      ),
    ).toBe("Renting");
    expect(
      valueOf(
        leadFacts(input({ source: "property_page", propertyMode: "off_plan" })),
        "Intent",
      ),
    ).toBe("Buying");
  });

  it("recognises owner leads from before form keys were recorded", () => {
    expect(
      isOwnerLead({
        formKey: null,
        source: "contact_page",
        inferred: { lead_kind: "owner_listing" },
      }),
    ).toBe(true);
    expect(
      valueOf(
        leadFacts(input({ source: "list_property", inferred: { intent: "rent" } })),
        "Intent",
      ),
    ).toBe("Letting out");
  });

  it("says nothing rather than guess", () => {
    expect(valueOf(leadFacts(input()), "Intent")).toBeUndefined();
  });
});

describe("leadFacts — the rest of the strip", () => {
  it("reads budget, timeline, pre-approval and language in a fixed order", () => {
    const facts = leadFacts(
      withForm("buy_hero_enquiry", {
        budgetMin: 2_000_000,
        budgetMax: 4_000_000,
        timeline: "three_months",
        preApproved: true,
        locale: "ar",
      }),
    );
    expect(facts).toEqual([
      { label: "Intent", value: "Buying" },
      { label: "Budget", value: "AED 2M – 4M" },
      { label: "Timeline", value: "Next 3 months" },
      { label: "Mortgage", value: "Pre-approved" },
      { label: "Language", value: "Arabic" },
    ]);
  });

  it("is empty for a lead that told us nothing", () => {
    expect(leadFacts(input())).toEqual([]);
  });

  it("ignores a timeline value it doesn't know", () => {
    expect(valueOf(leadFacts(input({ timeline: "someday" })), "Timeline")).toBe(
      undefined,
    );
  });
});

describe("budgetLabel", () => {
  it("spells out open ends", () => {
    expect(budgetLabel(15_000_000, null)).toBe("AED 15M+");
    expect(budgetLabel(null, 1_000_000)).toBe("Up to AED 1M");
    expect(budgetLabel(0, 0)).toBeNull();
    expect(budgetLabel(null, null)).toBeNull();
  });
});

describe("compactAed", () => {
  it("drops trailing zeros and keeps real precision", () => {
    expect(compactAed(2_000_000)).toBe("2M");
    expect(compactAed(2_500_000)).toBe("2.5M");
    expect(compactAed(1_250_000)).toBe("1.25M");
    expect(compactAed(85_000)).toBe("85K");
    expect(compactAed(750)).toBe("750");
  });

  it("says 1M rather than 1000K at the boundary", () => {
    expect(compactAed(999_999)).toBe("1M");
  });
});
