import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/lib/i18n/locales";
import { GuideShell } from "../_components/guide-shell";

export const metadata: Metadata = {
  title: "Abu Dhabi Landlord Guide: Property Management",
  description:
    "What property management covers, why it matters in Abu Dhabi's regulated market, and how it protects your income and your property.",
  alternates: { canonical: "/guides/property-management" },
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
