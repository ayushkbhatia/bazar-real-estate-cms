import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/lib/i18n/locales";
import { GuideShell } from "../_components/guide-shell";

export const metadata: Metadata = {
  title: "The Abu Dhabi Rental Process, Step by Step",
  description:
    "From searching for the right home to signing the contract, registering Tawtheeq, and moving in — the complete Abu Dhabi tenant journey explained.",
  alternates: { canonical: "/guides/rental-process" },
};

/** Step order. The key names the message; the array is the page. */
const STEPS = [
  "setBudget",
  "chooseRightLocation",
  "viewCompareProperties",
  "makeOffer",
  "signTenancyContract",
  "registerTawtheeq",
  "setUpUtilities",
  "arrangeMoveApproval",
  "moveDocumentCondition",
  "understandRenewalEndTenancy",
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
  { key: "rentalProcessChecklist", checklist: ["setRentalBudget", "choosePreferredCommunity", "viewCompareProperties", "confirmRentPayment", "submitTenantDocuments", "signTenancyContract", "completeTawtheeqRegistration", "confirmWaterElectricity", "checkMunicipalityFee", "arrangeMoveApproval", "inspectPropertyMoving", "keepContractsReceipts"] },
  { key: "finalTip", copy: true },
];

export default async function RentalProcessPage({
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
      eyebrow={t("rentalProcess.eyebrow")}
      title={t("rentalProcess.title")}
      intro={t("rentalProcess.intro")}
      body={[
        ...STEPS.map((key, i) => ({
          heading: t("stepPrefixed", {
            n: i + 1,
            title: t(`rentalProcess.step.${key}.title`),
          }),
          copy: t(`rentalProcess.step.${key}.copy`),
        })),
        ...BLOCKS.map((b) => ({
          heading: t(`rentalProcess.block.${b.key}.heading`),
          ...(b.copy ? { copy: t(`rentalProcess.block.${b.key}.copy`) } : {}),
          ...(b.bullets
            ? {
                bullets: b.bullets.map((i) =>
                  t(`rentalProcess.block.${b.key}.bullets.${i}`),
                ),
              }
            : {}),
          ...(b.checklist
            ? {
                checklist: b.checklist.map((i) =>
                  t(`rentalProcess.block.${b.key}.checklist.${i}`),
                ),
              }
            : {}),
        })),
      ]}
    />
  );
}
