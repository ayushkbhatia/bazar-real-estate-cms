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
import type {
  MortgageBankPackageOpts,
  MortgageBankReminderOpts,
  MortgageDecisionPreApprovedOpts,
} from "./system-emails";
import { renderTokens, usedTokens } from "./tokens";
import { emailSurfaces, formsSending } from "./usage";

/**
 * Partner banks and the pre-approval (migration 0150): the package a bank
 * receives, the reminder with a fresh link, and the applicant's pre-approval.
 * The registry-wide suites already hold them to the rules every system email
 * keeps — seeded, scoped, Arabic, no braces left over. These pin what is
 * particular to them: a bank is never told anything about the applicant, the
 * pre-approval quotes the adviser as plain text and shares the decline's
 * subject, and a draft row sends nothing of its own.
 */

const PACKAGE = "mortgage_bank_package" as const;
const REMINDER = "mortgage_bank_reminder" as const;
const PRE_APPROVED = "mortgage_decision_pre_approved" as const;
const BANK_KEYS = [PACKAGE, REMINDER] as const;
const KEYS = [PACKAGE, REMINDER, PRE_APPROVED] as const;
type Key = (typeof KEYS)[number];

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

/** The row 0150 seeds for `key`: both languages of its starting wording. */
function seededRow(key: Key) {
  return {
    subject: SYSTEM_EMAIL_DEFAULTS[key].subject,
    body: SYSTEM_EMAIL_DEFAULTS[key].body,
    subject_ar: SYSTEM_EMAIL_DEFAULTS_AR[key].subject,
    body_ar: SYSTEM_EMAIL_DEFAULTS_AR[key].body,
    body_format: "html",
  };
}

/**
 * A service-role client holding the three rows as `status`, and no email
 * design. It answers a query only when every filter fits a row, so a read for
 * published wording finds nothing in a draft — the database's answer.
 */
function clientWithRows(status: "draft" | "published") {
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
    maybeSingle: async () => {
      const key = filters.get("system_key");
      const found =
        table === "content_assets" &&
        (KEYS as readonly unknown[]).includes(key) &&
        filters.get("status") === status &&
        filters.get("deleted_at") === null;
      return { data: found ? seededRow(key as Key) : null, error: null };
    },
  };
  return query;
}

/** The real send path over a database holding 0150's rows as `status`. */
async function loadWithRows(status: "draft" | "published") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => clientWithRows(status) }));
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

// The gallery's samples: Priya's file sent to FAB on Wednesday 23 Sep at
// 11:30 in Dubai, a reminder on Friday 25 Sep at 10:00 with a fresh link —
// each link good for 7 days — then FAB's pre-approval, C5's example message.
const BANK_PACKAGE: MortgageBankPackageOpts = {
  bankName: "First Abu Dhabi Bank",
  reference: "BZM-26-0412",
  adviserName: "Yasmin Abdalla",
  link: "https://bazar.example/mortgages/p/sample-token",
  expiresAt: "2026-09-30T07:30:00Z",
  documentCount: 4,
};

const BANK_REMINDER: MortgageBankReminderOpts = {
  bankName: "First Abu Dhabi Bank",
  reference: "BZM-26-0412",
  adviserName: "Yasmin Abdalla",
  link: "https://bazar.example/mortgages/p/sample-token",
  expiresAt: "2026-10-02T06:00:00Z",
  sentAt: "2026-09-23T07:30:00Z",
};

const PRE_APPROVAL: MortgageDecisionPreApprovedOpts = {
  name: "Priya Raman",
  reference: "BZM-26-0412",
  adviserName: "Yasmin Abdalla",
  bankName: "First Abu Dhabi Bank",
  message:
    "Good news, Priya: you're pre-approved. First Abu Dhabi Bank has pre-approved you for up to AED 2,150,000 at 3.99% fixed for 3 years, valid until 21 November 2026. ADCB has also pre-approved you for up to AED 2,000,000.\n\nI'll call you tomorrow morning to talk through both. Yasmin",
};

