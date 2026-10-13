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

const { pushLead } = await import("./leads");
type Row = Parameters<typeof pushLead>[0];

const UUID = "3f1c9e64-1111-4222-8333-444455556666";

function row(over: Partial<Row> = {}): Row {
  return {
    id: UUID,
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

beforeEach(() => salesforceRequest.mockReset());

describe("pushLead", () => {
  it("upserts by external id rather than creating", async () => {
    // The whole point of the 23 Sept revision. A POST here would mean
    // at-least-once delivery and a duplicate lead on any retry.
    salesforceRequest.mockResolvedValue({ id: "a04X", created: true });

    const out = await pushLead(row());

    expect(out).toEqual({ ok: true, id: "a04X" });
    const [path, init] = salesforceRequest.mock.calls[0];
    expect(path).toBe(`sobjects/Lead__c/External_ID__c/${UUID}`);
    expect(init.method).toBe("PATCH");
  });

  it("sends the UUID in the URL, not the body", async () => {
    // Salesforce infers the external id from the path on an upsert; the
    // vendor's own example request body omits it.
    salesforceRequest.mockResolvedValue({ id: "a04X", created: true });
    await pushLead(row());
    const [, init] = salesforceRequest.mock.calls[0];
    expect("External_ID__c" in init.body).toBe(false);
  });

  it("accepts the update response, which carries created:false", async () => {
    // 200 + created:false is what a second push of the same enquiry answers.
    // Treating that as anything but success would re-queue a delivered lead.
    salesforceRequest.mockResolvedValue({ id: "a04X", created: false });
    expect(await pushLead(row())).toEqual({ ok: true, id: "a04X" });
  });

  it("survives a bodyless 204, which the vendor doc does not mention", async () => {
    salesforceRequest.mockResolvedValue(null);
    expect(await pushLead(row())).toEqual({ ok: true, id: UUID });
  });

  it("sends a lead with no phone and lets Salesforce decide", async () => {
    // The forms ask for email OR phone; Bazar chose (13 Oct 2026) to send
    // these rather than block them, so they arrive the day Levarus relax
    // Phone__c without a change here.
    await pushLead(row({ phone: null }));
    expect(salesforceRequest).toHaveBeenCalledTimes(1);
    const body = (salesforceRequest.mock.calls[0][1] as { body: Record<string, unknown> }).body;
    expect(body).not.toHaveProperty("Phone__c");
    expect(body).not.toHaveProperty("Country_Code__c");
  });

  it("resends without Website_Listing_URL__c if the org has no such field", async () => {
    // Its API name on Lead__c is assumed; a wrong guess must not lose the lead.
    salesforceRequest
      .mockImplementationOnce(async () => {
        throw new FakeSalesforceError("No such column 'Website_Listing_URL__c' on sobject of type Lead__c", {
          status: 400,
          errorCode: "INVALID_FIELD",
          retryable: false,
        });
      })
      .mockResolvedValueOnce({ id: "a04Y", created: true });
    const out = await pushLead(row());
    expect(out).toEqual({ ok: true, id: "a04Y" });
    expect(salesforceRequest).toHaveBeenCalledTimes(2);
    const first = (salesforceRequest.mock.calls[0][1] as { body: Record<string, unknown> }).body;
    const second = (salesforceRequest.mock.calls[1][1] as { body: Record<string, unknown> }).body;
    expect(first.Website_Listing_URL__c).toBe("https://www.bazarrealestate.ae/p/villa-baz-ad-04891");
    expect(first).not.toHaveProperty("Property_Reference__c");
    expect(second).not.toHaveProperty("Website_Listing_URL__c");
    expect(String(second.Description__c)).toContain("Page: https://www.bazarrealestate.ae/p/villa-baz-ad-04891");
  });

  it("does not retry other field errors", async () => {
    salesforceRequest.mockImplementationOnce(async () => {
      throw new FakeSalesforceError("No such column 'Budget__c'", { status: 400, errorCode: "INVALID_FIELD", retryable: false });
    });
    const out = await pushLead(row());
    expect(out.ok).toBe(false);
    expect(salesforceRequest).toHaveBeenCalledTimes(1);
  });

  it("refuses a lead with no email the same way", async () => {
    const out = await pushLead(row({ email: null }));
    expect(salesforceRequest).not.toHaveBeenCalled();
    expect(out.ok === false && out.message).toContain("Email__c");
  });

  // How a *remote* rejection maps onto PushResult — including that a 400
  // picklist error comes back non-retryable — is asserted in client.test.ts
  // against the real client with a stubbed fetch. Reproducing it here needs a
  // mocked rejection, which vitest reports as an unhandled error even when
  // pushLead catches it correctly, so the coverage lives where it can be
  // written honestly.
});
