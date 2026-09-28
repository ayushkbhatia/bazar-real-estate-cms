import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { stripIsolates } from "@/lib/i18n/bidi";
import { DEFAULT_EMAIL_BRAND } from "./email-brand";
import {
  SYSTEM_ASSETS,
  isSystemAssetKey,
  missingRequiredTokens,
  type SystemAssetKey,
} from "./system";
import { SYSTEM_EMAIL_DEFAULTS } from "./system-defaults";
import { SYSTEM_EMAIL_DEFAULTS_AR } from "./system-defaults-ar";
import type { RenderedEmail, SystemEmailCopy } from "./system-render";
import type {
  MortgageCodeOpts,
  MortgageReuploadRequestOpts,
  MortgageTeamAlertOpts,
} from "./system-emails";
import { renderTokens, usedTokens } from "./tokens";
import { emailSurfaces } from "./usage";

/**
 * Reviewing the documents (migration 0146): the adviser's re-upload request,
 * the code that opens a secure link, and the team's notice that the document
 * is back. The registry-wide suites already hold them to the rules every
 * system email keeps — seeded, scoped, Arabic, no braces left over. These pin
 * what is particular to them: the adviser's message arrives as plain text
 * with every line quoted, the code never reaches a subject line, and the
 * team's notice carries nothing about the applicant.
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

/** Every system email published as its starting wording, in both languages. */
function publishedRow(key: SystemAssetKey) {
  return {
    subject: SYSTEM_EMAIL_DEFAULTS[key].subject,
    body: SYSTEM_EMAIL_DEFAULTS[key].body,
    subject_ar: SYSTEM_EMAIL_DEFAULTS_AR[key].subject,
    body_ar: SYSTEM_EMAIL_DEFAULTS_AR[key].body,
    body_format: "html",
  };
}

/** A service-role client that finds those rows, and no email design. */
function publishedClient() {
  let table = "";
  let key: string | null = null;
  const query: Record<string, unknown> = {
    from: (t: string) => {
      table = t;
      return query;
    },
    select: () => query,
    is: () => query,
    abortSignal: () => query,
    eq: (column: string, value: string) => {
      if (column === "system_key") key = value;
      return query;
    },
    maybeSingle: async () => ({
      data:
        table === "content_assets" && key && isSystemAssetKey(key) ? publishedRow(key) : null,
      error: null,
    }),
  };
  return query;
}

/**
 * The send functions with the starting wording published unchanged: the real
 * send path, the real bindings, any arguments — which the gallery, drawing
 * only each email's sample, cannot give.
 */
async function loadPublished() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => publishedClient() }));
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

// The gallery's samples: W8's file — Karim's 12-month statements, three
// months short — asked for on Tuesday 22 Sep at 11:52, the link good for 7
// days.
const REUPLOAD: MortgageReuploadRequestOpts = {
  name: "Karim Haddad",
  reference: "BZM-26-0409",
  adviserName: "Yasmin Abdalla",
  documentName: "Last 1 year's bank statements",
  message:
    "Your statements cover September 2025 to May 2026.\nFor a full year, please add June, July and August 2026.",
  link: "https://bazar.example/mortgages/r/sample-token",
  expiresAt: "2026-09-29T07:52:00Z",
};

const CODE: MortgageCodeOpts = { name: "Karim Haddad", code: "730528", minutes: 10 };

const RECEIVED: MortgageTeamAlertOpts & { documentName: string; files: number } = {
  reference: "BZM-26-0409",
  service: "pre_approval",
  link: "https://bazar.example/admin/mortgages/BZM-26-0409",
  documentName: "Last 1 year's bank statements",
  files: 1,
};

/** Written to be misread: markup, a link, markdown, a token, blank lines. */
const HOSTILE =
  'Please re-send <b>all</b> pages.  \r\n<a href="https://evil.example">Upload here</a>\n\n\n\n**Thanks** {{mortgage_secure_url}}\n\n';

const APPLICANT = ["mortgage_reupload_request", "mortgage_code"] as const;
const TEAM = "mortgage_team_reupload_received" as const;
const KEYS = [...APPLICANT, TEAM] as const;
type Key = (typeof KEYS)[number];

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
async function builtins(): Promise<Record<Key, RenderedEmail>> {
  const { templates } = await load();
  return {
    mortgage_reupload_request: templates.mortgageReuploadRequestTemplate(REUPLOAD),
    mortgage_code: templates.mortgageCodeTemplate(CODE),
    mortgage_team_reupload_received: templates.mortgageTeamReuploadReceivedTemplate(RECEIVED),
  };
}

