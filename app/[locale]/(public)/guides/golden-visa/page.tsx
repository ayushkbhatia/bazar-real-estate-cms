import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/lib/i18n/locales";
import { GuideShell } from "../_components/guide-shell";
import { GoldenVisaChecker } from "./_checker";

export const metadata: Metadata = {
  title: "UAE Golden Visa via property — 2026 guide",
  description:
    "A plain-English walk-through of the 10-year UAE Golden Visa for property buyers: thresholds, qualifying assets, dependants, the application timeline, and what Bazar's visa desk handles end-to-end.",
  alternates: { canonical: "/guides/golden-visa" },
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
  { key: "whoIts", copy: true },
  { key: "qualifyingProperty", copy: true },
  { key: "dependants", copy: true },
  { key: "timeline", copy: true },
];

export default async function GoldenVisaPage({
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
      eyebrow={t("goldenVisa.eyebrow")}
      title={t("goldenVisa.title")}
      intro={t("goldenVisa.intro")}
      body={[
        ...BLOCKS.map((b) => ({
          heading: t(`goldenVisa.block.${b.key}.heading`),
          ...(b.copy ? { copy: t(`goldenVisa.block.${b.key}.copy`) } : {}),
          ...(b.bullets
            ? {
                bullets: b.bullets.map((i) =>
                  t(`goldenVisa.block.${b.key}.bullets.${i}`),
                ),
              }
            : {}),
          ...(b.checklist
            ? {
                checklist: b.checklist.map((i) =>
                  t(`goldenVisa.block.${b.key}.checklist.${i}`),
                ),
              }
            : {}),
        })),
      ]}
    >
      <GoldenVisaChecker />
    </GuideShell>
  );
}