/** Written to be misread: a script, markup, a link, markdown, a token, blank lines. */
const HOSTILE =
  'Please read this.  \r\n<script>alert(1)</script>\n<a href="https://evil.example">Appeal here</a>\n\n\n\n**Thanks** {{mortgage_adviser}}\n\n';

/** Both languages of each starting wording, as if an editor had published it. */
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
async function builtins(): Promise<Record<Key, RenderedEmail>> {
  const { templates } = await load();
  return {
    [PACKAGE]: templates.mortgageBankPackageTemplate(BANK_PACKAGE),
    [REMINDER]: templates.mortgageBankReminderTemplate(BANK_REMINDER),
    [PRE_APPROVED]: templates.mortgageDecisionPreApprovedTemplate(PRE_APPROVAL),
  };
}

/** Every version of `key`'s sample: built-in, and starting wording in each language. */
async function everyVersion(key: Key): Promise<[string, RenderedEmail][]> {
  const { emails } = await load();
  return [
    [`${key} built-in`, (await builtins())[key]],
    ...(["en", "ar"] as const).map(
      (locale) =>
        [
          `${key} starting wording, ${locale}`,
          emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND, locale)[key].live,
        ] as [string, RenderedEmail],
    ),
  ];
}

/** A built-in's text less its closing site address, which the shell's footer carries. */
const withoutSiteLine = (text: string) => text.replace("https://bazar.example\n", "");

/** Only the rich-text renderer styles a paragraph like this: the published copy. */
const richText = (opening: string) => `<p style="margin:0 0 14px">${opening}</p>`;

const BRACES = /\{\{|\}\}/;

describe("the three, with nothing published", () => {
  it("send the built-in templates, whatever language is asked for", async () => {
    const { emails } = await load();
    const built = await builtins();
    for (const locale of ["en", "ar"] as const) {
      expect(await emails.mortgageBankPackageEmail(BANK_PACKAGE, locale), locale).toEqual(
        built[PACKAGE],
      );
      expect(await emails.mortgageBankReminderEmail(BANK_REMINDER, locale), locale).toEqual(
        built[REMINDER],
      );
      expect(await emails.mortgageDecisionPreApprovedEmail(PRE_APPROVAL, locale), locale).toEqual(
        built[PRE_APPROVED],
      );
    }
    // …and the gallery draws each from the same sample.
    const gallery = emails.renderGallery({}, DEFAULT_EMAIL_BRAND);
    for (const key of KEYS) {
      expect(gallery[key].liveSource, key).toEqual({ kind: "builtin" });
      expect(gallery[key].live, key).toEqual(built[key]);
    }
  });

  it("render completely: no braces in a built-in, nor in the starting wording in either language", async () => {
    for (const key of KEYS) {
      for (const [what, email] of await everyVersion(key)) {
        expect(email.subject, what).not.toMatch(BRACES);
        expect(email.text, what).not.toMatch(BRACES);
        expect(email.html, what).not.toMatch(BRACES);
        expect(email.text.trim(), what).not.toBe("");
      }
    }
  });
});

