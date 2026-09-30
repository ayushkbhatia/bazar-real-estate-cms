import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { stripIsolates } from "@/lib/i18n/bidi";
import { DEFAULT_EMAIL_BRAND } from "./email-brand";
import { SYSTEM_ASSETS, missingRequiredTokens, type SystemAssetKey } from "./system";
import { SYSTEM_EMAIL_DEFAULTS } from "./system-defaults";
import { SYSTEM_EMAIL_DEFAULTS_AR } from "./system-defaults-ar";
import type { SystemEmailCopy } from "./system-render";
import type { MortgagePreapprovalReceivedOpts } from "./system-emails";
import { usedTokens } from "./tokens";

/**
 * The mortgage flow's two confirmations (migration 0142). The registry-wide
 * suites already hold them to the rules every system email keeps — seeded,
 * scoped, no braces left over. These pin what is particular to them: the
 * promise said in WORKING hours, the documents list, and a body that names
 * the applicant by first name and nothing else.
 */

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://bazar.example");
  // No Supabase: nothing is read, so every send is the built-in email.
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
  return { emails, templates };
}

const CONSULTANCY = {
  name: "Ahmed Al Suwaidi",
  reference: "BZM-26-0415",
  submittedAt: "2026-09-22T05:47:00Z",
};

const PRE_APPROVAL: MortgagePreapprovalReceivedOpts = {
  name: "Priya Raman",
  reference: "BZM-26-0412",
  // Tuesday 10:14 in Dubai; 24 working hours later is Thursday 14:14.
  submittedAt: "2026-09-22T06:14:00Z",
  dueAt: "2026-09-24T10:14:00Z",
  documents: [
    { kind: "emirates_id", files: 2 },
    { kind: "passport", files: 1 },
    { kind: "salary_certificate", files: 1 },
    { kind: "bank_statements_3m", files: 3 },
  ],
};

const KEYS = ["mortgage_consultancy_received", "mortgage_preapproval_received"] as const;

/** Both languages of the starting wording, as if an editor had published it. */
function publishedDefaults(): Partial<Record<SystemAssetKey, SystemEmailCopy>> {
  return Object.fromEntries(
    KEYS.map((k) => [
      k,
      {
        ...SYSTEM_EMAIL_DEFAULTS[k],
        subjectAr: SYSTEM_EMAIL_DEFAULTS_AR[k].subject,
        bodyAr: SYSTEM_EMAIL_DEFAULTS_AR[k].body,
        format: "html" as const,
      },
    ]),
  );
}

describe("the mortgage confirmations, with nothing published", () => {
  it("send the built-in templates", async () => {
    const { emails, templates } = await load();
    expect(await emails.mortgageConsultancyReceivedEmail(CONSULTANCY)).toEqual(
      templates.mortgageConsultancyReceivedTemplate(CONSULTANCY),
    );
    expect(await emails.mortgagePreapprovalReceivedEmail(PRE_APPROVAL)).toEqual(
      templates.mortgagePreapprovalReceivedTemplate(PRE_APPROVAL),
    );
  });

  it("confirm a consultancy request with its reference and W4's promise", async () => {
    const { emails } = await load();
    const email = await emails.mortgageConsultancyReceivedEmail(CONSULTANCY);
    expect(email.subject).toBe("We've received your request — BZM-26-0415");
    expect(email.text).toContain("Your reference is BZM-26-0415.");
    expect(email.text).toContain("A member of our mortgage team will contact you shortly.");
    // Received in Dubai time, as the confirmation page printed it.
    expect(email.text).toContain("We received your request on Tue 22 Sep, 09:47.");
  });

  it("promise a pre-approval by a time, in working hours", async () => {
    const { emails } = await load();
    const email = await emails.mortgagePreapprovalReceivedEmail(PRE_APPROVAL);
    expect(email.subject).toBe("Your Fast Pre-Approval application — BZM-26-0412");
    expect(email.text).toContain(
      "We'll contact you by Thu 24 Sep, 14:14 — 24 working hours from when you submitted.",
    );
    expect(email.html).toContain("<strong>Thu 24 Sep, 14:14</strong>");
    // The clock counts working hours (D11); "24 hours" alone reads as a clock
    // the team is not keeping.
    expect(email.text).not.toMatch(/\b24 hours\b/);
    expect(email.text).toContain(
      "If we need anything else, we'll message you on WhatsApp with a secure link. You won't need to start again.",
    );
  });

  it("list the documents received, in the order given, with their file counts", async () => {
    const { emails } = await load();
    const { text, html } = await emails.mortgagePreapprovalReceivedEmail(PRE_APPROVAL);
    const lines = [
      "Emirates ID — 2 files",
      "Passport copy — 1 file",
      "Salary certificate — 1 file",
      "Last 3 months' bank statements — 3 files",
    ];
    const at = lines.map((l) => text.indexOf(l));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).toContain("Documents received");
  });

  it("name the applicant by first name and nothing else", async () => {
    const { emails } = await load();
    const consult = await emails.mortgageConsultancyReceivedEmail(CONSULTANCY);
    const pre = await emails.mortgagePreapprovalReceivedEmail(PRE_APPROVAL);
    expect(consult.text).toContain("Hello Ahmed,");
    expect(pre.text).toContain("Hello Priya,");
    for (const email of [consult, pre]) {
      expect(email.html + email.text).not.toMatch(/Suwaidi|Raman/);
    }
  });

  it("escape the name, and greet a blank one as the token would", async () => {
    const { templates } = await load();
    const hostile = templates.mortgageConsultancyReceivedTemplate({
      ...CONSULTANCY,
      name: "<b>Ahmed</b> Al Suwaidi",
    });
    expect(hostile.html).not.toContain("<b>Ahmed</b>");
    expect(hostile.html).toContain("&lt;b&gt;Ahmed&lt;/b&gt;");
    const blank = templates.mortgageConsultancyReceivedTemplate({ ...CONSULTANCY, name: "  " });
    expect(blank.text).toContain("Hello there,");
  });
});

