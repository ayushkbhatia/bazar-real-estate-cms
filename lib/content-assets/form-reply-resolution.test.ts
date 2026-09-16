import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_EMAIL_BRAND } from "./email-brand";
import type { SystemEmailCopy } from "./system-render";

/**
 * Which email a lead receives, and in what order the site decides.
 *
 * The reads are mocked because the decision is the thing under test: given an
 * assigned reply, a published acknowledgement and a built-in, which one goes
 * out — and does an assignment that is not fit to send fall back rather than
 * fail.
 */

const reads = {
  reply: null as SystemEmailCopy | null,
  published: null as { copy: SystemEmailCopy; from: string } | null,
};

vi.mock("./system-resolve", () => ({
  readFormReply: vi.fn(async () => reads.reply),
  resolvePublishedCopy: vi.fn(async () => reads.published),
  readEmailBrand: vi.fn(async () => DEFAULT_EMAIL_BRAND),
  resolveSystemEmail: vi.fn(),
  usableCopy: vi.fn(),
}));

const LEAD = {
  name: "Amira Haddad",
  message: "Is the 3-bed still available?",
  propertyReference: null,
  propertyTitle: null,
};

async function load() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://bazar.example");
  return import("./system-emails");
}

beforeEach(() => {
  vi.clearAllMocks();
  reads.reply = null;
  reads.published = null;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the email a form's lead receives", () => {
  it("is the built-in acknowledgement when nothing is assigned or published", async () => {
    const { enquiryAcknowledgementEmail } = await load();
    const out = await enquiryAcknowledgementEmail({
      ...LEAD,
      formKey: "contact_enquiry",
    });
    expect(out.subject).toBe("We received your brief");
    expect(out.html).toContain("Thank you for getting in touch with Bazar.");
  });

  it("is the assigned reply when the form has one", async () => {
    reads.reply = {
      subject: "Thanks — your brochure is on its way",
      body: "<p>Hello {{lead_first_name}}, your {{form_name}} request is with us.</p>",
      format: "html",
    };
    const { enquiryAcknowledgementEmail } = await load();
    const out = await enquiryAcknowledgementEmail({
      ...LEAD,
      formKey: "development_brochure",
    });
    expect(out.subject).toBe("Thanks — your brochure is on its way");
    // The form's own name is filled in from the registry, not passed in.
    expect(out.html).toContain("Hello Amira, your Download the brochure request");
  });

  it("prefers the assigned reply over a published acknowledgement", async () => {
    reads.reply = {
      subject: "Reply",
      body: "<p>From the reply</p>",
      format: "html",
    };
    reads.published = {
      copy: { subject: "Override", body: "<p>From the override</p>", format: "html" },
      from: "enquiry_auto_reply",
    };
    const { enquiryAcknowledgementEmail } = await load();
    const out = await enquiryAcknowledgementEmail({
      ...LEAD,
      formKey: "contact_enquiry",
    });
    expect(out.subject).toBe("Reply");
  });

  it("falls back to the acknowledgement when the reply renders to nothing", async () => {
    reads.reply = { subject: "Reply", body: "<p>{{property_line}}</p>", format: "html" };
    reads.published = {
      copy: { subject: "Override", body: "<p>From the override</p>", format: "html" },
      from: "enquiry_auto_reply",
    };
    const { enquiryAcknowledgementEmail } = await load();
    const out = await enquiryAcknowledgementEmail({
      ...LEAD,
      formKey: "contact_enquiry",
    });
    expect(out.subject).toBe("Override");
  });

  it("asks for the reply of the form that was filled in, and no other", async () => {
    const { enquiryAcknowledgementEmail } = await load();
    const { readFormReply } = await import("./system-resolve");
    await enquiryAcknowledgementEmail({ ...LEAD, formKey: "buy_hero_enquiry" });
    expect(readFormReply).toHaveBeenCalledWith("buy_hero_enquiry");
  });

  it("looks for no reply at all when the lead came from no form", async () => {
    const { enquiryAcknowledgementEmail } = await load();
    const { readFormReply } = await import("./system-resolve");
    await enquiryAcknowledgementEmail(LEAD);
    expect(readFormReply).not.toHaveBeenCalled();
  });
});

describe("the language a lead is answered in", () => {
  it("is Arabic when the lead wrote in Arabic and the reply has Arabic", async () => {
    reads.reply = {
      subject: "Thanks",
      body: "<p>Thanks {{lead_first_name}}</p>",
      subjectAr: "شكراً لك",
      bodyAr: "<p>شكراً {{lead_first_name}}</p>",
      format: "html",
    };
    const { enquiryAcknowledgementEmail } = await load();
    const out = await enquiryAcknowledgementEmail({
      ...LEAD,
      formKey: "contact_enquiry",
      locale: "ar",
    });
    expect(out.subject).toBe("شكراً لك");
    expect(out.html).toContain('dir="rtl"');
  });

  it("is English when the lead wrote in Arabic and nobody wrote the Arabic", async () => {
    reads.reply = {
      subject: "Thanks",
      body: "<p>Thanks</p>",
      subjectAr: null,
      bodyAr: null,
      format: "html",
    };
    const { enquiryAcknowledgementEmail } = await load();
    const out = await enquiryAcknowledgementEmail({
      ...LEAD,
      formKey: "contact_enquiry",
      locale: "ar",
    });
    expect(out.subject).toBe("Thanks");
    expect(out.html).toContain('dir="ltr"');
  });

  it("is English for an Arabic lead when only the built-in exists", async () => {
    const { enquiryAcknowledgementEmail } = await load();
    const out = await enquiryAcknowledgementEmail({ ...LEAD, locale: "ar" });
    expect(out.subject).toBe("We received your brief");
  });

  it("treats an unknown locale as English rather than failing", async () => {
    const { enquiryAcknowledgementEmail } = await load();
    const out = await enquiryAcknowledgementEmail({ ...LEAD, locale: "fr" });
    expect(out.subject).toBe("We received your brief");
  });
});
