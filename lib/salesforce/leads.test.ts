import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    SALESFORCE_LEAD_OBJECT: undefined,
    SALESFORCE_LEAD_EXTERNAL_ID_FIELD: undefined,
  },
  isSalesforceConfigured: true,
}));

const {
  buildLeadPayload,
  buildDescription,
  inquiryTypeFor,
  leadSourceFor,
  leadObjectName,
  leadExternalIdField,
  missingRequiredFields,
  INQUIRY_TYPES,
  LEAD_SOURCES,
} = await import("./leads");
const { SALESFORCE_COUNTRY_CODES } = await import("./phone");
type LeadSourceRow = Parameters<typeof buildLeadPayload>[0];

function row(over: Partial<LeadSourceRow> = {}): LeadSourceRow {
  return {
    id: "3f1c9e64-1111-4222-8333-444455556666",
    name: "Keshav Dubey",
    email: "keshav.d@levarus.com",
    phone: "+971501234567",
    brief_raw: "Looking for property in Saadiyat.",
    source: "property_page",
    form_key: "property-enquiry",
    locale: "en",
    intent: null,
    property_reference: "BAZ-AD-04891",
    property_mode: "buy",
    ...over,
  };
}

describe("buildLeadPayload", () => {
  it("maps a property enquiry onto the documented Lead__c fields", () => {
    const payload = buildLeadPayload(row());
    expect(payload.Name__c).toBe("Keshav Dubey");
    expect(payload.Email__c).toBe("keshav.d@levarus.com");
    expect(payload.Country_Code__c).toBe("+971");
    expect(payload.Phone__c).toBe("501234567");
    expect(payload.Lead_Source__c).toBe("Website");
    expect(payload.Inquiry_Type__c).toBe("Buy");
    expect(payload.Property_Reference__c).toBe("BAZ-AD-04891");
  });

  it("emits only the fields the doc names", () => {
    // An unknown field is rejected as hard as an unknown picklist value, and
    // takes the whole record with it. This is the guard against someone
    // adding a mapping before Salesforce has the field.
    const allowed = new Set([
      "Name__c",
      "Country_Code__c",
      "Phone__c",
      "Email__c",
      "Lead_Source__c",
      "Description__c",
      "Inquiry_Type__c",
      "Property_Reference__c",
    ]);
    for (const key of Object.keys(buildLeadPayload(row()))) {
      expect(allowed.has(key), `unexpected field ${key}`).toBe(true);
    }
  });

  it("omits the property reference for a lead with no listing attached", () => {
    // "pass this value when enquiry about property" — an empty string is not
    // the same as not passing it.
    const payload = buildLeadPayload(
      row({ property_reference: null, property_mode: null, source: "contact_page" }),
    );
    expect("Property_Reference__c" in payload).toBe(false);
  });

  it("omits both phone fields when the enquiry carries no usable number", () => {
    const payload = buildLeadPayload(row({ phone: null }));
    expect("Phone__c" in payload).toBe(false);
    expect("Country_Code__c" in payload).toBe(false);
  });

  it("always sets both required picklists", () => {
    // Both are Required as of the 23 Sept revision, so an omission is a
    // REQUIRED_FIELD_MISSING that loses the lead. No input may leave either
    // blank.
    for (const mode of ["buy", "rent", "off_plan", "commercial"] as const) {
      for (const src of ["property_page", "contact_page", "concierge"] as const) {
        const payload = buildLeadPayload(
          row({ property_mode: mode, source: src }),
        );
        expect(payload.Inquiry_Type__c, `${mode}/${src}`).toBeTruthy();
        expect(payload.Lead_Source__c, `${mode}/${src}`).toBeTruthy();
      }
    }
  });

  it("only ever emits values the picklists accept", () => {
    // The module's own lists, so this cannot drift from what it emits.
    const types = new Set<string>(INQUIRY_TYPES);
    const sources = new Set<string>(LEAD_SOURCES);
    const SOURCES = [
      "property_page", "contact_page", "concierge", "valuation", "mortgage",
      "blog_cta", "agent_page", "share_with_advisor", "whatsapp_inbound",
      "brochure", "development_interest", "list_property",
      "property_management", "property_consultation",
    ] as const;
    const MODES = [null, "buy", "rent", "off_plan", "commercial"] as const;
    const INTENTS = [null, "buy", "sell", "rent", "invest", "manage"] as const;

    for (const source of SOURCES) {
      for (const property_mode of MODES) {
        for (const intent of INTENTS) {
          const p = buildLeadPayload(row({ source, property_mode, intent }));
          expect(types.has(p.Inquiry_Type__c!), `${source}/${property_mode}/${intent}`).toBe(true);
          expect(sources.has(p.Lead_Source__c!), source).toBe(true);
        }
      }
    }
  });

  it("truncates to the field's REAL length, not an assumed 255", () => {
    // Read from a describe of the live object. Email__c is 80 and Phone__c
    // is 40 — both were 255 here until 24 Sept, on the assumption of
    // Salesforce text defaults that neither vendor doc confirmed. An address
    // over 80 characters is unusual but legal, and would have failed the
    // whole record with STRING_TOO_LONG instead of being trimmed.
    expect(
      buildLeadPayload(row({ name: "x".repeat(400) })).Name__c,
    ).toHaveLength(255);
    const longEmail = `${"a".repeat(90)}@example.com`;
    expect(
      buildLeadPayload(row({ email: longEmail })).Email__c!.length,
    ).toBeLessThanOrEqual(80);
  });

  it("only ever sends a country code the picklist accepts", () => {
    // Country_Code__c is a restricted picklist of 206 values, which no doc
    // mentioned. Anything outside it fails the whole record.
    const numbers = [
      "+971501234567", "0501234567", "+441234567890", "+12125551234",
      "+79161234567", "+9995551234567", "971501234567",
    ];
    for (const phone of numbers) {
      const code = buildLeadPayload(row({ phone })).Country_Code__c;
      if (code === undefined) continue; // refused locally, which is the point
      expect(
        SALESFORCE_COUNTRY_CODES.has(code.replace("+", "")),
        `${phone} produced ${code}`,
      ).toBe(true);
    }
  });

  it("refuses a Russian number rather than mislabelling it", () => {
    // +7 is absent from the org's picklist though every neighbour is there.
    // Blocking keeps the lead visible and recoverable in the CMS; sending a
    // wrong code would put bad data in the CRM and look like success.
    const payload = buildLeadPayload(row({ phone: "+79161234567" }));
    expect("Country_Code__c" in payload).toBe(false);
    expect(missingRequiredFields(payload)).toContain("Country_Code__c");
    // The digits are not thrown away.
    expect(payload.Phone__c).toBeTruthy();
  });

  it("treats a whitespace-only value as absent", () => {
    const payload = buildLeadPayload(row({ email: "   " }));
    expect("Email__c" in payload).toBe(false);
  });
});

