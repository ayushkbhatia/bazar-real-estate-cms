import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { LRI, PDI, stripIsolates } from "@/lib/i18n/bidi";
import { DEFAULT_EMAIL_BRAND } from "./email-brand";
import {
  SYSTEM_ASSETS,
  SYSTEM_ASSET_KEYS,
  isSystemAssetKey,
  missingRequiredTokens,
  type SystemAssetKey,
} from "./system";
import { SYSTEM_EMAIL_DEFAULTS } from "./system-defaults";
import { SYSTEM_EMAIL_DEFAULTS_AR } from "./system-defaults-ar";
import type { RenderedEmail, SystemEmailCopy } from "./system-render";
import type { MortgageDecisionDeclinedOpts } from "./system-emails";
import { renderTokens, usedTokens } from "./tokens";
import { emailSurfaces, formsSending } from "./usage";

/**
 * Declining a Fast Pre-Approval (migration 0148): the applicant's email, which
 * is the adviser's own message and how to reach them. The registry-wide suites
 * already hold it to the rules every system email keeps — seeded, scoped,
 * Arabic, no braces left over. These pin what is particular to it: the message
 * arrives as plain text with every line quoted, the subject never says
 * "declined", nothing about the applicant goes in but their first name, and a
 * draft row sends nothing of its own.
 */

const KEY = "mortgage_decision_declined" as const;

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

/** The row 0148 seeds: both languages of the starting wording. */
function seededRow() {
  return {
    subject: SYSTEM_EMAIL_DEFAULTS[KEY].subject,
    body: SYSTEM_EMAIL_DEFAULTS[KEY].body,
    subject_ar: SYSTEM_EMAIL_DEFAULTS_AR[KEY].subject,
    body_ar: SYSTEM_EMAIL_DEFAULTS_AR[KEY].body,
    body_format: "html",
  };
}

/**
 * A service-role client holding that one row as `status`, and no email
 * design. It answers a query only when every filter fits the row, so a read
 * for published wording finds nothing in a draft — the database's answer.
 */
function clientWithRow(status: "draft" | "published") {
  let table = "";
  const filters = new Map<string, unknown>();
  const query: Record<string, unknown> = {
    from: (t: string) => {
      table = t;
      filters.clear();
      return query;
    },
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters.set(column, value);
      return query;
    },
    is: (column: string, value: unknown) => {
      filters.set(column, value);
      return query;
    },
    abortSignal: () => query,
    maybeSingle: async () => ({
      data:
        table === "content_assets" &&
        filters.get("system_key") === KEY &&
        filters.get("status") === status &&
        filters.get("deleted_at") === null
          ? seededRow()
          : null,
      error: null,
    }),
  };
  return query;
}

/** The real send path over a database holding 0148's row as `status`. */
async function loadWithRow(status: "draft" | "published") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => clientWithRow(status) }));
  try {
    const emails = await import("./system-emails");
    const templates = await import("@/lib/email-templates");
    return { emails, templates };
  } finally {
    vi.doUnmock("@/lib/supabase/admin");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
  }
}

// The gallery's sample: the confirmation's Priya, declined on debt burden —
// the CMS's prefilled message for that reason, as Yasmin signed it.
const DECLINE: MortgageDecisionDeclinedOpts = {
  name: "Priya Raman",
  reference: "BZM-26-0412",
  adviserName: "Yasmin Abdalla",
  message:
    "Priya, thank you for applying for Fast Pre-Approval with Bazar. I've been through your application carefully, and I'm sorry to say we're not able to secure a pre-approval for you at the moment.\n\nUAE Central Bank rules cap your total monthly repayments, including the new mortgage, at half of your monthly income. With your current loan and card repayments, a mortgage would take you over that limit.\n\nPaying down or closing a loan or credit card can bring you back within it, and we can then look at your application again.\n\nIf you'd like to talk it through, just reply to this email.\n\nYasmin",
};

/** Written to be misread: a script, markup, a link, markdown, a token, blank lines. */
const HOSTILE =
  'Please read this.  \r\n<script>alert(1)</script>\n<a href="https://evil.example">Appeal here</a>\n\n\n\n**Thanks** {{mortgage_adviser}}\n\n';

/** Both languages of the starting wording, as if an editor had published it. */
function publishedDefaults(): Partial<Record<SystemAssetKey, SystemEmailCopy>> {
  return {
    [KEY]: {
      ...SYSTEM_EMAIL_DEFAULTS[KEY],
      subjectAr: SYSTEM_EMAIL_DEFAULTS_AR[KEY].subject,
      bodyAr: SYSTEM_EMAIL_DEFAULTS_AR[KEY].body,
      format: "html" as const,
    },
  };
}

