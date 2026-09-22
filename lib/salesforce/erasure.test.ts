import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const INSTANCE = "https://bazarrealestate--sand.sandbox.my.salesforce.com";

vi.mock("@/lib/env", () => ({
  env: {
    SALESFORCE_INSTANCE_URL: INSTANCE,
    SALESFORCE_CLIENT_ID: "client-id",
    SALESFORCE_CLIENT_SECRET: "client-secret",
    SALESFORCE_LEAD_OBJECT: undefined,
    SALESFORCE_LEAD_EXTERNAL_ID_FIELD: undefined,
  },
  isSalesforceConfigured: true,
}));

const { buildErasurePayload, scrubLead, REDACTION_NOTICE } = await import(
  "./erasure"
);
const { __resetSalesforceTokenCache } = await import("./client");

const TOKEN_OK = {
  access_token: "tok",
  instance_url: INSTANCE,
  token_type: "Bearer",
};

type Call = { url: string; init: RequestInit };
let calls: Call[];

function jsonResponse(status: number, body: unknown): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetch(handler: (url: string) => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL, init: RequestInit = {}) => {
      calls.push({ url: String(input), init });
      return Promise.resolve(handler(String(input)));
    }),
  );
}

beforeEach(() => {
  calls = [];
  __resetSalesforceTokenCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildErasurePayload", () => {
  it("nulls the personal fields explicitly", () => {
    // `undefined` would be dropped by JSON.stringify and quietly leave the
    // subject's real name and phone number sitting in the CRM.
    const payload = buildErasurePayload("deleted-a1b2c3d4e5f6");
    expect(payload.Email__c).toBeNull();
    expect(payload.Phone__c).toBeNull();
    expect(payload.Country_Code__c).toBeNull();
    for (const key of ["Email__c", "Phone__c", "Country_Code__c"] as const) {
      expect(JSON.stringify(payload)).toContain(`"${key}":null`);
    }
  });

  it("carries the pseudonym Postgres already assigned", () => {
    // Reusing migration 0067's token is what lets an auditor line the CRM
    // record up against the database row.
    expect(buildErasurePayload("deleted-a1b2c3d4e5f6").Name__c).toBe(
      "deleted-a1b2c3d4e5f6",
    );
  });

  it("redacts the message with the same notice the database uses", () => {
    expect(buildErasurePayload("deleted-x").Description__c).toBe(
      REDACTION_NOTICE,
    );
    expect(REDACTION_NOTICE).toBe("[redacted at the data subject's request]");
  });

  it("leaves the non-identifying commercial facts alone", () => {
    // "a website lead about BAZ-AD-04891 wanting to buy" identifies nobody,
    // and is the fact the AML retention basis exists to preserve.
    const payload = buildErasurePayload("deleted-x") as Record<string, unknown>;
    for (const key of [
      "Lead_Source__c",
      "Inquiry_Type__c",
      "Property_Reference__c",
    ]) {
      expect(key in payload).toBe(false);
    }
  });
});

describe("scrubLead", () => {
  it("PATCHes the record by its Salesforce id", async () => {
    mockFetch((url) =>
      url.includes("/services/oauth2/token")
        ? jsonResponse(200, TOKEN_OK)
        : new Response(null, { status: 204 }),
    );

    const out = await scrubLead("a04iy0000000PsrAAE", "deleted-abc");
    expect(out).toEqual({ ok: true });

    const patch = calls[1];
    expect(patch.url).toBe(
      `${INSTANCE}/services/data/v67.0/sobjects/Lead__c/a04iy0000000PsrAAE`,
    );
    expect(patch.init.method).toBe("PATCH");
    expect(JSON.parse(String(patch.init.body))).toMatchObject({
      Name__c: "deleted-abc",
      Email__c: null,
      Phone__c: null,
    });
  });

  it("treats an already-deleted record as erased", async () => {
    // The sales team deleting the lead by hand discharges the obligation.
    // Retrying forever against a record that is gone would be wrong.
    for (const body of [
      [{ message: "The requested resource does not exist", errorCode: "NOT_FOUND" }],
      [{ message: "entity is deleted", errorCode: "ENTITY_IS_DELETED" }],
    ]) {
      __resetSalesforceTokenCache();
      calls = [];
      mockFetch((url) =>
        url.includes("/services/oauth2/token")
          ? jsonResponse(200, TOKEN_OK)
          : jsonResponse(404, body),
      );
      expect(await scrubLead("a04", "deleted-abc")).toEqual({ ok: true });
    }
  });

  it("reports a transient failure as retryable", async () => {
    mockFetch((url) =>
      url.includes("/services/oauth2/token")
        ? jsonResponse(200, TOKEN_OK)
        : jsonResponse(503, [
            { message: "Server unavailable", errorCode: "SERVER_UNAVAILABLE" },
          ]),
    );
    const out = await scrubLead("a04", "deleted-abc");
    expect(out.ok).toBe(false);
    expect(out).toMatchObject({ retryable: true });
  });

  it("reports a permanent failure as non-retryable", async () => {
    mockFetch((url) =>
      url.includes("/services/oauth2/token")
        ? jsonResponse(200, TOKEN_OK)
        : jsonResponse(400, [
            {
              message: "insufficient access rights on object id",
              errorCode: "INSUFFICIENT_ACCESS_OR_READONLY",
            },
          ]),
    );
    const out = await scrubLead("a04", "deleted-abc");
    expect(out.ok).toBe(false);
    expect(out).toMatchObject({ retryable: false });
    expect(out.ok === false && out.message).toContain(
      "INSUFFICIENT_ACCESS_OR_READONLY",
    );
  });
});