/** Every English version of the three: built-in, and starting wording published. */
async function everyEnglishVersion(): Promise<[string, RenderedEmail][]> {
  const { emails } = await load();
  const gallery = emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND);
  const built = await builtins();
  return KEYS.flatMap((k) => [
    [`${k} built-in`, built[k]] as [string, RenderedEmail],
    [`${k} starting wording`, gallery[k].live] as [string, RenderedEmail],
  ]);
}

/** A built-in's text less its closing site address, which the shell's footer carries. */
const withoutSiteLine = (text: string) => text.replace("https://bazar.example\n", "");

const BRACES = /\{\{|\}\}/;

describe("the three, with nothing published", () => {
  it("send the built-in templates, whatever language is asked for", async () => {
    const { emails } = await load();
    const built = await builtins();
    for (const locale of ["en", "ar"] as const) {
      expect(await emails.mortgageReuploadRequestEmail(REUPLOAD, locale), locale).toEqual(
        built.mortgage_reupload_request,
      );
      expect(await emails.mortgageCodeEmail(CODE, locale), locale).toEqual(built.mortgage_code);
    }
    expect(await emails.mortgageTeamReuploadReceivedEmail(RECEIVED)).toEqual(
      built.mortgage_team_reupload_received,
    );
  });

  it("render completely: no braces in a built-in, nor in the starting wording in either language", async () => {
    const { emails } = await load();
    const drawn: [string, RenderedEmail][] = Object.entries(await builtins()).map(
      ([k, email]) => [`${k} built-in`, email],
    );
    for (const locale of ["en", "ar"] as const) {
      const gallery = emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND, locale);
      for (const k of KEYS) {
        expect(gallery[k].liveSource, k).toEqual({ kind: "override", key: k });
        drawn.push([`${k} starting wording, ${locale}`, gallery[k].live]);
      }
    }
    for (const [what, email] of drawn) {
      expect(email.subject, what).not.toMatch(BRACES);
      expect(email.text, what).not.toMatch(BRACES);
      expect(email.html, what).not.toMatch(BRACES);
      expect(email.text.trim(), what).not.toBe("");
    }
  });
});

describe("the re-upload request", () => {
  it("names the document, quotes the adviser, and carries the link and its terms", async () => {
    const { emails } = await load();
    const email = await emails.mortgageReuploadRequestEmail(REUPLOAD);
    expect(email.subject).toBe("One document needs another look — BZM-26-0409");
    expect(email.text).toContain(
      "Yasmin Abdalla has asked for another look at one document for your application BZM-26-0409: Last 1 year's bank statements.",
    );
    expect(email.html).toContain("<strong>Last 1 year's bank statements</strong>");
    expect(email.text).toContain(
      "> Your statements cover September 2025 to May 2026.\n> For a full year, please add June, July and August 2026.",
    );
    expect(email.text).toContain(
      "Your application is on hold until the document arrives. Any documents we've already accepted stay accepted.",
    );
    expect(email.text).toContain(
      "Upload your document: https://bazar.example/mortgages/r/sample-token",
    );
    expect(email.html).toContain('href="https://bazar.example/mortgages/r/sample-token"');
    expect(email.text).toContain("Before you upload, we'll send you a code to confirm it's you.");
    // Dubai time, printed as the flow prints it: 07:52 UTC is 11:52.
    expect(email.text).toContain(
      "The link works until Tue 29 Sep, 11:52. It's personal to you, so please don't forward this email.",
    );
    expect(email.text).toContain("— The Bazar mortgage team");
    // How the code arrives changes when WhatsApp is connected (D5).
    expect(email.text).not.toMatch(/WhatsApp|SMS|text message|your mobile/i);
  });

  it("greets the applicant by first name and says nothing else about them", async () => {
    const { emails } = await load();
    const email = await emails.mortgageReuploadRequestEmail(REUPLOAD);
    expect(email.text).toContain("Hello Karim,");
    expect(email.html + email.text).not.toContain("Haddad");
  });

  it("escapes the names, and falls back as the tokens do when they are blank", async () => {
    const { templates } = await load();
    const hostile = templates.mortgageReuploadRequestTemplate({
      ...REUPLOAD,
      name: "<b>Karim</b> Haddad",
      adviserName: '<img src=x onerror="alert(1)">',
      documentName: "<i>Statements</i>",
    });
    expect(hostile.html).not.toMatch(/<b>Karim|<img src=x|<i>Statements/);
    expect(hostile.html).toContain("&lt;b&gt;Karim&lt;/b&gt;");
    expect(hostile.html).toContain("&lt;i&gt;Statements&lt;/i&gt;");

    const blank = templates.mortgageReuploadRequestTemplate({
      ...REUPLOAD,
      name: " ",
      adviserName: " ",
      documentName: " ",
    });
    expect(blank.text).toContain(
      "Hello there,\n\nBazar's mortgage team has asked for another look at one document for your application BZM-26-0409: the requested document.",
    );
    expect(renderTokens("{{mortgage_document}}", { mortgage_document: " " })).toBe(
      "the requested document",
    );
  });

  it("can name the document in the applicant's language", async () => {
    const { templates } = await load();
    expect(templates.mortgageDocumentName("bank_statements_12m")).toBe(
      "Last 1 year's bank statements",
    );
    expect(templates.mortgageDocumentName("bank_statements_12m", "ar")).toBe(
      "كشوف الحساب البنكية لآخر سنة",
    );
  });
});