describe("the package", () => {
  it("says who shared what, links to it, and how long the link works", async () => {
    const { emails } = await load();
    const email = await emails.mortgageBankPackageEmail(BANK_PACKAGE);
    expect(email.subject).toBe("Fast Pre-Approval package BZM-26-0412 from Bazar");
    expect(email.text).toBe(
      "Hello to the team at First Abu Dhabi Bank,\n\n" +
        "Yasmin Abdalla from Bazar's mortgage team has shared a Fast Pre-Approval application with you: a structured summary and 4 documents.\n\n" +
        "Open the package: https://bazar.example/mortgages/p/sample-token\n\n" +
        // Dubai time, printed as the invitation prints its expiry: 07:30 UTC is 11:30.
        "The link works until Wed 30 Sep, 11:30. Every open and download is recorded.\n\n" +
        "Reply to this email to reach Yasmin Abdalla.\n\n" +
        "— The Bazar mortgage team\nhttps://bazar.example\n",
    );
    expect(email.html).toContain('href="https://bazar.example/mortgages/p/sample-token"');
    expect(email.html).toContain(">Open the package</a>");
    expect(email.html).toContain("<strong>Wed 30 Sep, 11:30</strong>");
  });

  it("counts the documents in either language, and falls back rather than say 0 documents", async () => {
    const { templates } = await load();
    expect(templates.mortgageDocumentCount(1)).toBe("1 document");
    expect(templates.mortgageDocumentCount(4)).toBe("4 documents");
    expect(
      templates.mortgageBankPackageTemplate({ ...BANK_PACKAGE, documentCount: 1 }).text,
    ).toContain("a structured summary and 1 document.");
    for (const documentCount of [0, -2, Number.NaN]) {
      expect(templates.mortgageDocumentCount(documentCount)).toBeNull();
      expect(
        templates.mortgageBankPackageTemplate({ ...BANK_PACKAGE, documentCount }).text,
      ).toContain("a structured summary and its documents.");
    }
    expect(renderTokens("{{mortgage_document_count}}", { mortgage_document_count: null })).toBe(
      "its documents",
    );
    expect(renderTokens("{{mortgage_document_count}}", {}, "ar")).toBe("مستنداته");
    const ar = (n: number) => templates.mortgageDocumentCount(n, "ar");
    expect([1, 2, 4, 10, 11, 100].map(ar)).toEqual([
      "مستند واحد",
      "مستندان",
      "4 مستندات",
      "10 مستندات",
      "11 مستنداً",
      "100 مستند",
    ]);
  });

  it("greets the team at the bank, and still reads right when a name falls back", async () => {
    const { templates } = await load();
    const blank = templates.mortgageBankPackageTemplate({
      ...BANK_PACKAGE,
      bankName: " ",
      adviserName: " ",
    });
    expect(blank.text).toContain(
      "Hello to the team at the bank,\n\nBazar's mortgage team has shared a Fast Pre-Approval application with you",
    );
    expect(blank.text).toContain("Reply to this email to reach Bazar's mortgage team.");
    // Named once in the opening line, not "…team from Bazar's mortgage team".
    expect(blank.text).not.toContain("from Bazar's mortgage team");
    expect(renderTokens("Hello to the team at {{mortgage_bank}},", {})).toBe(
      "Hello to the team at the bank,",
    );
    expect(renderTokens("تحية طيبة إلى فريق {{mortgage_bank}}،", {}, "ar")).toBe(
      "تحية طيبة إلى فريق البنك،",
    );
  });

  it("escapes the bank's and the adviser's names", async () => {
    const { templates } = await load();
    const hostile = templates.mortgageBankPackageTemplate({
      ...BANK_PACKAGE,
      bankName: "<b>FAB</b>",
      adviserName: '<img src=x onerror="alert(1)">',
    });
    expect(hostile.html).not.toMatch(/<b>FAB|<img src=x/);
    expect(hostile.html).toContain("&lt;b&gt;FAB&lt;/b&gt;");
    expect(hostile.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});

describe("the reminder", () => {
  it("says when the package went, and carries a fresh link and how long it works", async () => {
    const { emails } = await load();
    const email = await emails.mortgageBankReminderEmail(BANK_REMINDER);
    expect(email.subject).toBe("Reminder: Fast Pre-Approval package BZM-26-0412");
    expect(email.text).toBe(
      "Hello to the team at First Abu Dhabi Bank,\n\n" +
        "A reminder that Yasmin Abdalla shared Fast Pre-Approval application BZM-26-0412 with you on Wed 23 Sep. We'd be grateful for your response.\n\n" +
        "Here's a fresh link, working until Fri 2 Oct, 10:00.\n\n" +
        "Open the package: https://bazar.example/mortgages/p/sample-token\n\n" +
        "Every open and download is recorded.\n\n" +
        "Reply to this email to reach Yasmin Abdalla.\n\n" +
        "— The Bazar mortgage team\nhttps://bazar.example\n",
    );
    expect(email.html).toContain('href="https://bazar.example/mortgages/p/sample-token"');
    expect(email.html).toContain("<strong>Fri 2 Oct, 10:00</strong>");
  });

  it("prints the day the package went as a date in Dubai, in either language", async () => {
    const { templates } = await load();
    expect(templates.mortgageDay("2026-09-23T07:30:00Z")).toBe("Wed 23 Sep");
    // 21:30 UTC on the 22nd is already the 23rd in Dubai.
    expect(templates.mortgageDay("2026-09-22T21:30:00Z")).toBe("Wed 23 Sep");
    expect(templates.mortgageDay("2026-09-23T07:30:00Z", "ar")).toBe("الأربعاء، 23 سبتمبر");
    expect(renderTokens("on {{mortgage_package_sent}}", {})).toBe("on an earlier date");
    expect(renderTokens("في {{mortgage_package_sent}}", {}, "ar")).toBe("في تاريخ سابق");
  });

  it("reads the same with or without the adviser's name, published or built in", async () => {
    const { emails, templates } = await loadWithRows("published");
    for (const adviserName of ["Yasmin Abdalla", " "]) {
      const opts = { ...BANK_REMINDER, adviserName };
      const sent = await emails.mortgageBankReminderEmail(opts);
      const built = templates.mortgageBankReminderTemplate(opts);
      expect(sent.html).toContain("data-email-button");
      expect(sent.text, adviserName).toBe(withoutSiteLine(built.text));
    }
    expect(templates.mortgageBankReminderTemplate({ ...BANK_REMINDER, adviserName: "" }).text).toContain(
      "A reminder that Bazar's mortgage team shared Fast Pre-Approval application BZM-26-0412 with you on Wed 23 Sep.",
    );
  });
});

describe("the bank emails", () => {
  /** Priya as the local seed files her (scripts/db-local/seed-mortgage.ts). */
  const PRIYA = [
    "Priya",
    "Raman",
    "1990-03-14",
    "14 / 03 / 1990",
    "14/03/1990",
    "+971502184417",
    "+971 50 218 4417",
    "priya.raman@example.com",
  ];

  it("never name the applicant or give their date of birth, mobile, email or salary, in any version or language", async () => {
    const { emails } = await load();
    const drawn: [string, RenderedEmail][] = [
      ["package, sent", await emails.mortgageBankPackageEmail(BANK_PACKAGE)],
      ["reminder, sent", await emails.mortgageBankReminderEmail(BANK_REMINDER)],
      ...(await everyVersion(PACKAGE)),
      ...(await everyVersion(REMINDER)),
    ];
    for (const [what, email] of drawn) {
      const all = `${email.subject}\n${email.text}\n${email.html}`;
      for (const detail of PRIYA) expect(all, `${what}: ${detail}`).not.toContain(detail);
      expect(all, what).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]/i);
      expect(all, what).not.toMatch(/\+971/);
      expect(all, what).not.toMatch(/AED|درهم|salary|راتب/i);
      // The reference is how the bank knows the file.
      expect(all, what).toContain("BZM-26-0412");
    }
  });

  it("can hold nothing about the applicant: no such field is in their scope", () => {
    const allowed = new Set([
      "mortgage_bank",
      "mortgage_reference",
      "mortgage_adviser",
      "mortgage_document_count",
      "mortgage_package_sent",
      "mortgage_package_url",
      "mortgage_link_expires",
      "site_url",
    ]);
    for (const key of BANK_KEYS) {
      for (const token of SYSTEM_ASSETS[key].tokens) {
        expect(allowed.has(token), `${key} → ${token}`).toBe(true);
      }
      for (const copy of [SYSTEM_EMAIL_DEFAULTS[key], SYSTEM_EMAIL_DEFAULTS_AR[key]]) {
        expect(usedTokens(`${copy.subject}\n${copy.body}`).filter((t) => t.startsWith("lead_")), key)
          .toEqual([]);
      }
    }
  });
});

describe("the pre-approval", () => {
  it("says who has written, quotes their message, says the letter is attached, and how to reach them", async () => {
    const { emails } = await load();
    const email = await emails.mortgageDecisionPreApprovedEmail(PRE_APPROVAL);
    expect(email.subject).toBe("An update on your Fast Pre-Approval application — BZM-26-0412");
    expect(email.text).toBe(
      "Hello Priya,\n\n" +
        "Yasmin Abdalla from Bazar's mortgage team has written about your Fast Pre-Approval application BZM-26-0412.\n\n" +
        "> Good news, Priya: you're pre-approved. First Abu Dhabi Bank has pre-approved you for up to AED 2,150,000 at 3.99% fixed for 3 years, valid until 21 November 2026. ADCB has also pre-approved you for up to AED 2,000,000.\n\n" +
        "> I'll call you tomorrow morning to talk through both. Yasmin\n\n" +
        "Your pre-approval letter from First Abu Dhabi Bank is attached.\n\n" +
        "You can reply to this email to reach Yasmin Abdalla directly, or call the mortgage team on +971 2 632 2223.\n\n" +
        "— The Bazar mortgage team\nhttps://bazar.example\n",
    );
    expect(email.html).toContain('<div dir="ltr"');
    expect(email.html).toContain("up to AED 2,000,000.<br><br>I'll call you tomorrow morning");
    // The template only says the letter is there; the caller attaches it.
    expect(Object.keys(email).sort()).toEqual(["html", "subject", "text"]);
  });

  it("renders in Arabic from the Arabic twin, right to left, with the team's number left to right", async () => {
    const { emails } = await loadWithRows("published");
    const ar = await emails.mortgageDecisionPreApprovedEmail(PRE_APPROVAL, "ar");
    expect(ar.html).toContain('<html dir="rtl" lang="ar">');
    expect(stripIsolates(ar.subject)).toBe(
      "تحديث بشأن طلبك للموافقة المبدئية السريعة — BZM-26-0412",
    );
    const text = stripIsolates(ar.text);
    expect(text).toContain("مرحباً Priya،");
    expect(text).toContain(
      "وصلتك رسالة من Yasmin Abdalla، من فريق التمويل العقاري في بازار، بخصوص طلبك للموافقة المبدئية السريعة BZM-26-0412.",
    );
    expect(text).toContain("مرفق بهذه الرسالة خطاب موافقتك المبدئية الصادر عن First Abu Dhabi Bank.");
    // The adviser's words are not translated: the panel quotes them, right to left.
    expect(ar.html).toContain('<div dir="rtl"');
    expect(text).toContain("> I'll call you tomorrow morning to talk through both. Yasmin");
    for (const half of [ar.html, ar.text]) {
      expect(half).toContain(`${LRI}+971 2 632 2223${PDI}`);
    }

    // An English applicant still gets English, with no isolate marks in it.
    const en = await emails.mortgageDecisionPreApprovedEmail(PRE_APPROVAL, "en");
    expect(en.html).toContain('<html dir="ltr" lang="en">');
    expect(en.html).toBe(stripIsolates(en.html));
    expect(en.text).toBe(stripIsolates(en.text));
  });

  it("shares the decline's subject, so a lock screen tells the two outcomes apart by nothing", async () => {
    const { templates, emails } = await load();
    const decline = { name: "Priya Raman", reference: "BZM-26-0412", adviserName: "Yasmin Abdalla", message: "x" };
    expect(templates.mortgageDecisionPreApprovedTemplate(PRE_APPROVAL).subject).toBe(
      templates.mortgageDecisionDeclinedTemplate(decline).subject,
    );
    expect(SYSTEM_EMAIL_DEFAULTS[PRE_APPROVED].subject).toBe(
      SYSTEM_EMAIL_DEFAULTS.mortgage_decision_declined.subject,
    );
    expect(SYSTEM_EMAIL_DEFAULTS_AR[PRE_APPROVED].subject).toBe(
      SYSTEM_EMAIL_DEFAULTS_AR.mortgage_decision_declined.subject,
    );
    const subjects = [
      ...(await everyVersion(PRE_APPROVED)).map(([, email]) => email.subject),
      (await emails.mortgageDecisionPreApprovedEmail(PRE_APPROVAL)).subject,
    ];
    for (const subject of subjects) {
      // "Pre-Approval" is the service's name; these are the outcome's words.
      expect(subject).not.toMatch(/approved|declin|reject|good news|congrat|success|sorry|regret/i);
      expect(subject).not.toMatch(/تمت الموافقة|تهانينا|مبروك|يسعدنا|رفض|نأسف|للأسف/);
      expect(subject).not.toContain("Priya");
    }
  });

  it("keeps the adviser's message plain text: escaped, a script included, never markup, a link or a token, with its line breaks kept", async () => {
    const { emails, templates } = await loadWithRows("published");
    const built = templates.mortgageDecisionPreApprovedTemplate({ ...PRE_APPROVAL, message: HOSTILE });
    const published = await emails.mortgageDecisionPreApprovedEmail({ ...PRE_APPROVAL, message: HOSTILE });
    expect(published.html).toContain(richText("Hello Priya,"));
    expect(built.html).not.toContain(richText("Hello Priya,"));
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
      expect(email.text, what).toContain(
        '> Please read this.\n> <script>alert(1)</script>\n> <a href="https://evil.example">Appeal here</a>\n\n> **Thanks** {{mortgage_adviser}}\n\nYour pre-approval letter from First Abu Dhabi Bank is attached.',
      );
    }
    const two = templates.mortgageDecisionPreApprovedTemplate({
      ...PRE_APPROVAL,
      message: "First line.\nSecond line.",
    });
    expect(two.html).toContain("First line.<br>Second line.</div>");
    expect(two.text).toContain("> First line.\n> Second line.\n\nYour pre-approval letter");
    const none = templates.mortgageDecisionPreApprovedTemplate({ ...PRE_APPROVAL, message: " \n " });
    expect(none.text).toContain("BZM-26-0412.\n\nYour pre-approval letter from First Abu Dhabi Bank is attached.");
    expect(none.text).not.toMatch(/^>/m);
  });

  it("escapes the names, and falls back as the tokens do when they are blank", async () => {
    const { templates } = await load();
    const hostile = templates.mortgageDecisionPreApprovedTemplate({
      ...PRE_APPROVAL,
      name: "<b>Priya</b> Raman",
      bankName: "<i>FAB</i>",
    });
    expect(hostile.html).not.toMatch(/<b>Priya|<i>FAB/);
    expect(hostile.html).toContain("&lt;b&gt;Priya&lt;/b&gt;");
    expect(hostile.html).toContain("&lt;i&gt;FAB&lt;/i&gt;");

    const blank = templates.mortgageDecisionPreApprovedTemplate({
      ...PRE_APPROVAL,
      name: " ",
      adviserName: " ",
      bankName: " ",
    });
    expect(blank.text).toContain(
      "Hello there,\n\nBazar's mortgage team has written about your Fast Pre-Approval application BZM-26-0412.",
    );
    expect(blank.text).toContain("Your pre-approval letter from the bank is attached.");
    expect(blank.text).toContain(
      "You can reply to this email to reach Bazar's mortgage team directly, or call the mortgage team on +971 2 632 2223.",
    );
    expect(blank.text).not.toContain("from Bazar's mortgage team");
    expect(renderTokens("{{mortgage_bank}}", { mortgage_bank: " " })).toBe("the bank");
    expect(renderTokens("{{mortgage_bank}}", {}, "ar")).toBe("البنك");
  });

  it("greets the applicant by first name and holds nothing else about them", async () => {
    for (const copy of [SYSTEM_EMAIL_DEFAULTS[PRE_APPROVED], SYSTEM_EMAIL_DEFAULTS_AR[PRE_APPROVED]]) {
      const tokens = usedTokens(`${copy.subject}\n${copy.body}`);
      expect(tokens).toContain("lead_first_name");
      expect(tokens).not.toContain("lead_name");
    }
    expect(SYSTEM_ASSETS[PRE_APPROVED].tokens).not.toContain("lead_name");
    for (const [what, email] of await everyVersion(PRE_APPROVED)) {
      const all = `${email.subject}\n${email.text}\n${email.html}`;
      expect(all, what).toContain("Priya");
      expect(all, what).not.toMatch(/Raman|1990|priya\.raman@|\+971[\s-]?5\d/);
    }
  });
});

