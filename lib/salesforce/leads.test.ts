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
  leadPageUrl,
  missingRequiredFields,
  preferredLanguageFor,
  websiteListingUrl,
  PREFERRED_LANGUAGES,
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
    page_url: "https://www.bazarrealestate.ae/p/villa-baz-ad-04891",
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
    expect(payload.Website_Listing_URL__c).toBe("https://www.bazarrealestate.ae/p/villa-baz-ad-04891");
    // Removed from Lead__c at Bazar's request, 13 Oct 2026.
    expect(payload).not.toHaveProperty("Property_Reference__c");
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
      "Website_Listing_URL__c",
      "Preferred_Languages__c",
    ]);
    for (const key of Object.keys(buildLeadPayload(row({ locale: "ar" })))) {
      expect(allowed.has(key), `unexpected field ${key}`).toBe(true);
    }
  });

  it("sends the page a general lead came from, and nothing when none is known", () => {
    // Levarus assign website leads by this field (19 Oct 2026), so a lead
    // with no listing still carries its page. An empty string is not the
    // same as not passing it.
    const general = row({ property_reference: null, property_mode: null, source: "contact_page" });
    expect(buildLeadPayload({ ...general, page_url: "https://www.bazarrealestate.ae/buy" }).Website_Listing_URL__c).toBe(
      "https://www.bazarrealestate.ae/buy",
    );
    expect("Website_Listing_URL__c" in buildLeadPayload({ ...general, page_url: null })).toBe(false);
  });

  it("sends Preferred_Languages__c only with a value the picklist holds", () => {
    expect(buildLeadPayload(row({ locale: "ar" })).Preferred_Languages__c).toBe("Arabic");
    expect(buildLeadPayload(row({ locale: "en" })).Preferred_Languages__c).toBe("English");
    // A locale the picklist has no word for sends nothing rather than a value
    // Salesforce would reject.
    expect("Preferred_Languages__c" in buildLeadPayload(row({ locale: "fr" }))).toBe(false);
    for (const locale of ["ar", "en", "fr", ""]) {
      const v = preferredLanguageFor(locale);
      if (v) expect(PREFERRED_LANGUAGES as readonly string[]).toContain(v);
    }
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
    // Country_Code__c is a restricted picklist of 207 values, which no doc
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

  it("sends a Russian number now the picklist has +7", () => {
    // +7 was missing from the org's first 206 values; Levarus added it on
    // 25 Sept in both orgs.
    const payload = buildLeadPayload(row({ phone: "+79161234567" }));
    expect(payload.Country_Code__c).toBe("+7");
    expect(payload.Phone__c).toBe("9161234567");
    expect(missingRequiredFields(payload)).not.toContain("Country_Code__c");
  });

  it("never sends a code the picklist does not hold, rather than mislabelling it", () => {
    // Sending a wrong code would put bad data in the CRM and look like
    // success; leaving it out lets Salesforce say what it wants instead.
    // +999 is unassigned: no picklist holds it.
    const payload = buildLeadPayload(row({ phone: "+99955512345" }));
    expect("Country_Code__c" in payload).toBe(false);
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

  it("carries the page the form was sent from, and the project", () => {
    const text =
      buildDescription(
        row({
          page_url: "https://www.bazarrealestate.ae/ar/developments/yas-riva-reserve",
          project_name: "Yas Riva Reserve",
        }),
      ) ?? "";
    expect(text).toContain("Page: https://www.bazarrealestate.ae/ar/developments/yas-riva-reserve");
    expect(text).toContain("Project: Yas Riva Reserve");
    expect(buildDescription(row({ page_url: null }))).not.toContain("Page:");
  });

  it("names the website's page when the listing came from Salesforce", () => {
    // The reference field then carries the CRM's own listing name, which is
    // what a CRM user can look up; the BAZ- reference goes here instead.
    const payload = buildLeadPayload(
      row({ property_reference: "LST-00003", website_reference: "BAZ-AD-04891" }),
    );
    expect(payload.Description__c).toContain("Property: LST-00003");
    expect(payload.Description__c).toContain("Website listing: BAZ-AD-04891");
    expect(buildDescription(row())).not.toContain("Website listing:");
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

  it("files Other where none of Buy, Sell or Rent is true", () => {
    // "Other" joined the picklist on 19 Oct 2026; these were Buy before.
    expect(inquiryTypeFor(null, null, "property_management")).toBe("Other");
    expect(inquiryTypeFor("manage", null, "property_consultation")).toBe("Other");
    expect(inquiryTypeFor("manage", "buy", "property_page")).toBe("Other");
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

describe("leadPageUrl", () => {
  it("links the page on the site's own origin", () => {
    expect(leadPageUrl([null, "/ar/p/the-wadi-baz-ad-08542"], "https://www.bazarrealestate.ae/")).toBe(
      "https://www.bazarrealestate.ae/ar/p/the-wadi-baz-ad-08542",
    );
    expect(leadPageUrl(["/services/sell"], undefined)).toBe("https://www.bazarrealestate.ae/services/sell");
  });

  it("links nothing that is not a path on this site", () => {
    expect(leadPageUrl([], undefined)).toBeNull();
    expect(leadPageUrl(["https://evil.test/x", "//evil.test/x"], undefined)).toBeNull();
  });
});

describe("websiteListingUrl", () => {
  const SITE = "https://www.bazarrealestate.ae";
  it("prefers the page the form was sent from, /ar included", () => {
    expect(websiteListingUrl(row({ page_url: `${SITE}/ar/p/villa-baz-ad-04891`, property_path: "/p/villa-baz-ad-04891" }), SITE)).toBe(`${SITE}/ar/p/villa-baz-ad-04891`);
  });

  it("links the listing's own page when no submission recorded one", () => {
    expect(websiteListingUrl(row({ page_url: null, property_path: "/p/villa-baz-ad-04891" }), SITE)).toBe(
      `${SITE}/p/villa-baz-ad-04891`,
    );
  });

  it("links the project's page for a project enquiry", () => {
    expect(
      websiteListingUrl(
        row({ page_url: null, property_reference: null, property_path: null, project_slug: "bab-al-qasr" }),
        SITE,
      ),
    ).toBe(`${SITE}/developments/bab-al-qasr`);
  });
});

describe("missingRequiredFields", () => {
  it("blocks only a lead with no email — one without a phone is sent", () => {
    // The forms ask for email OR phone. Since 13 Oct 2026 a phoneless lead
    // goes to Salesforce, which decides; email is still checked here.
    expect(missingRequiredFields(buildLeadPayload(row({ phone: null })))).toEqual([]);
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
