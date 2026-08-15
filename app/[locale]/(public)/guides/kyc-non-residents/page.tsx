import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/lib/i18n/locales";
import { GuideShell } from "../_components/guide-shell";

export const metadata: Metadata = {
  title: "KYC for non-resident property buyers in the UAE",
  description:
    "The KYC and AML documentation non-resident buyers should expect when acquiring UAE property — source of funds, banking, and the DLD transfer process.",
  alternates: { canonical: "/guides/kyc-non-residents" },
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
  { key: "identity", copy: true },
  { key: "address", copy: true },
  { key: "sourceFunds", copy: true },
  { key: "banking", copy: true },
  { key: "ifYoullLetProperty", copy: true },
];

export default async function KycNonResidentsPage({
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
      eyebrow={t("kycNonResidents.eyebrow")}
      title={t("kycNonResidents.title")}
      intro={t("kycNonResidents.intro")}
      body={[
        ...BLOCKS.map((b) => ({
          heading: t(`kycNonResidents.block.${b.key}.heading`),
          ...(b.copy ? { copy: t(`kycNonResidents.block.${b.key}.copy`) } : {}),
          ...(b.bullets
            ? {
                bullets: b.bullets.map((i) =>
                  t(`kycNonResidents.block.${b.key}.bullets.${i}`),
                ),
              }
            : {}),
          ...(b.checklist
            ? {
                checklist: b.checklist.map((i) =>
                  t(`kycNonResidents.block.${b.key}.checklist.${i}`),
                ),
              }
            : {}),
        })),
      ]}
    />
  );
}