describe("the starting wording", () => {
  it("is each built-in email, sentence for sentence", async () => {
    // Published unchanged, a draft sends what the built-in sends — only the
    // trailing site address, which the shell's footer already carries, is not
    // in the rich-text version.
    const { emails } = await load();
    const gallery = emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND);
    const built = await builtins();
    for (const key of KEYS) {
      const { live, liveSource } = gallery[key];
      expect(liveSource, key).toEqual({ kind: "override", key });
      expect(live.subject, key).toBe(built[key].subject);
      expect(live.text, key).toBe(withoutSiteLine(built[key].text));
    }
  });

  it("stays the built-in email through the send path, whatever it is handed", async () => {
    const { emails, templates } = await loadWithRows("published");
    for (const documentCount of [1, 4, 0]) {
      const opts = { ...BANK_PACKAGE, documentCount };
      const sent = await emails.mortgageBankPackageEmail(opts);
      const built = templates.mortgageBankPackageTemplate(opts);
      expect(sent.html).toContain(richText("Hello to the team at First Abu Dhabi Bank,"));
      expect(sent.subject).toBe(built.subject);
      expect(sent.text, String(documentCount)).toBe(withoutSiteLine(built.text));
    }
    const reminder = await emails.mortgageBankReminderEmail(BANK_REMINDER);
    expect(reminder.html).toContain(richText("Hello to the team at First Abu Dhabi Bank,"));
    expect(reminder.text).toBe(withoutSiteLine(templates.mortgageBankReminderTemplate(BANK_REMINDER).text));
    for (const message of [PRE_APPROVAL.message, HOSTILE, "One line.", ""]) {
      const opts = { ...PRE_APPROVAL, message };
      const sent = await emails.mortgageDecisionPreApprovedEmail(opts);
      const built = templates.mortgageDecisionPreApprovedTemplate(opts);
      expect(sent.html, JSON.stringify(message)).toContain(richText("Hello Priya,"));
      expect(sent.subject, JSON.stringify(message)).toBe(built.subject);
      expect(sent.text, JSON.stringify(message)).toBe(withoutSiteLine(built.text));
    }
  });

  it("never calls anyone he or she", async () => {
    // Bazar does not record gender; the Arabic keeps the adviser out of every verb.
    const pronoun = /\b(he|she|him|his|her|hers|himself|herself)\b/i;
    for (const key of KEYS) {
      for (const [what, email] of (await everyVersion(key)).slice(0, 2)) {
        expect(`${email.subject}\n${email.text}`, what).not.toMatch(pronoun);
      }
      expect(SYSTEM_ASSETS[key].trigger, key).not.toMatch(pronoun);
    }
  });
});