/** Every version of the sample: built-in, and starting wording in each language. */
async function everyVersion(): Promise<[string, RenderedEmail][]> {
  const { emails, templates } = await load();
  return [
    ["built-in", templates.mortgageDecisionDeclinedTemplate(DECLINE)],
    ...(["en", "ar"] as const).map(
      (locale) =>
        [
          `starting wording, ${locale}`,
          emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND, locale)[KEY].live,
        ] as [string, RenderedEmail],
    ),
  ];
}

/** A built-in's text less its closing site address, which the shell's footer carries. */
const withoutSiteLine = (text: string) => text.replace("https://bazar.example\n", "");

/** Only the rich-text renderer styles a paragraph like this: the published copy. */
const RICH_TEXT_GREETING = '<p style="margin:0 0 14px">Hello Priya,</p>';

const BRACES = /\{\{|\}\}/;

describe("the decline, with nothing published", () => {
  it("sends the built-in template, whatever language is asked for", async () => {
    const { emails, templates } = await load();
    const built = templates.mortgageDecisionDeclinedTemplate(DECLINE);
    for (const locale of ["en", "ar"] as const) {
      expect(await emails.mortgageDecisionDeclinedEmail(DECLINE, locale), locale).toEqual(built);
    }
    // …and the gallery draws it from the same sample.
    const { live, liveSource } = emails.renderGallery({}, DEFAULT_EMAIL_BRAND)[KEY];
    expect(liveSource).toEqual({ kind: "builtin" });
    expect(live).toEqual(built);
  });

  it("renders completely: no braces in the built-in, nor in the starting wording in either language", async () => {
    for (const [what, email] of await everyVersion()) {
      expect(email.subject, what).not.toMatch(BRACES);
      expect(email.text, what).not.toMatch(BRACES);
      expect(email.html, what).not.toMatch(BRACES);
      expect(email.text.trim(), what).not.toBe("");
    }
  });
});

