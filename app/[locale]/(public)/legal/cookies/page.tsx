import type { Metadata } from "next";

import { LegalDocument } from "../_document";
import { masterPageMetadata } from "@/lib/queries/search-appearance";
import { asLocale } from "@/lib/i18n/locales";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // CMS-owned: Pages & blocks -> this document -> Search appearance.
  // Unedited, it falls back to MASTER_PAGE_SEO_DEFAULTS, which holds the
  // strings that used to be the literal `export const metadata` here.
  return masterPageMetadata("legal-cookies", asLocale(locale), {
    alternates: { canonical: "/legal/cookies" },
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <LegalDocument pageKey="legal-cookies" active="cookies" locale={asLocale(locale)} />
  );
}
