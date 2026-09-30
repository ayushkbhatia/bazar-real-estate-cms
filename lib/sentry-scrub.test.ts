import { describe, expect, it } from "vitest";
import { scrubBreadcrumb, scrubSentryEvent } from "./sentry-scrub";

describe("the Sentry scrubber", () => {
  it("sends an error with no personal data and no secure-link token", () => {
    const event = scrubSentryEvent({
      message: "send failed for priya.raman@example.com",
      transaction: "GET /mortgages/r/Ab3_x-9QzT0kLmNoPqRsTuV",
      exception: { values: [{ type: "Error", value: "duplicate key (mobile)=(+971502184417)" }] },
      request: {
        url: "https://www.bazarrealestate.ae/mortgages/p/Zz9_yy8-XX7ww6VV5uu4?x=1",
        query_string: "email=priya.raman%40example.com",
        data: { full_name: "Priya Raman" },
        cookies: { sb: "secret" },
        headers: { cookie: "sb=secret", authorization: "Bearer abc", "user-agent": "Mozilla/5.0" },
      },
      user: { id: "u1", email: "staff@example.com", ip_address: "203.0.113.9" },
      extra: { context: { email: "priya.raman@example.com", requestId: "r1" } },
      breadcrumbs: [{ category: "fetch", data: { url: "/api/mortgage/links/Ab3_x-9QzT0kLmNoPqRsTuV/verify" } }],
      spans: [{ description: "POST /api/mortgage/links/Ab3_x-9QzT0kLmNoPqRsTuV/otp" }],
    });
    expect(event).toEqual({
      message: "send failed for [email]",
      transaction: "GET /mortgages/r/[token]",
      exception: { values: [{ type: "Error", value: "duplicate key (mobile)=([phone])" }] },
      request: {
        url: "https://www.bazarrealestate.ae/mortgages/p/[token]?x=1",
        headers: { "user-agent": "Mozilla/5.0" },
      },
      user: { id: "u1" },
      extra: { context: { email: "[redacted]", requestId: "r1" } },
      breadcrumbs: [{ category: "fetch", data: { url: "/api/mortgage/links/[token]/verify" } }],
      spans: [{ description: "POST /api/mortgage/links/[token]/otp" }],
    });
  });

  it("scrubs a breadcrumb's message and data", () => {
    expect(scrubBreadcrumb({ message: "navigated to /mortgages/r/Ab3_x-9QzT0kLmNoPqRsTuV", data: { to: "/mortgages/p/Zz9_yy8-XX7ww6VV5uu4" } })).toEqual({
      message: "navigated to /mortgages/r/[token]",
      data: { to: "/mortgages/p/[token]" },
    });
  });
});
