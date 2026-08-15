import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/lib/i18n/locales";
import { GuideShell } from "../_components/guide-shell";
import { PropertyResidencyChecker } from "./_checker";

export const metadata: Metadata = {
  title: "Property-linked UAE residency — 2-year visa guide",
  description:
    "The AED 750K+ property route to a 2-year renewable UAE residency. Who qualifies, what the asset has to look like, and the realistic timeline.",
  alternates: { canonical: "/guides/property-linked-residency" },
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
  { key: "when2YearVisa", copy: true },
  { key: "doesntCover", copy: true },
  { key: "mortgageRules", copy: true },
];

export default async function PropertyLinkedResidencyPage({
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
      eyebrow={t("propertyLinkedResidency.eyebrow")}
      title={t("propertyLinkedResidency.title")}
      intro={t("propertyLinkedResidency.intro")}
      body={[
        ...BLOCKS.map((b) => ({
          heading: t(`propertyLinkedResidency.block.${b.key}.heading`),
          ...(b.copy ? { copy: t(`propertyLinkedResidency.block.${b.key}.copy`) } : {}),
          ...(b.bullets
            ? {
                bullets: b.bullets.map((i) =>
                  t(`propertyLinkedResidency.block.${b.key}.bullets.${i}`),
                ),
              }
            : {}),
          ...(b.checklist
            ? {
                checklist: b.checklist.map((i) =>
                  t(`propertyLinkedResidency.block.${b.key}.checklist.${i}`),
                ),
              }
            : {}),
        })),
      ]}
    >
      <PropertyResidencyChecker />
    </GuideShell>
  );
}
