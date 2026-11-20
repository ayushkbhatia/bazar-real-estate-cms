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
  title: "Abu Dhabi Landlord Guide: Property Management",
  description:
    "What property management covers, why it matters in Abu Dhabi's regulated market, and how it protects your income and your property.",
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
    alternates: localeAlternates("/guides/property-management", locale),
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
  { key: "propertyManagement", copy: true },
  { key: "whyPropertyManagementMatters", copy: true },
  { key: "keyPropertyManagementServices", copy: true },
  { key: "landlordsPrepare", bullets: ["titleDeedProof", "emiratesIdPassport", "powerAttorneyIf", "existingTenancyContract", "tenantContactDetails", "propertyKeysAccess", "parkingDetailsFloor", "maintenanceHistoryService", "utilityCommunityManagement"] },
  { key: "benefitsPropertyManagement", checklist: ["saveTimeReduce", "improveCommunication", "keepPropertyWell", "trackRentPayments", "reduceVacancyPeriods", "protectConditionProperty", "manageRenewalsDocumentation", "supportLandlordsLiving"] },
  { key: "finalTip", copy: true },
];

export default async function PropertyManagementPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "guides" });
  return (
    <GuideShell
      faqKey="guide-property-management"
      locale={locale}
      eyebrow={t("propertyManagement.eyebrow")}
      title={t("propertyManagement.title")}
      intro={t("propertyManagement.intro")}
      body={[
        ...BLOCKS.map((b) => ({
          heading: t(`propertyManagement.block.${b.key}.heading`),
          ...(b.copy ? { copy: t(`propertyManagement.block.${b.key}.copy`) } : {}),
          ...(b.bullets
            ? {
                bullets: b.bullets.map((i) =>
                  t(`propertyManagement.block.${b.key}.bullets.${i}`),
                ),
              }
            : {}),
          ...(b.checklist
            ? {
                checklist: b.checklist.map((i) =>
                  t(`propertyManagement.block.${b.key}.checklist.${i}`),
                ),
              }
            : {}),
        })),
      ]}
    />
  );
}