describe("the adviser's message", () => {
  it("is plain text: escaped, never markup, a link or a token, with its line breaks kept", async () => {
    const { emails, templates } = await loadPublished();
    const built = templates.mortgageReuploadRequestTemplate({ ...REUPLOAD, message: HOSTILE });
    const published = await emails.mortgageReuploadRequestEmail({ ...REUPLOAD, message: HOSTILE });
    // Only the rich-text renderer marks a button, so this is the published copy.
    expect(published.html).toContain("data-email-button");
    expect(built.html).not.toContain("data-email-button");
    for (const [what, email] of [
      ["built-in", built],
      ["starting wording", published],
    ] as const) {
      expect(email.html, what).toContain(
        "Please re-send &lt;b&gt;all&lt;/b&gt; pages.<br>&lt;a href=&quot;https://evil.example&quot;&gt;Upload here&lt;/a&gt;<br><br>**Thanks** {{mortgage_secure_url}}</div>",
      );
      expect(email.html, what).not.toContain("<b>all</b>");
      expect(email.html, what).not.toContain('href="https://evil.example"');
      expect(email.html, what).not.toContain("<strong>Thanks</strong>");
      // A token typed into the message stays the characters typed.
      expect(email.html.match(/href="https:\/\/bazar\.example\/mortgages\/r\/sample-token"/g), what)
        .toHaveLength(1);
      expect(email.text, what).toContain(
        '> Please re-send <b>all</b> pages.\n> <a href="https://evil.example">Upload here</a>\n\n> **Thanks** {{mortgage_secure_url}}\n\nYour application is on hold',
      );
    }
  });

  it("is tidied the way the plain-text half tidies, and a blank one draws nothing", async () => {
    const { templates } = await load();
    const block = templates.mortgageAdviserMessageBlock(
      "\n\n  First line.\t \r\nSecond\u0000 line.\r\n\r\n\r\nThird line.\n \n",
    );
    expect(block.text).toBe(">   First line.\n> Second line.\n\n> Third line.");
    expect(block.html).toContain("  First line.<br>Second line.<br><br>Third line.</div>");
    expect(templates.mortgageAdviserMessageBlock(" \n\t\n")).toEqual({ html: "", text: "" });
    // …and with no message, the email simply has no quote.
    const none = templates.mortgageReuploadRequestTemplate({ ...REUPLOAD, message: "" });
    expect(none.text).toContain(
      "Last 1 year's bank statements.\n\nYour application is on hold until the document arrives.",
    );
    expect(none.text).not.toContain(">");
  });

  it("stays the adviser's words in an Arabic email, each line isolated, right to left", async () => {
    const { emails } = await load();
    const gallery = emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND, "ar");
    const { html, text } = gallery.mortgage_reupload_request.live;
    expect(html).toContain('<div dir="rtl"');
    expect(html).toContain("⁨Your statements cover September 2025 to May 2026.⁩<br>");
    expect(stripIsolates(text)).toContain(
      "> Your statements cover September 2025 to May 2026.\n> For a full year, please add June, July and August 2026.",
    );
  });
});

