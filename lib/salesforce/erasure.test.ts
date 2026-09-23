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

const {
  buildErasurePayload,
  buildErasureFallbackPayload,
  scrubLead,
  REDACTION_NOTICE,
} = await import("./erasure");
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
    for (const key of ["Email__c", "Phone__c"] as const) {
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

  it("does not touch Country_Code__c, which is a restricted picklist", () => {
    // It used to be nulled, then substituted with "+0" when the null was
    // refused — and neither is a value the picklist accepts, so erasure
    // would have failed in the CRM and then failed again on its fallback.
    // A dialling code identifies nobody once everything else is gone.
    const payload = buildErasurePayload("deleted-x") as Record<string, unknown>;
    expect("Country_Code__c" in payload).toBe(false);
    const fallback = buildErasureFallbackPayload("deleted-x") as Record<
      string,
      unknown
    >;
    expect("Country_Code__c" in fallback).toBe(false);
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

describe("buildErasureFallbackPayload", () => {
  it("carries no personal data and no reachable address", () => {
    const p = buildErasureFallbackPayload("deleted-abc");
    expect(p.Name__c).toBe("deleted-abc");
    expect(p.Description__c).toBe(REDACTION_NOTICE);
    // RFC 2606 reserves .invalid, so this can never be delivered even if an
    // advisor clicks it.
    expect(p.Email__c).toMatch(/\.invalid$/);
    expect(p.Phone__c).toBe("0000000000");
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

  it("erases by substitution when the org refuses a null", async () => {
    // Email__c, Phone__c and Country_Code__c are Required as of 23 Sept. If
    // that is Salesforce's field-level Required flag rather than just a
    // contract note, nulling them is rejected — and PDPL erasure would stop
    // reaching the CRM. Retrying with non-identifying constants discharges
    // the obligation either way.
    let attempt = 0;
    mockFetch((url) => {
      if (url.includes("/services/oauth2/token")) return jsonResponse(200, TOKEN_OK);
      attempt += 1;
      return attempt === 1
        ? jsonResponse(400, [
            {
              message: "Required fields are missing: [Email__c]",
              errorCode: "REQUIRED_FIELD_MISSING",
              fields: ["Email__c"],
            },
          ])
        : new Response(null, { status: 204 });
    });

    expect(await scrubLead("a04", "deleted-abc")).toEqual({ ok: true });

    const second = calls[calls.length - 1];
    const body = JSON.parse(String(second.init.body));
    expect(body.Name__c).toBe("deleted-abc");
    // No personal data survives, and nothing here is a reachable address.
    expect(body.Email__c).toBe("redacted@bazar.invalid");
    expect(body.Email__c.endsWith(".invalid")).toBe(true);
    expect(body.Phone__c).not.toContain("50");
    expect("Country_Code__c" in body).toBe(false);
  });

  it("does not substitute when the null was accepted", async () => {
    mockFetch((url) =>
      url.includes("/services/oauth2/token")
        ? jsonResponse(200, TOKEN_OK)
        : new Response(null, { status: 204 }),
    );
    await scrubLead("a04", "deleted-abc");
    const body = JSON.parse(String(calls[1].init.body));
    expect(body.Email__c).toBeNull();
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