describe("the email", () => {
  it("says who has written, quotes their message, and how to reach them", async () => {
    const { emails } = await load();
    const email = await emails.mortgageDecisionDeclinedEmail(DECLINE);
    expect(email.subject).toBe("An update on your Fast Pre-Approval application — BZM-26-0412");
    expect(email.text).toBe(
      "Hello Priya,\n\n" +
        "Yasmin Abdalla from Bazar's mortgage team has written about your Fast Pre-Approval application BZM-26-0412.\n\n" +
        "> Priya, thank you for applying for Fast Pre-Approval with Bazar. I've been through your application carefully, and I'm sorry to say we're not able to secure a pre-approval for you at the moment.\n\n" +
        "> UAE Central Bank rules cap your total monthly repayments, including the new mortgage, at half of your monthly income. With your current loan and card repayments, a mortgage would take you over that limit.\n\n" +
        "> Paying down or closing a loan or credit card can bring you back within it, and we can then look at your application again.\n\n" +
        "> If you'd like to talk it through, just reply to this email.\n\n" +
        "> Yasmin\n\n" +
        "You can reply to this email to reach Yasmin Abdalla directly, or call the mortgage team on +971 2 632 2223.\n\n" +
        "— The Bazar mortgage team\nhttps://bazar.example\n",
    );
    // The message is one panel, its paragraphs kept.
    expect(email.html).toContain('<div dir="ltr"');
    expect(email.html).toContain("at the moment.<br><br>UAE Central Bank rules");
    expect(email.html).toContain("just reply to this email.<br><br>Yasmin</div>");
  });

  it("renders in Arabic from the Arabic twin, right to left, with the team's number left to right", async () => {
    const { emails } = await loadWithRow("published");
    const ar = await emails.mortgageDecisionDeclinedEmail(DECLINE, "ar");
    expect(ar.html).toContain('<html dir="rtl" lang="ar">');
    expect(stripIsolates(ar.subject)).toBe(
      "تحديث بشأن طلبك للموافقة المبدئية السريعة — BZM-26-0412",
    );
    const text = stripIsolates(ar.text);
    expect(text).toContain("مرحباً Priya،");
    expect(text).toContain(
      "وصلتك رسالة من Yasmin Abdalla، من فريق التمويل العقاري في بازار، بخصوص طلبك للموافقة المبدئية السريعة BZM-26-0412.",
    );
    // The adviser's words are not translated: the panel quotes them, right to left.
    expect(ar.html).toContain('<div dir="rtl"');
    expect(text).toContain("> If you'd like to talk it through, just reply to this email.\n\n> Yasmin");
    // Bare, "+971 2 632 2223" would render as "2223 632 2 971+" in an RTL line.
    for (const half of [ar.html, ar.text]) {
      expect(half).toContain(`${LRI}+971 2 632 2223${PDI}`);
    }
    expect(text).toContain(
      "يمكنك الرد على هذه الرسالة للتواصل مع Yasmin Abdalla مباشرةً، أو الاتصال بفريق التمويل العقاري على +971 2 632 2223.",
    );

    // An English applicant still gets English, with no isolate marks in it.
    const en = await emails.mortgageDecisionDeclinedEmail(DECLINE, "en");
    expect(en.html).toContain('<html dir="ltr" lang="en">');
    expect(en.html).toBe(stripIsolates(en.html));
    expect(en.text).toBe(stripIsolates(en.text));
  });

  it("greets the applicant by first name and holds nothing else about them, in every version", async () => {
    for (const [what, email] of await everyVersion()) {
      const all = `${email.subject}\n${email.text}\n${email.html}`;
      expect(all, what).toContain("Priya");
      // The surname, an email address, a UAE mobile, a date of birth, an income.
      expect(all, what).not.toMatch(/Raman/);
      expect(all, what).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]/i);
      expect(all, what).not.toMatch(/\+971[\s-]?5\d/);
      expect(all, what).not.toMatch(/\b(?:19|20)\d{2}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);
      expect(all, what).not.toMatch(/AED\s?\d|درهم/);
      // The one phone number in it is the mortgage team's.
      const numbers = [...all.matchAll(/\+\d[\d\s]*\d/g)].map((m) => m[0]);
      expect(numbers.length, what).toBeGreaterThan(0);
      for (const n of numbers) expect(n, what).toBe("+971 2 632 2223");
    }
  });

  it("escapes the names, and falls back as the tokens do when they are blank", async () => {
    const { templates } = await load();
    const hostile = templates.mortgageDecisionDeclinedTemplate({
      ...DECLINE,
      name: "<b>Priya</b> Raman",
      adviserName: '<img src=x onerror="alert(1)">',
    });
    expect(hostile.html).not.toMatch(/<b>Priya|<img src=x/);
    expect(hostile.html).toContain("&lt;b&gt;Priya&lt;/b&gt;");
    expect(hostile.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");

    const blank = templates.mortgageDecisionDeclinedTemplate({
      ...DECLINE,
      name: " ",
      adviserName: " ",
    });
    expect(blank.text).toContain(
      "Hello there,\n\nBazar's mortgage team has written about your Fast Pre-Approval application BZM-26-0412.",
    );
    expect(blank.text).toContain(
      "You can reply to this email to reach Bazar's mortgage team directly, or call the mortgage team on +971 2 632 2223.",
    );
    // Named once in the opening line, not "…team from Bazar's mortgage team".
    expect(blank.text).not.toContain("from Bazar's mortgage team");
    expect(renderTokens("{{mortgage_adviser}}", { mortgage_adviser: " " })).toBe(
      "Bazar's mortgage team",
    );
    expect(renderTokens("{{lead_first_name}}", { lead_first_name: "" })).toBe("there");
  });
});

