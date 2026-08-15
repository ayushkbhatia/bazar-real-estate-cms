import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/lib/i18n/locales";
import { GuideShell } from "../_components/guide-shell";

export const metadata: Metadata = {
  title: "How to Rent Out Your Property in Abu Dhabi",
  description:
    "Prepare, price, list, screen tenants, agree terms, sign, register Tawtheeq, and hand over — the complete Abu Dhabi landlord journey.",
  alternates: { canonical: "/guides/how-to-rent-out" },
};

/** Step order. The key names the message; the array is the page. */
const STEPS = [
  "preparePropertyRent",
  "setRightRentalPrice",
  "listPropertyProfessionally",
  "workLicensedAgent",
  "screenQualifyTenants",
  "agreeRentalTerms",
  "signRegisterTenancyContract",
  "understandMunicipalityFees",
  "completeHandover",
  "manageTenancy",
  "renewingEndingTenancy",
] as const;

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
  { key: "landlordChecklist", checklist: ["prepareInspectProperty", "completeMaintenanceListing", "setRightRental", "takeProfessionalPhotos", "createAccurateListing", "workLicensedAgent", "screenTenantDocuments", "agreeRentTerms", "signTenancyContract", "registerThroughTawtheeq", "completeKeyAccess", "keepPaymentReceipts", "trackRentPayments"] },
  { key: "documentsRequiredListProperty", copy: true },
  { key: "finalTip", copy: true },
];

export default async function HowToRentOutPage({
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
      eyebrow={t("howToRentOut.eyebrow")}
      title={t("howToRentOut.title")}
      intro={t("howToRentOut.intro")}
      body={[
        ...STEPS.map((key, i) => ({
          heading: t("stepNumbered", {
            n: i + 1,
            title: t(`howToRentOut.step.${key}.title`),
          }),
          copy: t(`howToRentOut.step.${key}.copy`),
        })),
        ...BLOCKS.map((b) => ({
          heading: t(`howToRentOut.block.${b.key}.heading`),
          ...(b.copy ? { copy: t(`howToRentOut.block.${b.key}.copy`) } : {}),
          ...(b.bullets
            ? {
                bullets: b.bullets.map((i) =>
                  t(`howToRentOut.block.${b.key}.bullets.${i}`),
                ),
              }
            : {}),
          ...(b.checklist
            ? {
                checklist: b.checklist.map((i) =>
                  t(`howToRentOut.block.${b.key}.checklist.${i}`),
                ),
              }
            : {}),
        })),
      ]}
    />
  );
}