describe("the code", () => {
  it("is never in the subject line, in any version", async () => {
    const { emails } = await load();
    const versions: [string, RenderedEmail][] = [
      ["built-in", (await builtins()).mortgage_code],
      ["send, English", await emails.mortgageCodeEmail(CODE)],
    ];
    for (const locale of ["en", "ar"] as const) {
      const gallery = emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND, locale);
      versions.push([`starting wording, ${locale}`, gallery.mortgage_code.live]);
    }
    for (const [what, email] of versions) {
      expect(email.subject, what).not.toContain("730528");
      expect(email.html, what).toContain("730528");
      // On a line of its own; the Arabic isolates it, as it does every value.
      expect(stripIsolates(email.text), what).toContain("\n730528\n");
    }
    expect(versions[0][1].subject).toBe("Your Bazar verification code");
    expect(SYSTEM_EMAIL_DEFAULTS.mortgage_code.subject).not.toContain("verification_code");
    expect(SYSTEM_EMAIL_DEFAULTS_AR.mortgage_code.subject).not.toContain("verification_code");
  });

  it("says what it opens, how long it lasts, and what it guards", async () => {
    const { emails } = await load();
    const email = await emails.mortgageCodeEmail(CODE);
    expect(email.text).toBe(
      "Hello Karim,\n\n" +
        "Use this code to open your secure link:\n\n" +
        "730528\n\n" +
        "It expires in 10 minutes.\n\n" +
        "If you didn't ask for it, you can ignore this email — nobody can open your application without the code.\n\n" +
        "— The Bazar mortgage team\nhttps://bazar.example\n",
    );
  });

  it("counts the minutes in either language, and falls back rather than say 0 minutes", async () => {
    const { templates, emails } = await load();
    expect(templates.mortgageCodeTemplate({ ...CODE, minutes: 1 }).text).toContain(
      "It expires in 1 minute.",
    );
    for (const minutes of [0, -5, Number.NaN]) {
      expect(templates.minuteCount(minutes)).toBeNull();
      expect(templates.mortgageCodeTemplate({ ...CODE, minutes }).text).toContain(
        "It expires in a few minutes.",
      );
    }
    expect(renderTokens("{{mortgage_code_expires_in}}", {})).toBe("a few minutes");
    expect(templates.minuteCount(2, "ar")).toBe("دقيقتان");
    expect(templates.minuteCount(10, "ar")).toBe("10 دقائق");
    const gallery = emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND, "ar");
    expect(stripIsolates(gallery.mortgage_code.live.text)).toContain(
      "تنتهي صلاحيته خلال 10 دقائق.",
    );
  });
});

