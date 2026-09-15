import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { DEFAULT_EMAIL_BRAND } from "./email-brand";
import { SYSTEM_ASSET_KEYS, type SystemAssetKey } from "./system";
import { SYSTEM_EMAIL_DEFAULTS } from "./system-defaults";
import type { SystemEmailCopy } from "./system-render";

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://bazar.example");
  // No Supabase: every read returns nothing, so every send is the built-in
  // email — which is the state the site ships in.
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
});
afterAll(() => {
  vi.unstubAllEnvs();
});

async function load() {
  vi.resetModules();
  const emails = await import("./system-emails");
  const templates = await import("@/lib/email-templates");
  const newsletter = await import("@/lib/newsletter-templates");
  return { emails, templates, newsletter };
}

function publishedDefaults(): Partial<Record<SystemAssetKey, SystemEmailCopy>> {
  return Object.fromEntries(
    SYSTEM_ASSET_KEYS.map((k) => [k, { ...SYSTEM_EMAIL_DEFAULTS[k], format: "html" as const }]),
  );
}

describe("send functions with nothing published", () => {
  it("send exactly the built-in template, so shipping this changes no email", async () => {
    const { emails, templates, newsletter } = await load();
    const enquiry = {
      name: "Amira Haddad",
      message: "Hello",
      propertyReference: "BAZ-1",
      propertyTitle: "A home",
    };
    expect(await emails.enquiryAcknowledgementEmail(enquiry)).toEqual(
      templates.enquiryReceivedTemplate(enquiry),
    );
    // A mortgage lead gets the general acknowledgement until one is written.
    expect(
      await emails.enquiryAcknowledgementEmail({ ...enquiry, source: "mortgage" }),
    ).toEqual(templates.enquiryReceivedTemplate(enquiry));

    expect(await emails.valuationCodeEmail({ code: "123456" })).toEqual(
      templates.valuationCodeTemplate({ code: "123456" }),
    );
    expect(await emails.valuationReportRequestedEmail()).toEqual(
      templates.valuationReportRequestedTemplate(),
    );
    const confirm = { email: "a@b.test", confirmUrl: "https://bazar.example/c/1" };
    expect(await emails.newsletterConfirmationEmail(confirm)).toEqual(
      newsletter.newsletterConfirmTemplate(confirm),
    );
    const digest = { agentName: "K", count: 2, sampleReferences: ["A", "B"] };
    expect(await emails.bulkReassignDigestEmail(digest)).toEqual(
      templates.bulkReassignDigestTemplate(digest),
    );
    const reply = {
      name: "Amira",
      body: "Hi",
      staffDisplayName: "Khalid",
      propertyReference: null,
    };
    expect(await emails.advisorReplyEmail(reply)).toEqual(
      templates.staffReplyTemplate(reply),
    );
  });
});

describe("renderGallery", () => {
  it("renders every email's built-in version when nothing is published", async () => {
    const { emails } = await load();
    const gallery = emails.renderGallery({}, DEFAULT_EMAIL_BRAND);
    for (const key of SYSTEM_ASSET_KEYS) {
      expect(gallery[key].liveSource, key).toEqual({ kind: "builtin" });
      expect(gallery[key].live.subject, key).not.toBe("");
      expect(gallery[key].live.html, key).toContain("<!doctype html>");
    }
  });

  it("renders every starting wording completely — no braces reach an inbox", async () => {
    const { emails } = await load();
    const gallery = emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND);
    for (const key of SYSTEM_ASSET_KEYS) {
      const { live, liveSource } = gallery[key];
      expect(liveSource, key).toEqual({ kind: "override", key });
      expect(live.subject, `${key} subject`).not.toMatch(/\{\{|\}\}/);
      expect(live.html, `${key} html`).not.toMatch(/\{\{|\}\}/);
      expect(live.text, `${key} text`).not.toMatch(/\{\{|\}\}/);
      expect(live.text.trim(), `${key} text`).not.toBe("");
    }
  });

  it("carries the links and codes the email exists to deliver", async () => {
    const { emails } = await load();
    const gallery = emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND);
    expect(gallery.newsletter_confirmation.live.html).toContain(
      'href="https://bazar.example/newsletter/confirm/sample-token"',
    );
    expect(gallery.newsletter_confirmation.live.text).toContain(
      "Confirm subscription: https://bazar.example/newsletter/confirm/sample-token",
    );
    expect(gallery.newsletter_welcome.live.html).toContain(
      "https://bazar.example/newsletter/unsubscribe/sample-token",
    );
    expect(gallery.valuation_code.live.subject).toBe("Your Bazar valuation code: 482913");
    expect(gallery.staff_invitation.live.html).toContain(
      'href="https://bazar.example/staff-invite?token=sample-token"',
    );
    // Panels survive a rewrite.
    expect(gallery.valuation_request_ack.live.html).toContain("Instant range");
    expect(gallery.valuation_report.live.html).toContain("Refined valuation");
    expect(gallery.form_submission_notification.live.html).toContain("Amira Haddad");
    expect(gallery.bulk_reassign_digest.live.html).toContain("BAZ-AD-04902");
  });

  it("sends a mortgage lead the general acknowledgement's published wording until its own exists", async () => {
    const { emails } = await load();
    const gallery = emails.renderGallery(
      { enquiry_auto_reply: { ...SYSTEM_EMAIL_DEFAULTS.enquiry_auto_reply, format: "html" } },
      DEFAULT_EMAIL_BRAND,
    );
    expect(gallery.mortgage_enquiry_ack.liveSource).toEqual({
      kind: "override",
      key: "enquiry_auto_reply",
    });
    // …and the property line, which a mortgage lead has no value for, is gone.
    expect(gallery.mortgage_enquiry_ack.live.html).not.toContain("For BAZ");
  });

  it("wears the design it is given", async () => {
    const { emails } = await load();
    const gallery = emails.renderGallery(publishedDefaults(), {
      ...DEFAULT_EMAIL_BRAND,
      buttonColor: "#AA0000",
      footerText: "Custom footer",
    });
    expect(gallery.staff_password_reset.live.html).toContain("background:#AA0000");
    expect(gallery.staff_password_reset.live.html).toContain("Custom footer");
  });
});

describe("previewSystemEmail", () => {
  it("renders unsaved copy against the sample recipient", async () => {
    const { emails } = await load();
    const preview = await emails.previewSystemEmail("enquiry_auto_reply", {
      draft: { subject: "Hi {{lead_first_name}}", body: "<p>Draft body</p>", format: "html" },
    });
    expect(preview.draft?.subject).toBe("Hi Amira");
    expect(preview.draft?.html).toContain("Draft body");
    expect(preview.liveSource).toEqual({ kind: "builtin" });
    expect(preview.live).toEqual(preview.builtin);
  });
});
