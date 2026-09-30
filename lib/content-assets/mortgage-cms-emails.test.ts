import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { stripIsolates } from "@/lib/i18n/bidi";
import { DEFAULT_EMAIL_BRAND } from "./email-brand";
import { SYSTEM_ASSETS, missingRequiredTokens, type SystemAssetKey } from "./system";
import { SYSTEM_EMAIL_DEFAULTS } from "./system-defaults";
import { SYSTEM_EMAIL_DEFAULTS_AR } from "./system-defaults-ar";
import type { RenderedEmail, SystemEmailCopy } from "./system-render";
import type {
  MortgageConsultationBookedOpts,
  MortgagePreapprovalInviteOpts,
  MortgageTeamAlertOpts,
} from "./system-emails";
import { renderTokens, usedTokens } from "./tokens";

/**
 * The mortgage CMS's five emails (migration 0144): the team's three alerts,
 * and the applicant's consultation booking and Fast Pre-Approval invitation.
 * The registry-wide suites already hold them to the rules every system email
 * keeps — seeded, scoped, Arabic, no braces left over. These pin what is
 * particular to them: the alerts carry nothing about the applicant, the
 * promise is counted in working time, the applicant's two say what they must,
 * and nobody in any of them is "he" or "she".
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

const ALERT: MortgageTeamAlertOpts = {
  reference: "BZM-26-0412",
  service: "pre_approval",
  link: "https://bazar.example/admin/mortgages/BZM-26-0412",
};

// The gallery's samples: a Tuesday 10:14 application, due Thursday 14:14
// after 24 working hours, flagged with 1h 48m of working time left.
const NEW_REQUEST = { ...ALERT, submittedAt: "2026-09-22T06:14:00Z", ownerName: "Rashid Khan" };
const AT_RISK = { ...ALERT, remainingSeconds: 6480, dueAt: "2026-09-24T10:14:00Z" };
const BREACHED = { ...ALERT, dueAt: "2026-09-24T10:14:00Z" };

const BOOKED: MortgageConsultationBookedOpts = {
  name: "Ahmed Al Suwaidi",
  reference: "BZM-26-0415",
  // Wednesday 10:00 in Dubai.
  startsAt: "2026-09-23T06:00:00Z",
  durationMinutes: 20,
  format: "phone",
  adviserName: "Rashid Khan",
};

const INVITE: MortgagePreapprovalInviteOpts = {
  name: "Ahmed Al Suwaidi",
  reference: "BZM-26-0415",
  adviserName: "Rashid Khan",
  link: "https://bazar.example/mortgages/r/sample-token",
  expiresAt: "2026-09-30T06:00:00Z",
};

const TEAM = [
  "mortgage_team_new_request",
  "mortgage_team_at_risk",
  "mortgage_team_breached",
] as const;
const APPLICANT = ["mortgage_consultation_booked", "mortgage_preapproval_invite"] as const;
const KEYS = [...TEAM, ...APPLICANT] as const;

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

/** Each email's built-in, from the same arguments as the gallery's sample. */
async function builtins(): Promise<Record<(typeof KEYS)[number], RenderedEmail>> {
  const { templates } = await load();
  return {
    mortgage_team_new_request: templates.mortgageTeamNewRequestTemplate(NEW_REQUEST),
    mortgage_team_at_risk: templates.mortgageTeamAtRiskTemplate(AT_RISK),
    mortgage_team_breached: templates.mortgageTeamBreachedTemplate(BREACHED),
    mortgage_consultation_booked: templates.mortgageConsultationBookedTemplate(BOOKED),
    mortgage_preapproval_invite: templates.mortgagePreapprovalInviteTemplate(INVITE),
  };
}

/** Every English version of the five: built-in, and starting wording published. */
async function everyEnglishVersion(): Promise<[string, RenderedEmail][]> {
  const { emails } = await load();
  const gallery = emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND);
  const built = await builtins();
  return KEYS.flatMap((k) => [
    [`${k} built-in`, built[k]] as [string, RenderedEmail],
    [`${k} starting wording`, gallery[k].live] as [string, RenderedEmail],
  ]);
}

