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
  it("takes the subject the advisor typed", async () => {
    const { staffReplyTemplate } = await importModule();
    const { subject } = staffReplyTemplate({
      name: "Lead",
      body: "Reply body",
      staffDisplayName: null,
      propertyReference: "BAZ-AD-04891",
      subject: "Viewing on Saturday?",
    });
    expect(subject).toBe("Viewing on Saturday?");
  });

  it("derives the subject when none is supplied", async () => {
    const { staffReplyTemplate } = await importModule();
    const { subject } = staffReplyTemplate({
      name: "Lead",
      body: "Reply body",
      staffDisplayName: null,
      propertyReference: "BAZ-AD-04891",
    });
    expect(subject).toBe("Re: BAZ-AD-04891");
  });

  it("never sends a blank subject line", async () => {
    const { staffReplyTemplate } = await importModule();
    for (const blank of ["", "   ", null]) {
      const { subject } = staffReplyTemplate({
        name: "Lead",
        body: "Reply body",
        staffDisplayName: null,
        propertyReference: null,
        subject: blank,
      });
      expect(subject).toBe("From your Bazar advisor");
    }
  });

  it("trims a padded subject", async () => {
    const { staffReplyTemplate } = await importModule();
    const { subject } = staffReplyTemplate({
      name: "Lead",
      body: "Reply body",
      staffDisplayName: null,
      propertyReference: null,
      subject: "  Padded  ",
    });
    expect(subject).toBe("Padded");
  });

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

describe("valuationReceivedTemplate", () => {
  it("renders the low–high range and the midpoint", async () => {
    const { valuationReceivedTemplate } = await importModule();
    const { subject, text, html } = valuationReceivedTemplate({
      name: "Ayush",
      estimateLowAed: 3_900_000,
      estimateMidAed: 4_200_000,
      estimateHighAed: 4_500_000,
      addressLine: "Mamsha · B7 · 704",
      buildingName: null,
    });
    expect(subject).toBe("Your Bazar valuation is in review");
    expect(text).toContain("AED 3.9M – AED 4.5M");
    expect(text).toContain("midpoint AED 4.2M");
    expect(html).toContain("AED 4.2M");
  });

  it("escapes the property line", async () => {
    const { valuationReceivedTemplate } = await importModule();
    const { html } = valuationReceivedTemplate({
      name: "Ayush",
      estimateLowAed: 3_900_000,
      estimateMidAed: 4_200_000,
      estimateHighAed: 4_500_000,
      addressLine: "<b>danger</b>",
      buildingName: null,
    });
    expect(html).not.toContain("<b>danger");
    expect(html).toContain("&lt;b&gt;danger");
  });
});

describe("valuationReportTemplate", () => {
  it("subject leads with the final figure", async () => {
    const { valuationReportTemplate } = await importModule();
    const { subject } = valuationReportTemplate({
      name: "Ayush",
      finalEstimateAed: 4_400_000,
      rangeLowAed: 3_900_000,
      rangeHighAed: 4_500_000,
      advisorName: "Mariam Al-Hashimi",
      advisorNotes: null,
      addressLine: "Mamsha · B7 · 704",
      buildingName: null,
    });
    expect(subject).toBe("Your Bazar valuation: AED 4.4M");
  });

  it("includes the initial range note when provided", async () => {
    const { valuationReportTemplate } = await importModule();
    const { text } = valuationReportTemplate({
      name: "Ayush",
      finalEstimateAed: 4_400_000,
      rangeLowAed: 3_900_000,
      rangeHighAed: 4_500_000,
      advisorName: "Mariam Al-Hashimi",
      advisorNotes: null,
      addressLine: null,
      buildingName: null,
    });
    expect(text).toContain("Initial instant range was AED 3.9M–AED 4.5M");
  });

  it("renders advisor notes when supplied; signs with their name", async () => {
    const { valuationReportTemplate } = await importModule();
    const { text, html } = valuationReportTemplate({
      name: "Ayush",
      finalEstimateAed: 4_400_000,
      rangeLowAed: null,
      rangeHighAed: null,
      advisorName: "Mariam Al-Hashimi",
      advisorNotes:
        "I priced this 3% above the comp set — Mamsha 7 has had a strong run.",
      addressLine: "Mamsha · B7 · 704",
      buildingName: null,
    });
    expect(text).toContain("Mariam Al-Hashimi");
    expect(html).toContain("Mariam Al-Hashimi");
    expect(html).toContain("Mamsha 7 has had a strong run");
  });
});

