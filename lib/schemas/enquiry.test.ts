import { describe, it, expect } from "vitest";
import { enquirySchema, normaliseEnquiryInput } from "./enquiry";

describe("enquirySchema", () => {
  it("accepts a valid property-page enquiry", () => {
    const res = enquirySchema.safeParse({
      name: "Ayush Bhatia",
      email: "lead@example.com",
      phone: "+971501234567",
      message: "Interested in the Mamsha listing.",
      source: "property_page",
      property_id: "11111111-1111-1111-1111-111111111111",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.email).toBe("lead@example.com");
    }
  });

  it("accepts a development interest registration", () => {
    const res = enquirySchema.safeParse({
      name: "Ayush Bhatia",
      email: "lead@example.com",
      phone: "+971501234567",
      message: "I'd like to register my interest in Bayviews Saadiyat.",
      source: "development_interest",
      development_id: "22222222-2222-2222-2222-222222222222",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.development_id).toBe(
        "22222222-2222-2222-2222-222222222222",
      );
    }
  });

  // The brochure gate posted `brief_raw` — the column name — instead of
  // `message`, so every request failed validation and no lead was stored.
  it("rejects a payload that carries the column name instead of message", () => {
    const res = enquirySchema.safeParse({
      name: "Ayush Bhatia",
      email: "lead@example.com",
      brief_raw: "Brochure request — Bayviews Saadiyat.",
      source: "brochure",
    });
    expect(res.success).toBe(false);
  });

  it("rejects when neither email nor phone is supplied", () => {
    const res = enquirySchema.safeParse({
      name: "Ayush",
      message: "Pls reach out",
      source: "contact_page",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const paths = res.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("email");
    }
  });

  it("rejects an invalid email but allows empty email when phone is present", () => {
    expect(
      enquirySchema.safeParse({
        name: "Ayush",
        email: "not-an-email",
        message: "Hi",
        source: "contact_page",
      }).success,
    ).toBe(false);
    expect(
      enquirySchema.safeParse({
        name: "Ayush",
        email: "",
        phone: "+971501234567",
        message: "Hi",
        source: "contact_page",
      }).success,
    ).toBe(true);
  });

  it("rejects budget_min > budget_max", () => {
    const res = enquirySchema.safeParse({
      name: "Ayush",
      email: "a@b.com",
      message: "msg",
      source: "contact_page",
      budget_min: 5_000_000,
      budget_max: 1_000_000,
    });
    expect(res.success).toBe(false);
  });

  it("normaliseEnquiryInput + schema lowercases + trims email", () => {
    const normalised = normaliseEnquiryInput({
      name: "Ayush",
      email: "  Lead@Example.COM  ",
      message: "msg",
      source: "contact_page",
    });
    const res = enquirySchema.safeParse(normalised);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.email).toBe("lead@example.com");
  });

  it("rejects messages that are too short", () => {
    const res = enquirySchema.safeParse({
      name: "Ayush",
      email: "a@b.com",
      message: "?",
      source: "contact_page",
    });
    expect(res.success).toBe(false);
  });

  it("rejects an unknown source", () => {
    const res = enquirySchema.safeParse({
      name: "Ayush",
      email: "a@b.com",
      message: "msg",
      source: "facebook_ad",
    });
    expect(res.success).toBe(false);
  });
});

describe("normaliseEnquiryInput", () => {
  it("coerces budget strings to ints, blanks to null", () => {
    const out = normaliseEnquiryInput({
      budget_min: "1000000",
      budget_max: "",
    });
    expect(out.budget_min).toBe(1_000_000);
    expect(out.budget_max).toBeNull();
  });

  it("converts blanks to null on optional id-like fields", () => {
    const out = normaliseEnquiryInput({
      property_id: "",
      development_id: "",
      intent: "",
      timeline: "",
    });
    expect(out.property_id).toBeNull();
    expect(out.development_id).toBeNull();
    expect(out.intent).toBeNull();
    expect(out.timeline).toBeNull();
  });

  it("trims email + phone but keeps them as strings (schema accepts empty)", () => {
    const out = normaliseEnquiryInput({
      email: "  HI@example.COM  ",
      phone: "  +971501234567  ",
    });
    expect(out.email).toBe("hi@example.com");
    expect(out.phone).toBe("+971501234567");
  });

  it("preserves real numbers + non-blank strings", () => {
    const out = normaliseEnquiryInput({
      budget_min: 1_000_000,
      property_id: "abc",
    });
    expect(out.budget_min).toBe(1_000_000);
    expect(out.property_id).toBe("abc");
  });
});