describe("the five, with nothing published", () => {
  it("send the built-in templates", async () => {
    const { emails } = await load();
    const built = await builtins();
    expect(await emails.mortgageTeamNewRequestEmail(NEW_REQUEST)).toEqual(
      built.mortgage_team_new_request,
    );
    expect(await emails.mortgageTeamAtRiskEmail(AT_RISK)).toEqual(built.mortgage_team_at_risk);
    expect(await emails.mortgageTeamBreachedEmail(BREACHED)).toEqual(
      built.mortgage_team_breached,
    );
    expect(await emails.mortgageConsultationBookedEmail(BOOKED)).toEqual(
      built.mortgage_consultation_booked,
    );
    expect(await emails.mortgagePreapprovalInviteEmail(INVITE)).toEqual(
      built.mortgage_preapproval_invite,
    );
  });
});

describe("the team's alerts", () => {
  it("announce a new request by service and reference, with its owner and link", async () => {
    const { emails } = await load();
    const email = await emails.mortgageTeamNewRequestEmail(NEW_REQUEST);
    expect(email.subject).toBe("New Fast Pre-Approval · BZM-26-0412");
    expect(email.text).toContain("· Received: Tue 22 Sep, 10:14\n· Owner: Rashid Khan");
    expect(email.text).toContain(
      "Open the request: https://bazar.example/admin/mortgages/BZM-26-0412",
    );
    expect(email.html).toContain('href="https://bazar.example/admin/mortgages/BZM-26-0412"');
    expect(email.text).toContain("The applicant's details are in the CMS, not in this email.");

    const consultancy = await emails.mortgageTeamNewRequestEmail({
      ...NEW_REQUEST,
      reference: "BZM-26-0415",
      service: "consultancy",
    });
    expect(consultancy.subject).toBe("New Mortgage Consultancy · BZM-26-0415");
  });

  it("say a request nobody owns is unassigned, as the token does", async () => {
    const { emails, templates } = await load();
    for (const ownerName of [null, "  "]) {
      const email = await emails.mortgageTeamNewRequestEmail({ ...NEW_REQUEST, ownerName });
      expect(email.text).toContain("· Owner: Unassigned");
    }
    expect(renderTokens("Owner: {{mortgage_owner}}", { mortgage_owner: null })).toBe(
      "Owner: Unassigned",
    );
    expect(templates.mortgageTeamNewRequestTemplate({ ...NEW_REQUEST, ownerName: null }).html).toContain(
      "Owner: Unassigned",
    );
  });

  it("count what is left of the promise in working time, beside the instant it falls due", async () => {
    const { emails } = await load();
    const email = await emails.mortgageTeamAtRiskEmail(AT_RISK);
    expect(email.subject).toBe("At risk · BZM-26-0412 has 1h 48m left");
    expect(email.text).toContain(
      "This request has 1h 48m of working time left before its promise to the applicant falls due.",
    );
    expect(email.text).toContain("· Due: Thu 24 Sep, 14:14");
    expect(email.html).toContain("<strong>1h 48m</strong>");
  });

  it("report a missed promise as a clock still running: past due, no decision", async () => {
    const { emails } = await load();
    const email = await emails.mortgageTeamBreachedEmail(BREACHED);
    expect(email.subject).toBe("Promise missed · BZM-26-0412");
    expect(email.text).toContain("there is no decision yet");
    expect(email.text).toContain("· Was due: Thu 24 Sep, 14:14");
    expect(email.text).toContain("If the decision needs more time, let them know.");
  });

  it("can hold nothing about the applicant: no such field is in their scope", () => {
    // The only people an alert may name are the team's own. A lead token here
    // would put the applicant's name through the email provider.
    const allowed = new Set([
      "mortgage_reference",
      "mortgage_service",
      "mortgage_submitted",
      "mortgage_owner",
      "mortgage_remaining",
      "mortgage_due",
      "mortgage_request_url",
      "site_url",
    ]);
    for (const key of TEAM) {
      for (const token of SYSTEM_ASSETS[key].tokens) {
        expect(allowed.has(token), `${key} → ${token}`).toBe(true);
      }
    }
  });

  it("carry no name, address or number of the applicant's, in either language", async () => {
    const { emails } = await load();
    const drawn = [
      ...Object.values(await builtins()).slice(0, 3),
      ...(["en", "ar"] as const).flatMap((locale) => {
        const gallery = emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND, locale);
        return TEAM.map((k) => gallery[k].live);
      }),
    ];
    for (const email of drawn) {
      const all = `${email.subject}\n${email.text}\n${email.html}`;
      // A name, a UAE mobile, an email address.
      expect(all).not.toMatch(/Ahmed|Suwaidi|Priya|Raman|\+971|[\w.+-]+@[\w-]+\.[a-z]/i);
    }
  });

  it("name the service in Arabic in the Arabic preview", async () => {
    const { emails } = await load();
    const gallery = emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND, "ar");
    const text = stripIsolates(gallery.mortgage_team_at_risk.live.text);
    expect(text).toContain("الخدمة: الموافقة المبدئية السريعة");
    expect(text).toContain("موعد الاستحقاق: الخميس، 24 سبتمبر، 14:14");
  });
});

