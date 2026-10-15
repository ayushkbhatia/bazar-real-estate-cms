import { afterAll, beforeAll, describe, it, vi } from "vitest";
import { expectFolds } from "@/lib/i18n/fold-harness";
import type { Locale } from "@/lib/i18n/locales";
import { DEFAULT_EMAIL_BRAND } from "@/lib/content-assets/email-brand";
import { renderNewsletter } from "./campaign";

/**
 * The fold proof for `newsletter_campaigns.subject` / `.preheader` / `.body`.
 *
 * Like content_assets, the "reader" is the send path, and the locale it folds
 * to is the SUBSCRIBER's (`newsletter_subscribers.locale`, carried on each
 * delivery), not a request's. So the proof runs the real renderer at both
 * locales and asserts on the message it produces.
 */

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://bazar.example");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const ROW = {
  subject: "October on Saadiyat",
  preheader: "Three launches worth a look",
  body: "<p>Three new launches this month.</p>",
  subject_ar: "أكتوبر في السعديات",
  preheader_ar: "ثلاثة مشاريع جديدة",
  body_ar: "<p>ثلاثة مشاريع جديدة هذا الشهر.</p>",
};

const render = (locale: Locale) =>
  renderNewsletter(ROW, {
    brand: DEFAULT_EMAIL_BRAND,
    locale: locale === "ar" ? "ar" : "en",
    unsubscribeUrl: "https://bazar.example/newsletter/unsubscribe/x",
  });

describe("the send path folds newsletter_campaigns to the subscriber's locale", () => {
  it("picks the subject of the subscriber's language", async () => {
    await expectFolds({
      read: render,
      pick: (email) => email.subject,
      english: ROW.subject,
      arabic: ROW.subject_ar,
      what: "newsletter_campaigns.subject",
    });
  });

  it("picks the preview line of the subscriber's language", async () => {
    await expectFolds({
      read: render,
      pick: (email) => (email.html.includes(ROW.preheader_ar) ? ROW.preheader_ar : email.html.includes(ROW.preheader) ? ROW.preheader : ""),
      english: ROW.preheader,
      arabic: ROW.preheader_ar,
      what: "newsletter_campaigns.preheader",
    });
  });

  it("picks the body of the subscriber's language", async () => {
    await expectFolds({
      read: render,
      pick: (email) => email.text.split("\n")[0]!.trim(),
      english: "Three new launches this month.",
      arabic: "ثلاثة مشاريع جديدة هذا الشهر.",
      what: "newsletter_campaigns.body",
    });
  });
});
