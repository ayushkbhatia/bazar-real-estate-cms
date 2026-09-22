import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    SALESFORCE_LEAD_OBJECT: undefined,
    SALESFORCE_LEAD_EXTERNAL_ID_FIELD: undefined,
  },
  isSalesforceConfigured: true,
}));

const { buildLeadPayload, buildDescription, inquiryTypeFor, leadObjectName } =
  await import("./leads");
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

  it("omits an inquiry type it cannot map rather than guessing", () => {
    // Only "Buy" is evidenced by the doc. Sending an invented value fails the
    // create with INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST and loses the lead;
    // sending nothing leaves the field blank, which an advisor can fix.
    for (const mode of ["rent", "off_plan", "commercial"] as const) {
      const payload = buildLeadPayload(row({ property_mode: mode }));
      expect("Inquiry_Type__c" in payload, mode).toBe(false);
    }
  });

  it("truncates rather than letting STRING_TOO_LONG reject the record", () => {
    const payload = buildLeadPayload(row({ name: "x".repeat(400) }));
    expect(payload.Name__c).toHaveLength(255);
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
  it("prefers the listing's mode over the enquiry source", () => {
    expect(inquiryTypeFor("buy", "contact_page")).toBe("Buy");
  });

  it("falls back to the source when there is no listing", () => {
    expect(inquiryTypeFor(null, "property_page")).toBe("Buy");
    expect(inquiryTypeFor(null, "mortgage")).toBeUndefined();
  });
});

describe("leadObjectName", () => {
  it("defaults to the object the doc names", () => {
    expect(leadObjectName()).toBe("Lead__c");
  });
});