describe("the consultation booking", () => {
  it("says when, how, with whom and for how long, and that the invite is attached", async () => {
    const { emails } = await load();
    const email = await emails.mortgageConsultationBookedEmail(BOOKED);
    expect(email.subject).toBe("Your mortgage consultation is booked for Wed 23 Sep, 10:00");
    expect(email.text).toContain("Hello Ahmed,");
    expect(email.text).toContain("Your mortgage consultation with Rashid Khan is booked.");
    expect(email.text).toContain(
      "· When: Wed 23 Sep, 10:00 (UAE time)\n· How: Phone call\n· Duration: 20 minutes\n· Reference: BZM-26-0415",
    );
    expect(email.text).toContain("A calendar invite is attached");
  });

  it("names each format", async () => {
    const { templates } = await load();
    const how = (format: MortgageConsultationBookedOpts["format"]) =>
      templates.mortgageConsultationBookedTemplate({ ...BOOKED, format }).text;
    expect(how("video")).toContain("· How: Video call");
    expect(how("office")).toContain("· How: At our office");
    expect(templates.mortgageConsultationFormatName("phone", "ar")).toBe("مكالمة هاتفية");
    expect(templates.mortgageConsultationFormatName("video", "ar")).toBe("مكالمة فيديو");
    expect(templates.mortgageConsultationFormatName("office", "ar")).toBe("في مكتبنا");
  });

  it("falls back, rather than saying 0 minutes, for a length that is not one", async () => {
    const { templates } = await load();
    for (const durationMinutes of [0, -5, Number.NaN]) {
      expect(templates.consultationLength(durationMinutes)).toBeNull();
      expect(
        templates.mortgageConsultationBookedTemplate({ ...BOOKED, durationMinutes }).text,
      ).toContain("· Duration: as in your calendar invite");
    }
    expect(
      renderTokens("Duration: {{mortgage_consultation_duration}}", {
        mortgage_consultation_duration: null,
      }),
    ).toBe("Duration: as in your calendar invite");
  });
});

describe("consultationLength", () => {
  it("counts minutes in English", async () => {
    const { templates } = await load();
    expect(templates.consultationLength(1)).toBe("1 minute");
    expect(templates.consultationLength(20)).toBe("20 minutes");
  });

  it("counts minutes in every Arabic plural form", async () => {
    const { templates } = await load();
    expect(templates.consultationLength(1, "ar")).toBe("دقيقة واحدة");
    expect(templates.consultationLength(2, "ar")).toBe("دقيقتان");
    expect(templates.consultationLength(3, "ar")).toBe("3 دقائق");
    expect(templates.consultationLength(10, "ar")).toBe("10 دقائق");
    expect(templates.consultationLength(11, "ar")).toBe("11 دقيقة");
    expect(templates.consultationLength(20, "ar")).toBe("20 دقيقة");
    expect(templates.consultationLength(100, "ar")).toBe("100 دقيقة");
  });
});