describe("the starting wording", () => {
  it("is the built-in email, sentence for sentence", async () => {
    // Published unchanged, the draft sends what the built-in sends — only the
    // built-in's trailing site address, which the shell's footer already
    // carries, is not in the rich-text version.
    const { emails, templates } = await load();
    const gallery = emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND);
    const builtins = {
      mortgage_consultancy_received:
        templates.mortgageConsultancyReceivedTemplate(CONSULTANCY),
      mortgage_preapproval_received:
        templates.mortgagePreapprovalReceivedTemplate(PRE_APPROVAL),
    };
    for (const key of KEYS) {
      const { live, liveSource } = gallery[key];
      expect(liveSource, key).toEqual({ kind: "override", key });
      expect(live.subject, key).toBe(builtins[key].subject);
      expect(live.text, key).toBe(builtins[key].text.replace("https://bazar.example\n", ""));
    }
  });

  it("carries only the first name, in both languages", () => {
    for (const key of KEYS) {
      for (const copy of [SYSTEM_EMAIL_DEFAULTS[key], SYSTEM_EMAIL_DEFAULTS_AR[key]]) {
        const tokens = usedTokens(`${copy.subject}\n${copy.body}`);
        expect(tokens, key).toContain("lead_first_name");
        expect(tokens, key).not.toContain("lead_name");
      }
    }
  });

  it("answers in Arabic with Arabic dates and counts", async () => {
    const { emails } = await load();
    const gallery = emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND, "ar");
    const pre = gallery.mortgage_preapproval_received.live;
    const text = stripIsolates(pre.text);
    expect(pre.html).toContain('<html dir="rtl" lang="ar">');
    expect(text).toContain("سنتواصل معك بحلول الخميس، 24 سبتمبر، 14:14");
    expect(text).toContain("الهوية الإماراتية — ملفان");
    expect(text).toContain("نسخة جواز السفر — ملف واحد");
    expect(text).toContain("كشوف الحساب البنكية لآخر 3 أشهر — 3 ملفات");
    const consult = stripIsolates(gallery.mortgage_consultancy_received.live.text);
    expect(consult).toContain("استلمنا طلبك في الثلاثاء، 22 سبتمبر، 09:47.");
  });
});

describe("the registry", () => {
  it("will not publish either without its reference, nor pre-approval without its due time", () => {
    expect(
      missingRequiredTokens("mortgage_consultancy_received", {
        subject: "Thanks",
        body: "<p>We'll be in touch.</p>",
      }),
    ).toEqual(["mortgage_reference"]);
    expect(
      missingRequiredTokens("mortgage_preapproval_received", {
        subject: "Thanks — {{mortgage_reference}}",
        body: "<p>We'll be in touch.</p>",
      }),
    ).toEqual(["mortgage_due"]);
  });

  it("says the wording is provisional", () => {
    for (const key of KEYS) {
      expect(SYSTEM_ASSETS[key].trigger, key).toContain(
        "Wording is a provisional draft pending design (D29).",
      );
    }
  });
});

describe("mortgageDocumentsBlock", () => {
  async function count(files: number, locale: "en" | "ar") {
    const { templates } = await load();
    const block = templates.mortgageDocumentsBlock([{ kind: "passport", files }], locale);
    return block.text.split(" — ")[1];
  }

  it("counts files in English", async () => {
    expect(await count(1, "en")).toBe("1 file");
    expect(await count(2, "en")).toBe("2 files");
    expect(await count(12, "en")).toBe("12 files");
  });

  it("counts files in every Arabic plural form", async () => {
    // A `n === 1` ternary has nowhere to put these: one, two, 3–10, 11–99, 100+.
    expect(await count(1, "ar")).toBe("ملف واحد");
    expect(await count(2, "ar")).toBe("ملفان");
    expect(await count(3, "ar")).toBe("3 ملفات");
    expect(await count(10, "ar")).toBe("10 ملفات");
    expect(await count(11, "ar")).toBe("11 ملفاً");
    expect(await count(12, "ar")).toBe("12 ملفاً");
    expect(await count(100, "ar")).toBe("100 ملف");
  });

  it("names a business owner's documents, licence in the UAE spelling", async () => {
    const { templates } = await load();
    const block = templates.mortgageDocumentsBlock([
      { kind: "trade_license", files: 1 },
      { kind: "bank_statements_12m", files: 12 },
    ]);
    expect(block.text).toBe(
      "Documents received:\n  · Business trade licence — 1 file\n  · Last 1 year's bank statements — 12 files",
    );
  });

  it("draws nothing for no documents, and English with no isolate marks", async () => {
    const { templates } = await load();
    expect(templates.mortgageDocumentsBlock([])).toEqual({ html: "", text: "" });
    const en = templates.mortgageDocumentsBlock(PRE_APPROVAL.documents);
    expect(en.html).toBe(stripIsolates(en.html));
    expect(en.html).toContain('dir="ltr"');
    const ar = templates.mortgageDocumentsBlock(PRE_APPROVAL.documents, "ar");
    expect(ar.html).toContain('dir="rtl"');
    expect(ar.html).toContain("المستندات المستلمة");
  });
});
