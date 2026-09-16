import { describe, it, vi, beforeAll, afterAll } from "vitest";
import { expectFolds } from "@/lib/i18n/fold-harness";
import type { Locale } from "@/lib/i18n/locales";
import { DEFAULT_EMAIL_BRAND } from "./email-brand";
import { renderSystemEmail } from "./system-render";

/**
 * The fold proof for `content_assets.subject` / `.body`.
 *
 * This one is not a page: the "reader" is the send path, and the locale it
 * folds to is the LEAD's (`enquiries.locale`), not the request's. So the proof
 * runs the real renderer at both locales and asserts what lands in the
 * message — which is where a no-op fold would show up, exactly as it would on
 * a page.
 */

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://bazar.example");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const ROW = {
  subject: "We received your brief",
  body: "<p>Thank you for getting in touch with Bazar.</p>",
  subjectAr: "وصلنا طلبك",
  bodyAr: "<p>شكراً لتواصلك مع بازار.</p>",
  format: "html" as const,
};

const render = (locale: Locale) =>
  renderSystemEmail(ROW, { values: {} }, DEFAULT_EMAIL_BRAND, locale === "ar" ? "ar" : "en");

describe("the send path folds content_assets to the lead's locale", () => {
  it("picks the subject of the language the lead wrote in", async () => {
    await expectFolds({
      read: render,
      pick: (email) => email.subject,
      english: ROW.subject,
      arabic: ROW.subjectAr,
      what: "content_assets.subject",
    });
  });

  it("picks the body of the language the lead wrote in", async () => {
    await expectFolds({
      read: render,
      pick: (email) => email.text.trim(),
      english: "Thank you for getting in touch with Bazar.",
      arabic: "شكراً لتواصلك مع بازار.",
      what: "content_assets.body",
    });
  });
});