describe("the Fast Pre-Approval invitation", () => {
  it("carries the secure link, when it expires and the code it will ask for", async () => {
    const { emails } = await load();
    const email = await emails.mortgagePreapprovalInviteEmail(INVITE);
    expect(email.subject).toBe("Your secure link to apply for Fast Pre-Approval");
    expect(email.text).toContain("Hello Ahmed,");
    expect(email.text).toContain(
      "Rashid Khan has sent you a secure link to apply for Fast Pre-Approval with Bazar.",
    );
    expect(email.text).toContain(
      "Your details carry over from your consultation request (BZM-26-0415), so you'll only need to upload your documents.",
    );
    expect(email.text).toContain(
      "Start your application: https://bazar.example/mortgages/r/sample-token",
    );
    expect(email.html).toContain('href="https://bazar.example/mortgages/r/sample-token"');
    // D5: the code goes by email until WhatsApp is connected, so the email names no channel.
    expect(email.text).toContain("we'll send you a code to confirm it's you");
    expect(email.text).toContain("The link works until Wed 30 Sep, 10:00.");
    // Neutral about how the code arrives: that is still open (D5).
    expect(email.text).not.toMatch(/WhatsApp|SMS|text message/i);
  });
});

describe("the applicant's two", () => {
  it("name the applicant by first name and nothing else", async () => {
    const { emails } = await load();
    for (const email of [
      await emails.mortgageConsultationBookedEmail(BOOKED),
      await emails.mortgagePreapprovalInviteEmail(INVITE),
    ]) {
      expect(email.text).toContain("Hello Ahmed,");
      expect(email.html + email.text).not.toContain("Suwaidi");
    }
  });

  it("escape the name and the adviser, and fall back as the tokens do when blank", async () => {
    const { templates } = await load();
    const hostile = {
      name: "<b>Ahmed</b> Al Suwaidi",
      adviserName: '<img src=x onerror="alert(1)">',
    };
    for (const email of [
      templates.mortgageConsultationBookedTemplate({ ...BOOKED, ...hostile }),
      templates.mortgagePreapprovalInviteTemplate({ ...INVITE, ...hostile }),
    ]) {
      expect(email.html).not.toContain("<b>Ahmed</b>");
      expect(email.html).not.toContain("<img src=x");
      expect(email.html).toContain("&lt;b&gt;Ahmed&lt;/b&gt;");
    }
    const blank = { name: "  ", adviserName: " " };
    const booked = templates.mortgageConsultationBookedTemplate({ ...BOOKED, ...blank });
    const invite = templates.mortgagePreapprovalInviteTemplate({ ...INVITE, ...blank });
    expect(booked.text).toContain("Hello there,");
    expect(booked.text).toContain("Your mortgage consultation with Bazar's mortgage team is booked.");
    expect(invite.text).toContain("Bazar's mortgage team has sent you a secure link");
    expect(renderTokens("{{mortgage_adviser}}", { mortgage_adviser: " " })).toBe(
      "Bazar's mortgage team",
    );
  });
});

describe("the wording of all five", () => {
  it("never calls anyone he or she", async () => {
    // Bazar does not record gender, and the designs' "His details carry
    // over…" (C6) is exactly the sentence this rules out.
    const pronoun = /\b(he|she|him|his|her|hers|himself|herself)\b/i;
    for (const [what, email] of await everyEnglishVersion()) {
      expect(`${email.subject}\n${email.text}`, what).not.toMatch(pronoun);
    }
    for (const key of KEYS) {
      expect(SYSTEM_ASSETS[key].trigger, key).not.toMatch(pronoun);
    }
  });

  it("never promises 24 hours of the clock", async () => {
    // The promise runs on working hours (D11); "24 hours" alone reads as a
    // clock the team is not keeping.
    for (const [what, email] of await everyEnglishVersion()) {
      expect(`${email.subject}\n${email.text}`, what).not.toMatch(/\b24 hours\b/);
    }
    for (const key of KEYS) {
      expect(SYSTEM_ASSETS[key].trigger, key).not.toMatch(/\b24 hours\b/);
    }
  });
});

