import { describe, expect, it } from "vitest";
import {
  generateConfirmationToken,
  newsletterSignupSchema,
  normaliseEmail,
} from "./newsletter";

describe("newsletterSignupSchema", () => {
  it("accepts a valid email + source", () => {
    expect(
      newsletterSignupSchema.safeParse({
        email: "reader@example.com",
        source: "insights_header",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(
      newsletterSignupSchema.safeParse({
        email: "not-an-email",
        source: "homepage",
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown source", () => {
    expect(
      newsletterSignupSchema.safeParse({
        email: "x@y.com",
        source: "twitter",
      }).success,
    ).toBe(false);
  });

  it("defaults source to insights_header when absent", () => {
    const res = newsletterSignupSchema.safeParse({ email: "x@y.com" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.source).toBe("insights_header");
  });
});

describe("normaliseEmail", () => {
  it("trims and lowercases", () => {
    expect(normaliseEmail("  Mariam@Bazar.AE  ")).toBe("mariam@bazar.ae");
  });
});

describe("generateConfirmationToken", () => {
  it("produces a 48-char hex token", () => {
    const t = generateConfirmationToken();
    expect(t).toMatch(/^[0-9a-f]{48}$/);
  });

  it("produces unique tokens on successive calls", () => {
    const a = generateConfirmationToken();
    const b = generateConfirmationToken();
    expect(a).not.toBe(b);
  });
});
