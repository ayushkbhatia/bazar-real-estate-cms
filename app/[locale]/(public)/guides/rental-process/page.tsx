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
  title: "The Abu Dhabi Rental Process, Step by Step",
  description:
    "From searching for the right home to signing the contract, registering Tawtheeq, and moving in — the complete Abu Dhabi tenant journey explained.",
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
    alternates: localeAlternates("/guides/rental-process", locale),
  };
}

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
      faqKey="guide-rental-process"
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