describe("the starting wording", () => {
  it("is the built-in email, sentence for sentence", async () => {
    // Published unchanged, the draft sends what the built-in sends — only the
    // applicant emails' trailing site address, which the shell's footer
    // already carries, is not in the rich-text version.
    const { emails } = await load();
    const gallery = emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND);
    const built = await builtins();
    for (const key of KEYS) {
      const { live, liveSource } = gallery[key];
      expect(liveSource, key).toEqual({ kind: "override", key });
      expect(live.subject, key).toBe(built[key].subject);
      expect(live.text, key).toBe(built[key].text.replace("https://bazar.example\n", ""));
    }
  });

  it("greets the applicant by first name only, in both languages", () => {
    for (const key of APPLICANT) {
      for (const copy of [SYSTEM_EMAIL_DEFAULTS[key], SYSTEM_EMAIL_DEFAULTS_AR[key]]) {
        const tokens = usedTokens(`${copy.subject}\n${copy.body}`);
        expect(tokens, key).toContain("lead_first_name");
        expect(tokens, key).not.toContain("lead_name");
      }
    }
  });

  it("answers the applicant in Arabic, right to left, with Arabic words around the data", async () => {
    const { emails } = await load();
    const gallery = emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND, "ar");

    const booked = gallery.mortgage_consultation_booked.live;
    expect(booked.html).toContain('<html dir="rtl" lang="ar">');
    const bookedText = stripIsolates(booked.text);
    expect(stripIsolates(booked.subject)).toBe(
      "موعد استشارتك في التمويل العقاري: الأربعاء، 23 سبتمبر، 10:00",
    );
    expect(bookedText).toContain("الموعد: الأربعاء، 23 سبتمبر، 10:00 (بتوقيت الإمارات)");
    expect(bookedText).toContain("الطريقة: مكالمة هاتفية");
    expect(bookedText).toContain("المدة: 20 دقيقة");

    const invite = gallery.mortgage_preapproval_invite.live;
    expect(invite.html).toContain('href="https://bazar.example/mortgages/r/sample-token"');
    expect(stripIsolates(invite.text)).toContain("يعمل الرابط حتى الأربعاء، 30 سبتمبر، 10:00.");
  });
});

describe("the registry", () => {
  it("will not publish an alert without its reference and its link", () => {
    for (const key of TEAM) {
      expect(
        missingRequiredTokens(key, { subject: "Heads up", body: "<p>Something happened.</p>" }),
        key,
      ).toEqual(["mortgage_reference", "mortgage_request_url"]);
    }
  });

  it("will not publish the booking without its time, nor the invitation without its link", () => {
    expect(
      missingRequiredTokens("mortgage_consultation_booked", {
        subject: "Booked",
        body: "<p>See you soon.</p>",
      }),
    ).toEqual(["mortgage_consultation_when"]);
    expect(
      missingRequiredTokens("mortgage_preapproval_invite", {
        subject: "Apply",
        body: "<p>Apply now.</p>",
      }),
    ).toEqual(["mortgage_secure_url"]);
  });

  it("says the wording is provisional", () => {
    for (const key of KEYS) {
      expect(SYSTEM_ASSETS[key].trigger, key).toContain(
        "Wording is a provisional draft pending design (D29).",
      );
    }
  });

  it("files the alerts with the team's emails and the other two with the applicant's", () => {
    for (const key of TEAM) expect(SYSTEM_ASSETS[key].audience, key).toBe("team");
    for (const key of APPLICANT) expect(SYSTEM_ASSETS[key].audience, key).toBe("client");
  });
});
