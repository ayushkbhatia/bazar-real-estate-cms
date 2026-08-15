import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/lib/i18n/locales";
import { GuideShell } from "../_components/guide-shell";

export const metadata: Metadata = {
  title: "Required Documents for Renting in Abu Dhabi",
  description:
    "The identification, Tawtheeq, utility, and building-approval documents every Abu Dhabi tenant should prepare before signing and moving in.",
  alternates: { canonical: "/guides/required-documents" },
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
  { key: "basicTenantDocuments", copy: true, bullets: ["passportCopy", "uaeResidenceVisa", "emiratesIdCopy", "contactNumberEmail", "salaryCertificateEmployment", "recentBankStatement", "marriageCertificateIf"] },
  { key: "documentsTawtheeqRegistration", copy: true, bullets: ["signedTenancyContract", "tenantEmiratesId", "tenantPassportCopy", "tenantContactDetails", "propertyPremiseId", "landlordAuthorisedRepresentative", "propertyOwnershipUnit"] },
  { key: "documentsUtilityConnection", copy: true },
  { key: "documentsBuildingCommunityMove", copy: true },
  { key: "paymentDocumentsReceipts", checklist: ["securityDepositReceipt", "agencyCommissionReceipt", "rentPaymentProof", "chequeCopiesIf", "utilityDepositActivation", "anyMaintenanceMove"] },
  { key: "documentsCompanyTenants", copy: true },
  { key: "abuDhabiTenantDocument", checklist: ["passportCopy", "emiratesIdCopy", "uaeVisaCopy", "signedTenancyContract", "tawtheeqRegistrationConfirmation", "salaryCertificateEmployment", "securityDepositPayment", "utilityAccountDetails", "previousAccountClosing", "moveApprovalDocuments", "parkingAccessCard"] },
  { key: "finalTip", copy: true },
];

export default async function RequiredDocumentsPage({
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
      eyebrow={t("requiredDocuments.eyebrow")}
      title={t("requiredDocuments.title")}
      intro={t("requiredDocuments.intro")}
      body={[
        ...BLOCKS.map((b) => ({
          heading: t(`requiredDocuments.block.${b.key}.heading`),
          ...(b.copy ? { copy: t(`requiredDocuments.block.${b.key}.copy`) } : {}),
          ...(b.bullets
            ? {
                bullets: b.bullets.map((i) =>
                  t(`requiredDocuments.block.${b.key}.bullets.${i}`),
                ),
              }
            : {}),
          ...(b.checklist
            ? {
                checklist: b.checklist.map((i) =>
                  t(`requiredDocuments.block.${b.key}.checklist.${i}`),
                ),
              }
            : {}),
        })),
      ]}
    />
  );
}
