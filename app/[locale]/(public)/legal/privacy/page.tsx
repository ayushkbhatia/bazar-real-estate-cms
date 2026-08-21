import type { Metadata } from "next";

import { LegalDocument } from "../_document";
import { masterPageMetadata } from "@/lib/queries/search-appearance";
import { localeAlternates } from "@/lib/i18n/metadata";
import { localeSwitchHref } from "@/lib/i18n/routing";
import { asLocale } from "@/lib/i18n/locales";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // CMS-owned: Pages & blocks -> Privacy policy -> Search appearance.
  // Unedited, it falls back to MASTER_PAGE_SEO_DEFAULTS, whose Arabic comes
  // from the shared store — the two entries there are marked `human`, because
  // they are the client's own wording rather than a machine draft.
  return masterPageMetadata("legal-privacy", asLocale(locale), {
    alternates: localeAlternates("/legal/privacy", asLocale(locale)),
  });
}

/**
 * The privacy policy — the client's final bilingual text, now editable.
 *
 * It was 268 lines of English JSX plus a 243-line Arabic sibling, and it was
 * the last public page on the site with no CMS surface at all. Both languages
 * moved verbatim into `lib/master-pages/sections/legal-privacy.ts`; see that
 * file for why the Arabic is hand-declared there rather than generated.
 *
 * Where the policy and the product disagree (it names Salesforce as the CRM;
 * it is silent on the AI concierge, newsletter and valuation tools), the
 * policy is still the client's to change — the difference is that they can now
 * change it themselves instead of asking for a deploy.
 */
export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = asLocale(raw);
  const other = locale === "ar" ? "en" : "ar";

  return (
    <LegalDocument
      pageKey="legal-privacy"
      active="privacy"
      locale={locale}
      // Privacy is the only one of the three with a translation a reader is
      // invited to switch to: terms and cookies carry the machine first draft
      // (ADR-0008), this one carries the client's own Arabic.
      translation={{
        label: other === "ar" ? "العربية" : "English",
        href: localeSwitchHref("/legal/privacy", "", other),
        locale: other,
      }}
    />
  );
}
