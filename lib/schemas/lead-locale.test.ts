/**
 * The locale a visitor submitted in reaches the row.
 *
 * Migration 0100 added `locale` to `enquiries`, `newsletter_subscribers` and
 * `reviews`, and nothing ever wrote it — so every lead read `en`, Arabic ones
 * included. Its own docblock is the reason this has a test rather than a
 * follow-up: it calls the column "the one part of the i18n epic that is NOT
 * retro-fittable". A lead's language cannot be inferred after the fact, so an
 * unrecorded day is lost permanently.
 *
 * The value is threaded from the client rather than read in the action. That
 * is deliberate and it is what these tests pin: `currentLocale()` CATCHES a
 * missing request scope and returns English, so an ambient read in a server
 * action where `getLocale()` does not resolve would record `en` for an Arabic
 * lead and report nothing — indistinguishable from the bug being fixed.
 */
import { describe, expect, it } from "vitest";

import { enquirySchema } from "./enquiry";
import { newsletterSignupSchema } from "./newsletter";

describe("lead locale", () => {
  const lead = {
    name: "زائر",
    email: "visitor@example.com",
    message: "أرغب في معرفة المزيد عن هذا العقار.",
    source: "contact_page",
  };

  it("keeps the Arabic a visitor submitted in", () => {
    const parsed = enquirySchema.safeParse({ ...lead, locale: "ar" });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.locale).toBe("ar");
  });

  it("defaults to English when the form did not say", () => {
    // Every caller that predates this, and any that forgets.
    const parsed = enquirySchema.safeParse(lead);
    expect(parsed.success && parsed.data.locale).toBe("en");
  });

  it("rejects a locale the column's check constraint would refuse", () => {
    // `check (locale in ('en','ar'))`. Catching it here turns a lost lead into
    // a field error.
    expect(enquirySchema.safeParse({ ...lead, locale: "ar-AE" }).success).toBe(
      false,
    );
    expect(enquirySchema.safeParse({ ...lead, locale: "AR" }).success).toBe(
      false,
    );
  });

  it("carries the same contract on the newsletter", () => {
    const signup = { email: "visitor@example.com" };
    expect(
      newsletterSignupSchema.safeParse({ ...signup, locale: "ar" }).success &&
        newsletterSignupSchema.parse({ ...signup, locale: "ar" }).locale,
    ).toBe("ar");
    expect(newsletterSignupSchema.parse(signup).locale).toBe("en");
    expect(
      newsletterSignupSchema.safeParse({ ...signup, locale: "fr" }).success,
    ).toBe(false);
  });
});