describe("draft rows", () => {
  it("send the built-in templates, in either language, until they are published", async () => {
    const draft = await loadWithRows("draft");
    const built = {
      [PACKAGE]: draft.templates.mortgageBankPackageTemplate(BANK_PACKAGE),
      [REMINDER]: draft.templates.mortgageBankReminderTemplate(BANK_REMINDER),
      [PRE_APPROVED]: draft.templates.mortgageDecisionPreApprovedTemplate(PRE_APPROVAL),
    };
    for (const locale of ["en", "ar"] as const) {
      expect(await draft.emails.mortgageBankPackageEmail(BANK_PACKAGE, locale), locale).toEqual(
        built[PACKAGE],
      );
      expect(await draft.emails.mortgageBankReminderEmail(BANK_REMINDER, locale), locale).toEqual(
        built[REMINDER],
      );
      expect(
        await draft.emails.mortgageDecisionPreApprovedEmail(PRE_APPROVAL, locale),
        locale,
      ).toEqual(built[PRE_APPROVED]);
    }
    // The same rows published are what send: the mock is not what kept them out.
    const published = await loadWithRows("published");
    const sent = [
      await published.emails.mortgageBankPackageEmail(BANK_PACKAGE),
      await published.emails.mortgageBankReminderEmail(BANK_REMINDER),
      await published.emails.mortgageDecisionPreApprovedEmail(PRE_APPROVAL),
    ];
    expect(sent[0]).not.toEqual(built[PACKAGE]);
    expect(sent[1]).not.toEqual(built[REMINDER]);
    expect(sent[2]).not.toEqual(built[PRE_APPROVED]);
    expect(sent[2]!.html).toContain(richText("Hello Priya,"));
  });

  it("are how 0150 seeds them, in both languages, never overwriting a row already there", () => {
    const sql = readFileSync(
      path.resolve(__dirname, "../../supabase/migrations/0150_mortgage_bank_emails.sql"),
      "utf8",
    );
    const insert = sql.slice(sql.indexOf("insert into public.content_assets"));
    expect(insert.trimEnd().endsWith("on conflict (slug) do nothing;")).toBe(true);
    expect(insert.match(/'draft',\s*1\s*\)/g)).toHaveLength(3);
    expect(insert).not.toContain("'published'");
    for (const key of KEYS) {
      const start = insert.indexOf(`$s$${SYSTEM_ASSETS[key].slug}$s$`);
      expect(start, key).toBeGreaterThan(-1);
      const row = insert.slice(start, insert.indexOf("'draft'", start));
      expect(row, key).toContain(`$s$${key}$s$`);
      expect(row, key).toContain(`$s$${SYSTEM_EMAIL_DEFAULTS_AR[key].subject}$s$`);
      expect(row, key).toContain(`$body$${SYSTEM_EMAIL_DEFAULTS_AR[key].body}$body$`);
    }
  });
});

