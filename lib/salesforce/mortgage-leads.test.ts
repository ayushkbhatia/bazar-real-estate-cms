import { beforeEach, describe, expect, it, vi } from "vitest";

const salesforceRequest = vi.fn();

class FakeSalesforceError extends Error {
  status: number;
  errorCode: string | null;
  retryable: boolean;
  constructor(
    message: string,
    o: { status: number; errorCode?: string | null; retryable: boolean },
  ) {
    super(message);
    this.status = o.status;
    this.errorCode = o.errorCode ?? null;
    this.retryable = o.retryable;
  }
}

vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({
  salesforceRequest,
  SalesforceError: FakeSalesforceError,
}));
vi.mock("@/lib/env", () => ({
  env: {
    SALESFORCE_LEAD_OBJECT: undefined,
    SALESFORCE_LEAD_EXTERNAL_ID_FIELD: undefined,
  },
  isSalesforceConfigured: true,
}));

const {
  buildMortgageLeadPayload,
  buildMortgageDescription,
  isSampleMortgageRequest,
  pushMortgageLead,
  MORTGAGE_SERVICE_CRM_LABEL,
} = await import("./mortgage-leads");
const { INQUIRY_TYPES, LEAD_SOURCES } = await import("./leads");
type Row = Parameters<typeof buildMortgageLeadPayload>[0];

const SITE = "https://www.bazarrealestate.ae";
const UUID = "0b5a7c1e-2222-4333-8444-555566667777";

function row(over: Partial<Row> = {}): Row {
  return {
    id: UUID,
    reference: "BZM-26-0001",
    service: "pre_approval",
    full_name: "Layla Haddad",
    email: "layla@example.org",
    mobile_e164: "+971501234567",
    residency: "uae_resident_expat",
    employment_type: "salaried",
    entry_point: "calculator_preapproval",
    property_reference: null,
    property_slug: null,
    parent_reference: null,
    ...over,
  };
}

beforeEach(() => {
  salesforceRequest.mockReset();
});

describe("buildMortgageLeadPayload", () => {
  it("says which service the applicant chose", () => {
    expect(buildMortgageLeadPayload(row(), SITE).Mortgage_Service__c).toBe("Fast Pre-Approval (24-hour)");
    expect(buildMortgageLeadPayload(row({ service: "consultancy" }), SITE).Mortgage_Service__c).toBe(
      "Mortgage Consultancy",
    );
    expect(MORTGAGE_SERVICE_CRM_LABEL.pre_approval).toContain("Fast Pre-Approval");
  });

  it("sends the basic details, split the CRM's way", () => {
    const p = buildMortgageLeadPayload(row(), SITE);
    expect(p.Name__c).toBe("Layla Haddad");
    expect(p.Email__c).toBe("layla@example.org");
    expect(p.Country_Code__c).toBe("+971");
    expect(p.Phone__c).toBe("501234567");
  });

  it("fills both required picklists with values the org accepts", () => {
    const p = buildMortgageLeadPayload(row(), SITE);
    expect(LEAD_SOURCES).toContain(p.Lead_Source__c);
    expect(INQUIRY_TYPES).toContain(p.Inquiry_Type__c);
  });

  it("carries nothing from the file itself", () => {
    const p = buildMortgageLeadPayload(row(), SITE);
    expect(Object.keys(p).sort()).toEqual(
      [
        "Country_Code__c",
        "Description__c",
        "Email__c",
        "Inquiry_Type__c",
        "Lead_Source__c",
        "Mortgage_Service__c",
        "Name__c",
        "Phone__c",
      ].sort(),
    );
    expect(p.Description__c).not.toMatch(/birth|passport|emirates|document|statement|consent/i);
  });

  it("links the listing when the applicant started from one", () => {
    const p = buildMortgageLeadPayload(
      row({ entry_point: "property_detail", property_reference: "LST-00018", property_slug: "wadeem-gardens" }),
      SITE,
    );
    expect(p.Website_Listing_URL__c).toBe("https://www.bazarrealestate.ae/p/wadeem-gardens");
    expect(p.Description__c).toContain("Property: LST-00018");
  });
});