describe("staffInvitationTemplate", () => {
  const base = {
    inviteeName: "Omar",
    inviterName: "Aisha Khan",
    acceptUrl: "https://bazar.ae/staff-invite?token=abc123",
    role: "Administrator",
  };

  it("puts the accept link in both the text and html parts", async () => {
    const { staffInvitationTemplate } = await importModule();
    const { text, html } = staffInvitationTemplate(base);
    expect(text).toContain(base.acceptUrl);
    expect(html).toContain(base.acceptUrl);
  });

  it("states the expiry window it is given", async () => {
    const { staffInvitationTemplate } = await importModule();
    const { text, html } = staffInvitationTemplate({ ...base, expiryDays: 14 });
    expect(text).toContain("valid for 14 days");
    expect(html).toContain("valid for 14 days");
  });

  it("never claims 7 days when the window is 14", async () => {
    // The copy said 7 while the column defaulted to 14.
    const { staffInvitationTemplate } = await importModule();
    const { text } = staffInvitationTemplate({ ...base, expiryDays: 14 });
    expect(text).not.toContain("7 days");
  });

  it("names the role in the subject", async () => {
    const { staffInvitationTemplate } = await importModule();
    expect(staffInvitationTemplate(base).subject).toContain("Administrator");
  });

  it("asks the invitee to set a password, not just 'accept'", async () => {
    const { staffInvitationTemplate } = await importModule();
    expect(staffInvitationTemplate(base).text).toMatch(/set your password/i);
  });
});

describe("staffPasswordResetTemplate", () => {
  const base = {
    staffName: "Omar",
    resetUrl: "https://bazar.ae/staff-invite?token=xyz",
    senderName: "Aisha Khan",
  };

  it("carries the link in both parts", async () => {
    const { staffPasswordResetTemplate } = await importModule();
    const { text, html } = staffPasswordResetTemplate(base);
    expect(text).toContain(base.resetUrl);
    expect(html).toContain(base.resetUrl);
  });

  it("names who sent it, so an unexpected email is traceable", async () => {
    const { staffPasswordResetTemplate } = await importModule();
    expect(staffPasswordResetTemplate(base).text).toContain("Aisha Khan");
  });

  it("says the current password still works until the link is used", async () => {
    const { staffPasswordResetTemplate } = await importModule();
    const { text, html } = staffPasswordResetTemplate(base);
    expect(text).toMatch(/current password still works/i);
    expect(html).toMatch(/current password keeps working/i);
  });

  it("does not read like a new-hire invitation", async () => {
    const { staffPasswordResetTemplate } = await importModule();
    const { subject, text } = staffPasswordResetTemplate(base);
    expect(subject).not.toMatch(/invit/i);
    expect(text).not.toMatch(/invited/i);
  });

  it("states the expiry window", async () => {
    const { staffPasswordResetTemplate } = await importModule();
    expect(
      staffPasswordResetTemplate({ ...base, expiryDays: 14 }).text,
    ).toContain("valid for 14 days");
  });
});

describe("no template links at a removed route", () => {
  /**
   * Customer accounts are gone and /account/* is NOT in the redirect list, so
   * any surviving link to it 404s in a real person's inbox. This caught four
   * templates after the removal, one of them live (the day-7 valuation
   * nurture, sent by a cron).
   */
  const DEAD_PREFIXES = [
    "/account",
    "/sign-in",
    "/sign-up",
    "/magic-link",
    "/reset-password",
    "/verify-otp",
  ];

  it("every rendered template avoids the removed customer routes", async () => {
    const mod = await importModule();
    const rendered: string[] = [];

    // Render everything callable with a plausible payload; templates that need
    // a shape we can't guess are skipped rather than silently passing.
    for (const [name, fn] of Object.entries(mod)) {
      if (typeof fn !== "function") continue;
      try {
        const out = (fn as (o: unknown) => unknown)({
          name: "Test Person",
          staffName: "Test Person",
          inviteeName: "Test Person",
          inviterName: "Admin",
          senderName: "Admin",
          staffDisplayName: "Admin",
          body: "body",
          message: "message",
          email: "a@b.com",
          role: "Administrator",
          acceptUrl: "https://example.com/x",
          resetUrl: "https://example.com/x",
          token: "t",
          valuationId: "v1",
          estimateMid: 1_000_000,
          propertyReference: "BAZ-1",
          propertyTitle: "A home",
          reference: "BAZ-1",
          licenseKind: "brn",
          expiresOn: "2026-01-01",
          holderName: "Someone",
          count: 1,
          items: [],
          agentName: "Someone",
          startsAt: new Date().toISOString(),
          subject: null,
        });
        if (out && typeof out === "object" && "html" in out) {
          const o = out as { html: string; text: string; subject: string };
          rendered.push(`${name}::${o.html}\n${o.text}`);
        }
      } catch {
        /* shape we can't synthesise — not what this test is for */
      }
    }

    expect(rendered.length).toBeGreaterThan(5);
    for (const body of rendered) {
      const [name] = body.split("::");
      for (const dead of DEAD_PREFIXES) {
        expect(body.includes(`"${dead}`) || body.includes(`${dead}/`), `${name} links at ${dead}`).toBe(false);
      }
    }
  });
});