describe("the registry", () => {
  it("lists all three", () => {
    const expected: Record<Key, { slug: string; label: string; builtIn: string }> = {
      [PACKAGE]: {
        slug: "system-mortgage-bank-package",
        label: "Package to a partner bank",
        builtIn: "lib/email-templates.ts · mortgageBankPackageTemplate",
      },
      [REMINDER]: {
        slug: "system-mortgage-bank-reminder",
        label: "Reminder to a partner bank",
        builtIn: "lib/email-templates.ts · mortgageBankReminderTemplate",
      },
      [PRE_APPROVED]: {
        slug: "system-mortgage-decision-pre-approved",
        label: "Pre-approval confirmed",
        builtIn: "lib/email-templates.ts · mortgageDecisionPreApprovedTemplate",
      },
    };
    for (const key of KEYS) {
      expect(SYSTEM_ASSET_KEYS, key).toContain(key);
      expect(isSystemAssetKey(key), key).toBe(true);
      // The gallery groups outside recipients with the applicants: its only
      // other group is the team's own.
      expect(SYSTEM_ASSETS[key], key).toMatchObject({ key, audience: "client", ...expected[key] });
      expect(SYSTEM_EMAIL_DEFAULTS[key], key).toBeDefined();
      expect(SYSTEM_EMAIL_DEFAULTS_AR[key], key).toBeDefined();
    }
  });

  it("will not publish a bank email without its reference and link, nor the pre-approval without the message", () => {
    const empty = { subject: "Hello", body: "<p>Something happened.</p>" };
    for (const key of BANK_KEYS) {
      expect(missingRequiredTokens(key, empty), key).toEqual([
        "mortgage_reference",
        "mortgage_package_url",
      ]);
    }
    expect(missingRequiredTokens(PRE_APPROVED, empty)).toEqual(["mortgage_adviser_message"]);
    for (const key of KEYS) {
      expect(missingRequiredTokens(key, SYSTEM_EMAIL_DEFAULTS[key]), key).toEqual([]);
      expect(missingRequiredTokens(key, SYSTEM_EMAIL_DEFAULTS_AR[key]), key).toEqual([]);
    }
  });

  it("says the wording is provisional", () => {
    for (const key of KEYS) {
      expect(SYSTEM_ASSETS[key].trigger, key).toContain(
        "Wording is a provisional draft pending design (D29).",
      );
    }
  });

  it("says each is sent from the mortgage team's CMS, not from a public form", () => {
    for (const key of KEYS) {
      const surfaces = emailSurfaces(key);
      expect(surfaces.map((s) => s.adminPath), key).toEqual(["/admin/mortgages"]);
      expect(surfaces.every((s) => !s.path && !!s.note), key).toBe(true);
      expect(formsSending(key), key).toEqual([]);
    }
    expect(emailSurfaces(PACKAGE)[0]!.note).toContain("from the request's file");
    expect(emailSurfaces(REMINDER)[0]!.note).toContain("decision screen");
    expect(emailSurfaces(PRE_APPROVED)[0]!.note).toContain("decision screen");
  });
});
