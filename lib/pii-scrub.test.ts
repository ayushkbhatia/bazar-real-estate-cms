import { describe, expect, it } from "vitest";
import { maskEmail, scrubContext, scrubPii } from "./pii-scrub";

describe("scrubPii", () => {
  it("takes out email addresses, however a provider quotes them", () => {
    expect(scrubPii('duplicate key value violates unique constraint "x": Key (email)=(priya.raman@example.com) already exists.')).toBe(
      'duplicate key value violates unique constraint "x": Key (email)=([email]) already exists.',
    );
    expect(scrubPii("Invalid `to` field: priya+test@mail.example.co.uk")).toBe("Invalid `to` field: [email]");
  });

  it("takes out phone numbers, UAE ones however written and others with a +", () => {
    for (const phone of ["+971 50 218 4417", "+971502184417", "00971502184417", "971-50-2184417", "0502184417", "050 218 4417", "+44 7700 900123"]) {
      expect(scrubPii(`call ${phone} back`), phone).toBe("call [phone] back");
    }
  });

  it("takes out Bearer credentials and secure-link tokens", () => {
    expect(scrubPii("authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig")).toBe("authorization: Bearer [token]");
    expect(scrubPii("GET /mortgages/r/Ab3_x-9QzT0kLmNoPqRsTuV?x=1 failed")).toBe("GET /mortgages/r/[token]?x=1 failed");
    expect(scrubPii("https://www.bazarrealestate.ae/mortgages/p/Zz9_yy8-XX7ww6VV5uu4")).toBe("https://www.bazarrealestate.ae/mortgages/p/[token]");
  });

  it("leaves what makes a report useful: ids, references, codes, counts, dates and sizes", () => {
    for (const text of [
      "request 3f1c2a4e-9b7d-4c1e-8a2b-5d6e7f8a9b0c failed (MR409)",
      "BZM-26-0412: attempt 2 of 5",
      "object is 41943040 bytes, over the 10485760 limit",
      "due 2026-09-30T10:00:00.000+04:00",
      "AED 2,150,000 at 3.99%",
    ]) {
      expect(scrubPii(text)).toBe(text);
    }
  });
});

describe("scrubContext", () => {
  it("scrubs every string at any depth, and replaces secret-named fields whole", () => {
    const context = {
      requestId: "3f1c2a4e-9b7d-4c1e-8a2b-5d6e7f8a9b0c",
      email: "priya.raman@example.com",
      nested: { note: "reach them on 0502184417", mobile_e164: "+971502184417", attempts: 3 },
      list: ["x@example.com", 5, null],
      token: "",
    };
    expect(scrubContext(context)).toEqual({
      requestId: "3f1c2a4e-9b7d-4c1e-8a2b-5d6e7f8a9b0c",
      email: "[redacted]",
      nested: { note: "reach them on [phone]", mobile_e164: "[redacted]", attempts: 3 },
      list: ["[email]", 5, null],
      token: "",
    });
  });
});

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("priya.raman@example.com")).toBe("p•••@example.com");
    expect(maskEmail("nonsense")).toBe("[email]");
  });
});