describe("the adviser's message", () => {
  it("is plain text: escaped — a script included — never markup, a link or a token, with its line breaks kept", async () => {
    const { emails, templates } = await loadWithRow("published");
    const built = templates.mortgageDecisionDeclinedTemplate({ ...DECLINE, message: HOSTILE });
    const published = await emails.mortgageDecisionDeclinedEmail({ ...DECLINE, message: HOSTILE });
    expect(published.html).toContain(RICH_TEXT_GREETING);
    expect(built.html).not.toContain(RICH_TEXT_GREETING);
    for (const [what, email] of [
      ["built-in", built],
      ["starting wording", published],
    ] as const) {
      expect(email.html, what).toContain(
        "Please read this.<br>&lt;script&gt;alert(1)&lt;/script&gt;<br>&lt;a href=&quot;https://evil.example&quot;&gt;Appeal here&lt;/a&gt;<br><br>**Thanks** {{mortgage_adviser}}</div>",
      );
      expect(email.html, what).not.toContain("<script");
      expect(email.html, what).not.toContain('href="https://evil.example"');
      expect(email.html, what).not.toContain("<strong>Thanks</strong>");
      // A token typed into the message stays the characters typed.
      expect(email.html, what).not.toContain("**Thanks** Yasmin Abdalla");
      expect(email.text, what).toContain(
        '> Please read this.\n> <script>alert(1)</script>\n> <a href="https://evil.example">Appeal here</a>\n\n> **Thanks** {{mortgage_adviser}}\n\nYou can reply to this email',
      );
    }
  });

  it("keeps every line of a short message, and a blank one draws no quote at all", async () => {
    const { templates } = await load();
    const two = templates.mortgageDecisionDeclinedTemplate({
      ...DECLINE,
      message: "First line.\nSecond line.",
    });
    expect(two.html).toContain("First line.<br>Second line.</div>");
    expect(two.text).toContain("> First line.\n> Second line.\n\nYou can reply to this email");

    const none = templates.mortgageDecisionDeclinedTemplate({ ...DECLINE, message: " \n\t\n" });
    expect(none.text).toContain(
      "application BZM-26-0412.\n\nYou can reply to this email to reach Yasmin Abdalla directly",
    );
    expect(none.text).not.toMatch(/^>/m);
    expect(none.html).not.toContain("<div dir=");
  });
});

describe("the subject", () => {
  it("never says the application was declined, in any version or language", async () => {
    const { emails } = await load();
    const subjects: [string, string][] = [
      ["default", SYSTEM_EMAIL_DEFAULTS[KEY].subject],
      ["default, Arabic", SYSTEM_EMAIL_DEFAULTS_AR[KEY].subject],
      ["send, English", (await emails.mortgageDecisionDeclinedEmail(DECLINE)).subject],
      ...(await everyVersion()).map(([what, email]) => [what, email.subject] as [string, string]),
    ];
    for (const [what, subject] of subjects) {
      expect(subject, what).not.toMatch(
        /declin|reject|refus|unsuccessful|denied|turned down|not approved|sorry|regret/i,
      );
      // رفض refused · مرفوض rejected · نأسف/للأسف/نعتذر sorry · تعذر unable.
      expect(subject, what).not.toMatch(/رفض|مرفوض|نأسف|للأسف|نعتذر|اعتذار|تعذ/);
      // A lock screen shows it, so no name either: just the reference.
      expect(subject, what).not.toContain("Priya");
    }
    const [builtIn, , ar] = await everyVersion();
    expect(builtIn[1].subject).toBe("An update on your Fast Pre-Approval application — BZM-26-0412");
    expect(stripIsolates(ar[1].subject)).toBe(
      "تحديث بشأن طلبك للموافقة المبدئية السريعة — BZM-26-0412",
    );
  });
});

describe("the starting wording", () => {
  it("is the built-in email, sentence for sentence", async () => {
    // Published unchanged, the draft sends what the built-in sends — only the
    // trailing site address, which the shell's footer already carries, is
    // not in the rich-text version.
    const { emails, templates } = await load();
    const { live, liveSource } = emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND)[KEY];
    const built = templates.mortgageDecisionDeclinedTemplate(DECLINE);
    expect(liveSource).toEqual({ kind: "override", key: KEY });
    expect(live.subject).toBe(built.subject);
    expect(live.text).toBe(withoutSiteLine(built.text));
  });

  it("stays the built-in email through the send path, whatever the adviser writes", async () => {
    const { emails, templates } = await loadWithRow("published");
    for (const message of [DECLINE.message, HOSTILE, "One line.", ""]) {
      const opts = { ...DECLINE, message };
      const sent = await emails.mortgageDecisionDeclinedEmail(opts);
      const built = templates.mortgageDecisionDeclinedTemplate(opts);
      expect(sent.html, JSON.stringify(message)).toContain(RICH_TEXT_GREETING);
      expect(sent.subject, JSON.stringify(message)).toBe(built.subject);
      expect(sent.text, JSON.stringify(message)).toBe(withoutSiteLine(built.text));
    }
  });

  it("greets the applicant by first name only, in both languages", () => {
    for (const copy of [SYSTEM_EMAIL_DEFAULTS[KEY], SYSTEM_EMAIL_DEFAULTS_AR[KEY]]) {
      const tokens = usedTokens(`${copy.subject}\n${copy.body}`);
      expect(tokens).toContain("lead_first_name");
      expect(tokens).not.toContain("lead_name");
    }
  });

  it("never calls anyone he or she", async () => {
    // Bazar does not record gender; the Arabic keeps the adviser out of every verb.
    const pronoun = /\b(he|she|him|his|her|hers|himself|herself)\b/i;
    for (const [what, email] of (await everyVersion()).slice(0, 2)) {
      expect(`${email.subject}\n${email.text}`, what).not.toMatch(pronoun);
    }
    expect(SYSTEM_ASSETS[KEY].trigger).not.toMatch(pronoun);
  });
});

