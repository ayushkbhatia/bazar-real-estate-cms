import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { asLocale } from "@/lib/i18n/locales";
import { listPriceDrops } from "@/lib/queries/curated-listings";
import { CuratedGrid } from "../_components/curated-grid";

export const revalidate = 60;

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "pages.curated" });
  return {
    title: t("priceDrops.metaTitle"),
    description: t("priceDrops.metaDescription"),
    alternates: { canonical: "/price-drops" },
  };
}

export default async function PriceDropsPage({ params }: Params) {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "pages.curated" });
  const rows = await listPriceDrops({ limit: 24 });
  return (
    <CuratedGrid
      eyebrow={t("priceDrops.eyebrow")}
      title={t("priceDrops.title")}
      intro={t("priceDrops.intro")}
      rows={rows}
      browseAllHref="/buy/search"
      browseAllLabel={t("browseAll")}
      fallbackArea={t("fallbackArea")}
    />
  );
}
