import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/lib/i18n/locales";
import { GuideShell } from "../_components/guide-shell";
import { TaxResidencyChecker } from "./_checker";

export const metadata: Metadata = {
  title: "UAE Tax Residency Certificate — 2026 eligibility",
  description:
    "The criteria for obtaining a UAE Tax Residency Certificate — physical-presence test, primary-residence rules, and what the certificate actually does (and doesn't) cover.",
  alternates: { canonical: "/guides/tax-residency" },
};

/**
 * Body blocks, in order, each naming its own message subtree.
 *
 * Named rather than indexed so reordering the page cannot silently
 * repoint a translation at the wrong paragraph.
 */
const BLOCKS: readonly {
  key: string;
  copy?: true;
  bullets?: readonly string[];
  checklist?: readonly string[];
}[] = [
  { key: "certificateDoes", copy: true },
  { key: "twoRoutesQualify", copy: true },
  { key: "doesntFix", copy: true },
];

export default async function TaxResidencyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "guides" });
  return (
    <GuideShell
      locale={locale}
      eyebrow={t("taxResidency.eyebrow")}
      title={t("taxResidency.title")}
      intro={t("taxResidency.intro")}
      body={[
        ...BLOCKS.map((b) => ({
          heading: t(`taxResidency.block.${b.key}.heading`),
          ...(b.copy ? { copy: t(`taxResidency.block.${b.key}.copy`) } : {}),
          ...(b.bullets
            ? {
                bullets: b.bullets.map((i) =>
                  t(`taxResidency.block.${b.key}.bullets.${i}`),
                ),
              }
            : {}),
          ...(b.checklist
            ? {
                checklist: b.checklist.map((i) =>
                  t(`taxResidency.block.${b.key}.checklist.${i}`),
                ),
              }
            : {}),
        })),
      ]}
    >
      <TaxResidencyChecker />
    </GuideShell>
  );
}
