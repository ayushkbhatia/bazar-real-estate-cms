import { describe, expect, it } from "vitest";
import { DEFAULT_EMAIL_BRAND } from "@/lib/content-assets/email-brand";
import {
  campaignProblems,
  hasArabicEdition,
  isBlankBody,
  renderNewsletter,
  unsubscribeHeaders,
  unsubscribeLinks,
  type CampaignDraft,
} from "./campaign";

const draft = (over: Partial<CampaignDraft> = {}): CampaignDraft => ({
  subject: "October in Abu Dhabi",
  preheader: "Three new launches on Saadiyat",
  body: "<p>Hello from Bazar.</p>",
  subject_ar: "",
  preheader_ar: "",
  body_ar: "",
  audience: "all",
  ...over,
});

const opts = (locale: "en" | "ar") => ({
  brand: DEFAULT_EMAIL_BRAND,
  locale,
  unsubscribeUrl: "https://www.bazarrealestate.ae/newsletter/unsubscribe/abc123",
});

describe("renderNewsletter", () => {
  it("always ends with the recipient's own unsubscribe link, in the HTML and the text", () => {
    const email = renderNewsletter(draft(), opts("en"));
    expect(email.subject).toBe("October in Abu Dhabi");
    expect(email.html).toContain("Hello from Bazar.");
    expect(email.html).toContain('href="https://www.bazarrealestate.ae/newsletter/unsubscribe/abc123"');
    expect(email.html).toContain("Unsubscribe");
    expect(email.text).toContain("https://www.bazarrealestate.ae/newsletter/unsubscribe/abc123");
  });

  it("hides the preview line right after <body>", () => {
    const html = renderNewsletter(draft(), opts("en")).html;
    const body = html.indexOf("<body");
    const hidden = html.indexOf("display:none", body);
    expect(hidden).toBeGreaterThan(body);
    expect(html.slice(hidden, hidden + 200)).toContain("Three new launches on Saadiyat");
  });

  it("sends the Arabic edition, right to left, to an Arabic subscriber when it's written", () => {
    const email = renderNewsletter(
      draft({ subject_ar: "أكتوبر في أبوظبي", body_ar: "<p>مرحباً من بازار.</p>" }),
      opts("ar"),
    );
    expect(email.locale).toBe("ar");
    expect(email.subject).toBe("أكتوبر في أبوظبي");
    expect(email.html).toContain('dir="rtl"');
    expect(email.html).toContain("إلغاء الاشتراك");
  });

  it("falls back to the English for an Arabic subscriber when the Arabic edition is blank or half-written", () => {
    expect(renderNewsletter(draft(), opts("ar")).locale).toBe("en");
    expect(renderNewsletter(draft({ subject_ar: "أكتوبر" }), opts("ar")).locale).toBe("en");
    expect(renderNewsletter(draft({ subject_ar: "أكتوبر", body_ar: "<p></p>" }), opts("ar")).subject).toBe(
      "October in Abu Dhabi",
    );
  });

  it("fills the site links a newsletter may use", () => {
    const html = renderNewsletter(
      draft({ body: '<p><a href="{{insights_url}}">Read more</a></p>' }),
      opts("en"),
    ).html;
    expect(html).toContain('href="https://www.bazarrealestate.ae/insights"');
  });
});

describe("campaignProblems", () => {
  it("passes a complete English newsletter", () => {
    expect(campaignProblems(draft())).toEqual({});
  });

  it("asks for a subject and a body", () => {
    const p = campaignProblems(draft({ subject: " ", body: "<p></p>" }));
    expect(p.subject).toBeTruthy();
    expect(p.body).toBeTruthy();
  });

  it("refuses a half-written Arabic edition, either half", () => {
    expect(campaignProblems(draft({ subject_ar: "أكتوبر" })).body_ar).toBeTruthy();
    expect(campaignProblems(draft({ body_ar: "<p>نص</p>" })).subject_ar).toBeTruthy();
  });

  it("refuses an Arabic-only audience with no Arabic edition", () => {
    expect(campaignProblems(draft({ audience: "ar" })).audience).toBeTruthy();
  });

  it("refuses fields a newsletter can't fill", () => {
    expect(campaignProblems(draft({ body: "<p>Hi {{first_name}}</p>" })).body).toContain("{{first_name}}");
    expect(campaignProblems(draft({ subject: "{{nonsense}}" })).subject).toContain("{{nonsense}}");
  });
});

describe("helpers", () => {
  it("treats TipTap's empty document as blank, and an image as content", () => {
    expect(isBlankBody("<p></p>")).toBe(true);
    expect(isBlankBody("<p>&nbsp;</p>")).toBe(true);
    expect(isBlankBody('<p><img src="x.png"></p>')).toBe(false);
    expect(hasArabicEdition({ subject_ar: "x", body_ar: "<p>y</p>" })).toBe(true);
  });

  it("gives every message one-click unsubscribe headers (RFC 8058)", () => {
    const h = unsubscribeHeaders("abc123", "ar");
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(h["List-Unsubscribe"]).toContain("/api/newsletter/unsubscribe?token=abc123");
    expect(h["List-Unsubscribe"]).toContain("/ar/newsletter/unsubscribe/abc123");
    expect(unsubscribeLinks("abc123", "en").page).not.toContain("/ar/");
  });
});
