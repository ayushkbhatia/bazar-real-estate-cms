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

const { pushLead, LOCAL_BLOCK_PREFIX } = await import("./leads");
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

  it("refuses a lead with no phone without calling Salesforce", async () => {
    // 279 of 772 production leads look like this. Each would be a guaranteed
    // non-retryable 400, so five round trips to learn what is knowable here.
    const out = await pushLead(row({ phone: null }));

    expect(salesforceRequest).not.toHaveBeenCalled();
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.retryable).toBe(false);
    expect(out.ok === false && out.message).toContain(LOCAL_BLOCK_PREFIX);
    expect(out.ok === false && out.message).toContain("Phone__c");
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