describe("the team's notice", () => {
  it("names the request, the document and the files, and says the clock has resumed", async () => {
    const { emails } = await load();
    const email = await emails.mortgageTeamReuploadReceivedEmail(RECEIVED);
    expect(email.subject).toBe("Re-upload received · BZM-26-0409");
    expect(email.text).toContain(
      "· Reference: BZM-26-0409\n· Service: Fast Pre-Approval\n· Document: Last 1 year's bank statements\n· Uploaded: 1 file",
    );
    expect(email.text).toContain(
      "The request is back in review, and the clock on its promise to the applicant has resumed.",
    );
    expect(email.text).toContain(
      "Open the request: https://bazar.example/admin/mortgages/BZM-26-0409",
    );
    expect(email.html).toContain('href="https://bazar.example/admin/mortgages/BZM-26-0409"');
  });

  it("counts files in both languages, and falls back for a count that is not one", async () => {
    const { templates } = await load();
    expect(templates.mortgageFileCount(3)).toBe("3 files");
    expect(templates.mortgageFileCount(2, "ar")).toBe("ملفان");
    expect(templates.mortgageFileCount(11, "ar")).toBe("11 ملفاً");
    expect(templates.mortgageFileCount(0)).toBeNull();
    expect(
      templates.mortgageTeamReuploadReceivedTemplate({ ...RECEIVED, files: 0 }).text,
    ).toContain("· Uploaded: new files");
    expect(renderTokens("{{mortgage_files}}", { mortgage_files: null })).toBe("new files");
  });

  it("can hold nothing about the applicant: no such field is in its scope", () => {
    const allowed = new Set([
      "mortgage_reference",
      "mortgage_service",
      "mortgage_document",
      "mortgage_files",
      "mortgage_request_url",
      "site_url",
    ]);
    for (const token of SYSTEM_ASSETS[TEAM].tokens) {
      expect(allowed.has(token), token).toBe(true);
    }
  });

  it("carries no name, address or number of the applicant's, in either language", async () => {
    const { emails } = await load();
    const drawn = [
      (await builtins())[TEAM],
      await emails.mortgageTeamReuploadReceivedEmail(RECEIVED),
      ...(["en", "ar"] as const).map(
        (locale) =>
          emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND, locale)[TEAM].live,
      ),
    ];
    for (const email of drawn) {
      const all = `${email.subject}\n${email.text}\n${email.html}`;
      // A name, a UAE mobile, an email address.
      expect(all).not.toMatch(/Karim|Haddad|\+971|[\w.+-]+@[\w-]+\.[a-z]/i);
    }
  });

  it("names the service and counts the files in Arabic in the Arabic preview", async () => {
    const { emails } = await load();
    const gallery = emails.renderGallery(publishedDefaults(), DEFAULT_EMAIL_BRAND, "ar");
    const text = stripIsolates(gallery[TEAM].live.text);
    expect(text).toContain("الخدمة: الموافقة المبدئية السريعة");
    expect(text).toContain("الملفات المرفوعة: ملف واحد");
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
      expect(live.text, key).toBe(withoutSiteLine(built[key].text));
    }
  });

  it("stays the built-in email through the send path, whatever the adviser writes", async () => {
    const { emails, templates } = await loadPublished();
    for (const message of [REUPLOAD.message, HOSTILE, "One line.", ""]) {
      const opts = { ...REUPLOAD, message };
      const sent = await emails.mortgageReuploadRequestEmail(opts);
      const built = templates.mortgageReuploadRequestTemplate(opts);
      // Only the rich-text renderer marks a button: this is the published copy.
      expect(sent.html).toContain("data-email-button");
      expect(sent.subject, JSON.stringify(message)).toBe(built.subject);
      expect(sent.text, JSON.stringify(message)).toBe(withoutSiteLine(built.text));
    }
    const code = await emails.mortgageCodeEmail(CODE);
    expect(code.html).toContain("<h2");
    expect(code.text).toBe(withoutSiteLine(templates.mortgageCodeTemplate(CODE).text));
    const team = await emails.mortgageTeamReuploadReceivedEmail({ ...RECEIVED, files: 4 });
    expect(team.html).toContain("data-email-button");
    expect(team.text).toBe(
      templates.mortgageTeamReuploadReceivedTemplate({ ...RECEIVED, files: 4 }).text,
    );
    // An Arabic applicant is answered from the Arabic twin.
    const ar = await emails.mortgageReuploadRequestEmail(REUPLOAD, "ar");
    expect(ar.html).toContain('<html dir="rtl" lang="ar">');
    expect(stripIsolates(ar.subject)).toBe("أحد مستنداتك يحتاج إلى نظرة أخرى — BZM-26-0409");
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

  it("never calls anyone he or she, nor promises 24 hours of the clock", async () => {
    // Bazar does not record gender (C4's "His three accepted documents" is
    // the sentence this rules out), and the promise runs on working hours.
    const pronoun = /\b(he|she|him|his|her|hers|himself|herself)\b/i;
    for (const [what, email] of await everyEnglishVersion()) {
      expect(`${email.subject}\n${email.text}`, what).not.toMatch(pronoun);
      expect(`${email.subject}\n${email.text}`, what).not.toMatch(/\b24 hours\b/);
    }
    for (const key of KEYS) {
      expect(SYSTEM_ASSETS[key].trigger, key).not.toMatch(pronoun);
      expect(SYSTEM_ASSETS[key].trigger, key).not.toMatch(/\b24 hours\b/);
    }
  });
});

describe("the registry", () => {
  it("will not publish any of the three without what makes it work", () => {
    const empty = { subject: "Hello", body: "<p>Something happened.</p>" };
    expect(missingRequiredTokens("mortgage_reupload_request", empty)).toEqual([
      "mortgage_secure_url",
    ]);
    expect(missingRequiredTokens("mortgage_code", empty)).toEqual(["verification_code"]);
    expect(missingRequiredTokens(TEAM, empty)).toEqual([
      "mortgage_reference",
      "mortgage_request_url",
    ]);
  });

  it("says the wording is provisional", () => {
    for (const key of KEYS) {
      expect(SYSTEM_ASSETS[key].trigger, key).toContain(
        "Wording is a provisional draft pending design (D29).",
      );
    }
  });

  it("files the applicant's two with the client emails and the notice with the team's", () => {
    for (const key of APPLICANT) expect(SYSTEM_ASSETS[key].audience, key).toBe("client");
    expect(SYSTEM_ASSETS[TEAM].audience).toBe("team");
  });

  it("says where each is sent from", () => {
    expect(emailSurfaces("mortgage_reupload_request").map((s) => s.adminPath)).toEqual([
      "/admin/mortgages",
    ]);
    expect(emailSurfaces(TEAM).map((s) => s.adminPath)).toEqual(["/admin/mortgages"]);
    // A secure link is one applicant's, so the code has no page to point at.
    const [code, ...rest] = emailSurfaces("mortgage_code");
    expect(rest).toEqual([]);
    expect(code.path ?? code.adminPath).toBeUndefined();
    expect(code.note).toBeTruthy();
  });
});
