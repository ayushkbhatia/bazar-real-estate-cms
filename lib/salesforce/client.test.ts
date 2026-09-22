import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const INSTANCE = "https://bazarrealestate--sand.sandbox.my.salesforce.com";

// The client reads credentials at call time and refuses to run when they are
// absent — which is the correct production behaviour and useless in a spec.
vi.mock("@/lib/env", () => ({
  env: {
    SALESFORCE_INSTANCE_URL: INSTANCE,
    SALESFORCE_CLIENT_ID: "client-id",
    SALESFORCE_CLIENT_SECRET: "client-secret",
    SALESFORCE_API_VERSION: undefined,
  },
  isSalesforceConfigured: true,
}));

const { salesforceRequest, SalesforceError, __resetSalesforceTokenCache } =
  await import("./client");

type Call = { url: string; init: RequestInit };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const TOKEN_OK = {
  access_token: "00Dxx000000xxxxx!AQMAQ",
  instance_url: INSTANCE,
  token_type: "Bearer",
};

let calls: Call[];

/**
 * Assert the call rejected, and hand back the error already narrowed.
 * Catching inline gave every assertion a `T | Error` union to unwrap, and a
 * request that wrongly *succeeded* would have slipped through as `undefined`.
 */
async function rejection(
  promise: Promise<unknown>,
): Promise<InstanceType<typeof SalesforceError>> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(SalesforceError);
    return err as InstanceType<typeof SalesforceError>;
  }
  throw new Error("expected the request to reject, but it resolved");
}

