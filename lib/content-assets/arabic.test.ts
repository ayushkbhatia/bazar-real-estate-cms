import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { SYSTEM_ASSETS, SYSTEM_ASSET_KEYS } from "./system";
import { SYSTEM_EMAIL_DEFAULTS } from "./system-defaults";
import { SYSTEM_EMAIL_DEFAULTS_AR } from "./system-defaults-ar";
import { FORM_REPLY_DEFAULT_AR, FORM_REPLY_TOKENS } from "./form-replies";
import { DEFAULT_EMAIL_BRAND } from "./email-brand";
import { copyForLocale, renderSystemEmail } from "./system-render";
import {
  TOKENS,
  outOfScopeTokens,
  renderTokens,
  unknownTokens,
  usedTokens,
} from "./tokens";

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://bazar.example");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

/** The tokens a body uses, in appearance order — the thing translation breaks. */
const tokensOf = (d: { subject: string; body: string }) =>
  usedTokens(`${d.subject}\n${d.body}`).sort();

describe("the Arabic first draft", () => {
  it("covers every email the site sends", () => {
    expect(Object.keys(SYSTEM_EMAIL_DEFAULTS_AR).sort()).toEqual(
      [...SYSTEM_ASSET_KEYS].sort(),
    );
  });

  it("is actually Arabic, in both the subject and the body", () => {
    const arabic = /[؀-ۿ]/;
    for (const key of SYSTEM_ASSET_KEYS) {
      const d = SYSTEM_EMAIL_DEFAULTS_AR[key];
      expect(arabic.test(d.subject), `${key} subject`).toBe(true);
      expect(arabic.test(d.body.replace(/<[^>]+>/g, "")), `${key} body`).toBe(true);
    }
  });

  it("keeps every token the English uses, untranslated", () => {
    // A translated {{lead_first_name}} is not a token any more: it fills with
    // nothing, and the lead is greeted by a blank.
    for (const key of SYSTEM_ASSET_KEYS) {
      expect(tokensOf(SYSTEM_EMAIL_DEFAULTS_AR[key]), key).toEqual(
        tokensOf(SYSTEM_EMAIL_DEFAULTS[key]),
      );
    }
  });

  it("uses only tokens each email can fill", () => {
    for (const key of SYSTEM_ASSET_KEYS) {
      const d = SYSTEM_EMAIL_DEFAULTS_AR[key];
      const text = `${d.subject}\n${d.body}`;
      expect(unknownTokens(text), key).toEqual([]);
      expect(outOfScopeTokens(text, SYSTEM_ASSETS[key].tokens), key).toEqual([]);
    }
  });

  it("gives a new form reply an Arabic half with the same tokens", () => {
    expect(outOfScopeTokens(FORM_REPLY_DEFAULT_AR.body, FORM_REPLY_TOKENS)).toEqual([]);
    expect(/[؀-ۿ]/.test(FORM_REPLY_DEFAULT_AR.subject)).toBe(true);
  });

  it("is in migration 0129, verbatim", () => {
    const sql = readFileSync(
      path.resolve(__dirname, "../../supabase/migrations/0129_content_assets_arabic.sql"),
      "utf8",
    );
    for (const key of SYSTEM_ASSET_KEYS) {
      const d = SYSTEM_EMAIL_DEFAULTS_AR[key];
      expect(sql, `${key} subject`).toContain(d.subject);
      expect(sql, `${key} body`).toContain(d.body);
    }
    // …and only where nobody has written one, so a re-run never overwrites.
    expect(sql).toContain("and a.subject_ar is null");
  });
});

