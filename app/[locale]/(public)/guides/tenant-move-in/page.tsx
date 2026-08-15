import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/lib/i18n/locales";
import { GuideShell } from "../_components/guide-shell";

export const metadata: Metadata = {
  title: "Abu Dhabi Tenant Move-In Guide",
  description:
    "From signing your tenancy contract to setting up utilities and completing your move-in checklist — prepare for a smooth move into your Abu Dhabi rental.",
  alternates: { canonical: "/guides/tenant-move-in" },
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
  { key: "confirmTenancyContract", copy: true },
  { key: "checkPropertyHandover", copy: true },
  { key: "confirmUtilitiesTaqaAddc", copy: true },
  { key: "understandAbuDhabiMunicipality", copy: true },
  { key: "prepareMoveEssentials", checklist: ["signedTenancyContract", "tawtheeqRegistrationConfirmation", "emiratesIdPassport", "utilityAccountDetails", "buildingCommunityAccess", "parkingAccessIf", "movePermitIf", "maintenanceContactDetails", "keyHandoverConfirmation"] },
  { key: "checkBuildingCommunityRules", copy: true },
  { key: "afterMoving", copy: true },
  { key: "moveChecklistAbuDhabi", checklist: ["signTenancyContract", "confirmTawtheeqRegistration", "payRentDeposit", "inspectPropertyHandover", "takePhotosProperty", "confirmUtilityAccount", "checkMunicipalityFee", "collectKeysAccess", "arrangeInternetConnection", "confirmMaintenanceContacts", "scheduleMoversBuilding", "keepReceiptsDocuments"] },
  { key: "finalTip", copy: true },
];

export default async function TenantMoveInPage({
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
      eyebrow={t("tenantMoveIn.eyebrow")}
      title={t("tenantMoveIn.title")}
      intro={t("tenantMoveIn.intro")}
      body={[
        ...BLOCKS.map((b) => ({
          heading: t(`tenantMoveIn.block.${b.key}.heading`),
          ...(b.copy ? { copy: t(`tenantMoveIn.block.${b.key}.copy`) } : {}),
          ...(b.bullets
            ? {
                bullets: b.bullets.map((i) =>
                  t(`tenantMoveIn.block.${b.key}.bullets.${i}`),
                ),
              }
            : {}),
          ...(b.checklist
            ? {
                checklist: b.checklist.map((i) =>
                  t(`tenantMoveIn.block.${b.key}.checklist.${i}`),
                ),
              }
            : {}),
        })),
      ]}
    />
  );
}
