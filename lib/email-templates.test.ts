import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://bazar.example");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

async function importModule() {
  vi.resetModules();
  return import("./email-templates");
}

describe("enquiryReceivedTemplate", () => {
  it("subject includes the property reference when given", async () => {
    const { enquiryReceivedTemplate } = await importModule();
    const { subject } = enquiryReceivedTemplate({
      name: "Ayush",
      message: "Interested",
      propertyReference: "BAZ-AD-04891",
      propertyTitle: "Mamsha 3-bed",
    });
    expect(subject).toContain("BAZ-AD-04891");
  });

  it("falls back to a generic subject without a reference", async () => {
    const { enquiryReceivedTemplate } = await importModule();
    const { subject } = enquiryReceivedTemplate({
      name: "Ayush",
      message: "Hi",
      propertyReference: null,
      propertyTitle: null,
    });
    expect(subject).toBe("We received your brief");
  });

  it("HTML escapes user-provided content", async () => {
    const { enquiryReceivedTemplate } = await importModule();
    const { html, text } = enquiryReceivedTemplate({
      name: "<script>alert(1)</script>",
      message: '"hello" & <b>danger</b>',
      propertyReference: null,
      propertyTitle: null,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;hello&quot;");
    expect(html).toContain("&amp;");
    // text version contains the raw user text — that's fine for plain/text part
    expect(text).toContain('"hello"');
  });

  it("includes the site URL in the footer", async () => {
    const { enquiryReceivedTemplate } = await importModule();
    const { html } = enquiryReceivedTemplate({
      name: "Ayush",
      message: "Hi",
      propertyReference: null,
      propertyTitle: null,
    });
    expect(html).toContain("https://bazar.example");
  });
});

describe("staffReplyTemplate", () => {
  it("uses the staff name in the signature when available", async () => {
    const { staffReplyTemplate } = await importModule();
    const { text } = staffReplyTemplate({
      name: "Lead",
      body: "Reply body",
      staffDisplayName: "Mariam",
      propertyReference: null,
    });
    expect(text).toContain("— Mariam, Bazar Real Estate");
  });

  it("falls back when no staff name is supplied", async () => {
    const { staffReplyTemplate } = await importModule();
    const { text } = staffReplyTemplate({
      name: "Lead",
      body: "Hi",
      staffDisplayName: null,
      propertyReference: null,
    });
    expect(text).toContain("— Bazar Real Estate");
  });

  it("includes the property reference in the subject when provided", async () => {
    const { staffReplyTemplate } = await importModule();
    const { subject } = staffReplyTemplate({
      name: "Lead",
      body: "Hi",
      staffDisplayName: null,
      propertyReference: "BAZ-AD-04891",
    });
    expect(subject).toBe("Re: BAZ-AD-04891");
  });
});