describe("copyForLocale", () => {
  const full = {
    subject: "English",
    body: "<p>English</p>",
    subjectAr: "عربي",
    bodyAr: "<p>عربي</p>",
    format: "html" as const,
  };

  it("answers an Arabic lead in Arabic when both halves are written", () => {
    expect(copyForLocale(full, "ar")).toEqual({
      subject: "عربي",
      body: "<p>عربي</p>",
      locale: "ar",
    });
  });

  it("answers in English when there is no Arabic", () => {
    const out = copyForLocale({ ...full, subjectAr: null, bodyAr: null }, "ar");
    expect(out).toEqual({ subject: "English", body: "<p>English</p>", locale: "en" });
  });

  it("refuses to send half a translation", () => {
    // A subject in one language over a body in the other is not an email.
    expect(copyForLocale({ ...full, bodyAr: "   " }, "ar").locale).toBe("en");
    expect(copyForLocale({ ...full, subjectAr: "" }, "ar").locale).toBe("en");
  });

  it("never gives an English lead the Arabic", () => {
    expect(copyForLocale(full, "en").locale).toBe("en");
  });
});

describe("an Arabic email, rendered", () => {
  const ctx = {
    values: { lead_first_name: "أميرة", enquiry_message: "هل العقار متاح؟" },
  };
  const copy = {
    subject: "مرحباً {{lead_first_name}}",
    body: "<p>مرحباً {{lead_first_name}}</p><ul><li><p>واحد</p></li></ul><blockquote><p>{{enquiry_message}}</p></blockquote>",
    subjectAr: "مرحباً {{lead_first_name}}",
    bodyAr:
      "<p>مرحباً {{lead_first_name}}</p><ul><li><p>واحد</p></li></ul><blockquote><p>{{enquiry_message}}</p></blockquote>",
    format: "html" as const,
  };

  it("reads right to left, and says so where inboxes look", () => {
    const out = renderSystemEmail(copy, ctx, DEFAULT_EMAIL_BRAND, "ar");
    expect(out.html).toContain('<html dir="rtl" lang="ar">');
    // Outlook.com strips the attribute off <html>, so the body and the table
    // carry it too.
    expect(out.html).toContain('<body dir="rtl"');
    expect(out.html).toContain('<table role="presentation" dir="rtl"');
  });

  it("indents lists and quotes from the right", () => {
    const out = renderSystemEmail(copy, ctx, DEFAULT_EMAIL_BRAND, "ar");
    expect(out.html).toContain("padding-right:22px");
    expect(out.html).toContain("border-right:3px solid");
    expect(out.html).not.toContain("padding-left:22px");
  });

  it("asks for a font the machine already has", () => {
    const out = renderSystemEmail(copy, ctx, DEFAULT_EMAIL_BRAND, "ar");
    expect(out.html).toContain("Tahoma");
  });

  it("wears the Arabic wordmark and footer", () => {
    const out = renderSystemEmail(copy, ctx, DEFAULT_EMAIL_BRAND, "ar");
    expect(out.html).toContain("بازار");
    expect(out.html).toContain("رقم التسجيل");
  });

  it("stays left to right for an English lead", () => {
    const out = renderSystemEmail(copy, ctx, DEFAULT_EMAIL_BRAND, "en");
    expect(out.html).toContain('<html dir="ltr" lang="en">');
    expect(out.html).toContain("padding-left:22px");
  });
});

describe("token fallbacks", () => {
  it("fall back in the language being sent", () => {
    // Nobody left their name: the greeting still has to read as Arabic.
    expect(renderTokens("مرحباً {{lead_first_name}}", {}, "ar")).toBe("مرحباً عزيزنا");
    expect(renderTokens("Hello {{lead_first_name}}", {}, "en")).toBe("Hello there");
  });

  it("never translate the value itself", () => {
    // A lead's name, a reference and a figure are the same in both languages.
    expect(renderTokens("{{lead_name}}", { lead_name: "Amira Haddad" }, "ar")).toBe(
      "Amira Haddad",
    );
  });

  it("give every Arabic fallback to a token that has an English one", () => {
    for (const t of TOKENS) {
      if (!t.fallback.trim()) continue;
      expect(t.fallbackAr?.trim() || t.fallback, t.name).toBeTruthy();
    }
  });
});