describe("a draft row", () => {
  it("sends the built-in template, in either language, until it is published", async () => {
    const draft = await loadWithRow("draft");
    const built = draft.templates.mortgageDecisionDeclinedTemplate(DECLINE);
    for (const locale of ["en", "ar"] as const) {
      expect(await draft.emails.mortgageDecisionDeclinedEmail(DECLINE, locale), locale).toEqual(
        built,
      );
    }
    // The same row published is what sends: the mock is not what kept it out.
    const published = await loadWithRow("published");
    const en = await published.emails.mortgageDecisionDeclinedEmail(DECLINE);
    expect(en).not.toEqual(published.templates.mortgageDecisionDeclinedTemplate(DECLINE));
    expect(en.html).toContain(RICH_TEXT_GREETING);
    const ar = await published.emails.mortgageDecisionDeclinedEmail(DECLINE, "ar");
    expect(ar.html).toContain('<html dir="rtl" lang="ar">');
  });

  it("is how 0148 seeds it, in both languages, never overwriting a row already there", () => {
    const sql = readFileSync(
      path.resolve(__dirname, "../../supabase/migrations/0148_mortgage_decline_email.sql"),
      "utf8",
    );
    const row = sql.slice(
      sql.indexOf("$s$system-mortgage-decision-declined$s$"),
      sql.indexOf("on conflict (slug) do nothing"),
    );
    expect(row).toContain("$s$mortgage_decision_declined$s$");
    expect(row).toContain(`$s$${SYSTEM_EMAIL_DEFAULTS_AR[KEY].subject}$s$`);
    expect(row).toContain(`$body$${SYSTEM_EMAIL_DEFAULTS_AR[KEY].body}$body$`);
    expect(row.trim()).toMatch(/'draft',\s*1\s*\)$/);
    expect(row).not.toContain("'published'");
  });
});

describe("the registry", () => {
  it("lists it, with the emails to applicants", () => {
    expect(SYSTEM_ASSET_KEYS).toContain(KEY);
    expect(isSystemAssetKey(KEY)).toBe(true);
    expect(SYSTEM_ASSETS[KEY]).toMatchObject({
      key: KEY,
      slug: "system-mortgage-decision-declined",
      label: "Fast Pre-Approval declined",
      audience: "client",
      builtIn: "lib/email-templates.ts · mortgageDecisionDeclinedTemplate",
    });
    expect(SYSTEM_EMAIL_DEFAULTS[KEY]).toBeDefined();
    expect(SYSTEM_EMAIL_DEFAULTS_AR[KEY]).toBeDefined();
  });

  it("will not publish it without the adviser's message, in either language", () => {
    expect(
      missingRequiredTokens(KEY, { subject: "An update", body: "<p>We've decided.</p>" }),
    ).toEqual(["mortgage_adviser_message"]);
    expect(missingRequiredTokens(KEY, SYSTEM_EMAIL_DEFAULTS[KEY])).toEqual([]);
    expect(missingRequiredTokens(KEY, SYSTEM_EMAIL_DEFAULTS_AR[KEY])).toEqual([]);
  });

  it("can hold nothing about the applicant but their first name: no such field is in its scope", () => {
    const allowed = new Set([
      "lead_first_name",
      "mortgage_reference",
      "mortgage_adviser",
      "mortgage_adviser_message",
      "site_url",
    ]);
    for (const token of SYSTEM_ASSETS[KEY].tokens) {
      expect(allowed.has(token), token).toBe(true);
    }
  });

  it("says the wording is provisional", () => {
    expect(SYSTEM_ASSETS[KEY].trigger).toContain(
      "Wording is a provisional draft pending design (D29).",
    );
  });

  it("says it is sent from the mortgage team's CMS, not from a public form", () => {
    const surfaces = emailSurfaces(KEY);
    expect(surfaces.map((s) => s.adminPath)).toEqual(["/admin/mortgages"]);
    expect(surfaces.every((s) => !s.path && !!s.note)).toBe(true);
    expect(formsSending(KEY)).toEqual([]);
  });
});