describe("buildMortgageDescription", () => {
  it("leads with the service, then the reference and profile, in words", () => {
    const lines = buildMortgageDescription(row(), SITE)!.split("\n");
    expect(lines[0]).toBe("Mortgage request: Fast Pre-Approval (24-hour)");
    expect(lines).toContain("Reference: BZM-26-0001");
    expect(lines).toContain("Residency: UAE Resident / Expat");
    expect(lines).toContain("Employment: Salaried");
    expect(lines).toContain("Started from: Mortgage calculator");
    expect(lines).toContain("Mortgage file: https://www.bazarrealestate.ae/admin/mortgages/BZM-26-0001");
    expect(lines.at(-1)).toBe(`Bazar mortgage request: ${UUID}`);
  });

  it("names the consultation a pre-approval was invited from", () => {
    const text = buildMortgageDescription(row({ entry_point: "consult_invite", parent_reference: "BZM-26-0002" }), SITE)!;
    expect(text).toContain("Follows consultation: BZM-26-0002");
  });
});

describe("isSampleMortgageRequest", () => {
  it("knows the walkthrough samples by their reserved domain", () => {
    expect(isSampleMortgageRequest("sara.k@example.com")).toBe(true);
    expect(isSampleMortgageRequest("SARA@EXAMPLE.COM ")).toBe(true);
    expect(isSampleMortgageRequest("someone@example.org")).toBe(false);
    expect(isSampleMortgageRequest("someone@gmail.com")).toBe(false);
  });
});

describe("pushMortgageLead", () => {
  it("upserts on the request's own id", async () => {
    salesforceRequest.mockResolvedValueOnce({ id: "a01X", created: true });
    const out = await pushMortgageLead(row(), SITE);
    expect(out).toEqual({ ok: true, id: "a01X" });
    expect(salesforceRequest.mock.calls[0][0]).toBe(`sobjects/Lead__c/External_ID__c/${UUID}`);
    expect(salesforceRequest.mock.calls[0][1]).toMatchObject({ method: "PATCH" });
  });

  it("still sends the lead while the org has no service field", async () => {
    salesforceRequest
      .mockImplementationOnce(async () => {
        throw new FakeSalesforceError("No such column 'Mortgage_Service__c' on sobject of type Lead__c", {
          status: 400,
          errorCode: "INVALID_FIELD",
          retryable: false,
        });
      })
      .mockResolvedValueOnce({ id: "a01Y", created: true });
    const out = await pushMortgageLead(row(), SITE);
    expect(out).toEqual({ ok: true, id: "a01Y" });
    const second = (salesforceRequest.mock.calls[1][1] as { body: Record<string, unknown> }).body;
    expect(second).not.toHaveProperty("Mortgage_Service__c");
    expect(String(second.Description__c)).toContain("Mortgage request: Fast Pre-Approval (24-hour)");
  });

  it("drops each missing optional field in turn", async () => {
    const missing = (field: string) => async () => {
      throw new FakeSalesforceError(`No such column '${field}' on sobject of type Lead__c`, {
        status: 400,
        errorCode: "INVALID_FIELD",
        retryable: false,
      });
    };
    salesforceRequest
      .mockImplementationOnce(missing("Website_Listing_URL__c"))
      .mockImplementationOnce(missing("Mortgage_Service__c"))
      .mockResolvedValueOnce({ id: "a01Z", created: true });
    const out = await pushMortgageLead(row({ property_reference: "LST-00018", property_slug: "wadeem-gardens" }), SITE);
    expect(out).toEqual({ ok: true, id: "a01Z" });
    expect(salesforceRequest).toHaveBeenCalledTimes(3);
    const last = (salesforceRequest.mock.calls[2][1] as { body: Record<string, unknown> }).body;
    expect(last).not.toHaveProperty("Website_Listing_URL__c");
    expect(last).not.toHaveProperty("Mortgage_Service__c");
  });
});
