import type { Metadata } from "next";
import { localiseMetadata } from "@/lib/i18n/localise-metadata";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/lib/i18n/locales";
import { GuideShell } from "../_components/guide-shell";
import { localeAlternates } from "@/lib/i18n/metadata";

/**
 * Hourly, because the page-FAQ at the foot is a database document
 * (/admin/pages/sub/faq). A save revalidates on demand; this catches writes
 * that bypass the editor.
 */
export const revalidate = 3600;

const METADATA: Metadata = {
  title: "KYC for non-resident property buyers in the UAE",
  description:
    "The KYC and AML documentation non-resident buyers should expect when buying property in Abu Dhabi — source of funds, banking, and the DARI transfer.",
};

/** English as written above; Arabic from the site's store on /ar. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  return {
    ...localiseMetadata(METADATA, locale),
    alternates: localeAlternates("/guides/kyc-non-residents", locale),
  };
}

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
      faqKey="guide-kyc-non-residents"
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