describe("buildDescription", () => {
  it("carries the visitor's message plus what Lead__c has no field for", () => {
    const text = buildDescription(row({ locale: "ar" })) ?? "";
    expect(text).toContain("Looking for property in Saadiyat.");
    expect(text).toContain("Form: property-enquiry");
    expect(text).toContain("Language: ar");
    // The only correlation back to this database until there is a real
    // External ID field on the object.
    expect(text).toContain(row().id);
  });

  it("does not label English, which is the default", () => {
    expect(buildDescription(row())).not.toContain("Language:");
  });

  it("still identifies the enquiry when the visitor wrote nothing", () => {
    const text = buildDescription(row({ brief_raw: null })) ?? "";
    expect(text).toContain(row().id);
    expect(text.startsWith("\n")).toBe(false);
  });
});

describe("inquiryTypeFor", () => {
  it("lets the visitor's stated intent outrank the page they were on", () => {
    // Someone on a for-sale listing who ticked "rent" means it. Reading the
    // listing's mode over their own answer would file them as a buyer.
    expect(inquiryTypeFor("rent", "buy", "property_page")).toBe("Rent");
    expect(inquiryTypeFor("sell", "buy", "property_page")).toBe("Sell");
  });

  it("treats an investor as a buyer", () => {
    expect(inquiryTypeFor("invest", null, "contact_page")).toBe("Buy");
  });

  it("reads the listing's mode when no intent was given", () => {
    expect(inquiryTypeFor(null, "buy", "contact_page")).toBe("Buy");
    expect(inquiryTypeFor(null, "rent", "contact_page")).toBe("Rent");
    // Off-plan is a purchase — the unit is sold, it just is not built yet.
    expect(inquiryTypeFor(null, "off_plan", "contact_page")).toBe("Buy");
  });

  it("does not guess from `commercial`, which conflates sale and lease", () => {
    // Falls through to source/fallback rather than coin-flipping.
    expect(inquiryTypeFor(null, "commercial", "valuation")).toBe("Sell");
  });

  it("recognises the seller-side forms", () => {
    // The half of the business "Sell" exists for. Before the picklist was
    // published these went out labelled as buyers.
    expect(inquiryTypeFor(null, null, "valuation")).toBe("Sell");
    expect(inquiryTypeFor(null, null, "list_property")).toBe("Sell");
  });

  it("falls back to Buy where none of the three is true", () => {
    // Required field, so there is no option to say nothing. Documented
    // compromise, not a mapping.
    expect(inquiryTypeFor(null, null, "property_management")).toBe("Buy");
    expect(inquiryTypeFor("manage", null, "property_consultation")).toBe("Buy");
  });
});

describe("leadSourceFor", () => {
  it("calls a web form Website", () => {
    expect(leadSourceFor("property_page")).toBe("Website");
  });

  it("does not claim WhatsApp came from the website", () => {
    // The picklist has no WhatsApp value; Others is the honest one.
    expect(leadSourceFor("whatsapp_inbound")).toBe("Others");
  });
});

describe("missingRequiredFields", () => {
  it("names what Salesforce would reject", () => {
    // 279 of 772 production leads have no phone — this site has always asked
    // for email OR phone, and the CRM now demands both.
    expect(missingRequiredFields(buildLeadPayload(row({ phone: null })))).toEqual(
      ["Phone__c", "Country_Code__c"],
    );
    expect(missingRequiredFields(buildLeadPayload(row({ email: null })))).toEqual(
      ["Email__c"],
    );
  });

  it("passes a complete lead", () => {
    expect(missingRequiredFields(buildLeadPayload(row()))).toEqual([]);
  });
});

describe("leadExternalIdField", () => {
  it("defaults to the field the vendor confirmed", () => {
    // Defaulted rather than env-gated: a blank env var would silently fall
    // back to POST and duplicate leads on every retry.
    expect(leadExternalIdField()).toBe("External_ID__c");
  });
});

describe("leadObjectName", () => {
  it("defaults to the object the doc names", () => {
    expect(leadObjectName()).toBe("Lead__c");
  });
});