function mockFetch(handler: (url: string, init: RequestInit) => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL, init: RequestInit = {}) => {
      const url = String(input);
      calls.push({ url, init });
      return Promise.resolve(handler(url, init));
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

describe("salesforceRequest", () => {
  it("authenticates, then calls the data API with a bearer token", async () => {
    mockFetch((url) =>
      url.includes("/services/oauth2/token")
        ? jsonResponse(200, TOKEN_OK)
        : jsonResponse(201, { id: "a04iy0000000PsrAAE", success: true }),
    );

    const out = await salesforceRequest<{ id: string }>("sobjects/Lead__c", {
      method: "POST",
      body: { Name__c: "Keshav" },
    });

    expect(out).toEqual({ id: "a04iy0000000PsrAAE", success: true });
    expect(calls).toHaveLength(2);

    const token = calls[0];
    expect(token.url).toBe(`${INSTANCE}/services/oauth2/token`);
    expect(String(token.init.body)).toContain("grant_type=client_credentials");

    const data = calls[1];
    expect(data.url).toBe(`${INSTANCE}/services/data/v67.0/sobjects/Lead__c`);
    expect((data.init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN_OK.access_token}`,
    );
  });

  it("reuses the cached token across calls", async () => {
    mockFetch((url) =>
      url.includes("/services/oauth2/token")
        ? jsonResponse(200, TOKEN_OK)
        : jsonResponse(201, { id: "a1" }),
    );

    await salesforceRequest("sobjects/Lead__c", { method: "POST", body: {} });
    await salesforceRequest("sobjects/Lead__c", { method: "POST", body: {} });

    const tokenCalls = calls.filter((c) =>
      c.url.includes("/services/oauth2/token"),
    );
    expect(tokenCalls).toHaveLength(1);
  });

  it("re-authenticates once on a 401 and replays the request", async () => {
    // The doc's own guidance: "Re-authenticate when you receive a 401." A
    // client-credentials token carries no expiry, so this is the only signal
    // that the cached one has died.
    let dataCalls = 0;
    mockFetch((url) => {
      if (url.includes("/services/oauth2/token")) {
        return jsonResponse(200, TOKEN_OK);
      }
      dataCalls += 1;
      return dataCalls === 1
        ? jsonResponse(401, [
            {
              message: "Session expired or invalid",
              errorCode: "INVALID_SESSION_ID",
            },
          ])
        : jsonResponse(201, { id: "a04" });
    });

    const out = await salesforceRequest<{ id: string }>("sobjects/Lead__c", {
      method: "POST",
      body: {},
    });

    expect(out).toEqual({ id: "a04" });
    expect(
      calls.filter((c) => c.url.includes("/services/oauth2/token")),
    ).toHaveLength(2);
  });

  it("surfaces a second 401 rather than looping", async () => {
    mockFetch((url) =>
      url.includes("/services/oauth2/token")
        ? jsonResponse(200, TOKEN_OK)
        : jsonResponse(401, [
            {
              message: "Session expired or invalid",
              errorCode: "INVALID_SESSION_ID",
            },
          ]),
    );

    await expect(
      salesforceRequest("sobjects/Lead__c", { method: "POST", body: {} }),
    ).rejects.toBeInstanceOf(SalesforceError);
  });

  it("parses Salesforce's array-shaped error body", async () => {
    mockFetch((url) =>
      url.includes("/services/oauth2/token")
        ? jsonResponse(200, TOKEN_OK)
        : jsonResponse(400, [
            {
              message: "bad value for restricted picklist field: Lease",
              errorCode: "INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST",
              fields: ["Inquiry_Type__c"],
            },
          ]),
    );

    const err = await rejection(
      salesforceRequest("sobjects/Lead__c", { method: "POST", body: {} }),
    );

    expect(err).toBeInstanceOf(SalesforceError);
    expect(err.errorCode).toBe("INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST");
    expect(err.message).toContain("Inquiry_Type__c");
    // A rejected picklist fails identically forever; retrying it spends the
    // org's API allocation to reach the same answer.
    expect(err.retryable).toBe(false);
  });

  it("marks throttling and 5xx as retryable", async () => {
    for (const [status, body] of [
      [500, [{ message: "boom", errorCode: "SERVER_UNAVAILABLE" }]],
      [
        403,
        [
          {
            message: "TotalRequests Limit exceeded.",
            errorCode: "REQUEST_LIMIT_EXCEEDED",
          },
        ],
      ],
    ] as const) {
      __resetSalesforceTokenCache();
      calls = [];
      mockFetch((url) =>
        url.includes("/services/oauth2/token")
          ? jsonResponse(200, TOKEN_OK)
          : jsonResponse(status, body),
      );
      const err = await rejection(
        salesforceRequest("sobjects/Lead__c", { method: "POST", body: {} }),
      );
      expect(err.retryable, `status ${status}`).toBe(true);
    }
  });

  it("does not retry bad credentials", async () => {
    // invalid_client means the secret is wrong. Retrying every five minutes
    // would hammer the org's login endpoint and risk an IP lockout.
    mockFetch(() =>
      jsonResponse(400, {
        error: "invalid_client",
        error_description: "client identifier invalid",
      }),
    );

    const err = await rejection(
      salesforceRequest("sobjects/Lead__c", { method: "POST", body: {} }),
    );

    expect(err.errorCode).toBe("invalid_client");
    expect(err.retryable).toBe(false);
  });

  it("treats a network throw as retryable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("ECONNRESET"))),
    );
    const err = await rejection(
      salesforceRequest("sobjects/Lead__c", { method: "POST", body: {} }),
    );
    expect(err.retryable).toBe(true);
    expect(err.status).toBe(0);
  });

  it("returns null for a 204, which is what an upsert-update answers", async () => {
    mockFetch((url) =>
      url.includes("/services/oauth2/token")
        ? jsonResponse(200, TOKEN_OK)
        : new Response(null, { status: 204 }),
    );
    const out = await salesforceRequest("sobjects/Lead__c/Ext__c/abc", {
      method: "PATCH",
      body: {},
    });
    expect(out).toBeNull();
  });

  it("prefers the instance_url the token response returns", async () => {
    const redirected = "https://bazarrealestate--sand.my.salesforce.com";
    mockFetch((url) =>
      url.includes("/services/oauth2/token")
        ? jsonResponse(200, { ...TOKEN_OK, instance_url: `${redirected}/` })
        : jsonResponse(201, { id: "a1" }),
    );
    await salesforceRequest("sobjects/Lead__c", { method: "POST", body: {} });
    expect(calls[1].url.startsWith(`${redirected}/services/data/`)).toBe(true);
  });
});
