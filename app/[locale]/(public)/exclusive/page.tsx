import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { asLocale } from "@/lib/i18n/locales";
import { listExclusiveProperties } from "@/lib/queries/curated-listings";
import { CuratedGrid } from "../_components/curated-grid";

export const revalidate = 60;

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "pages.curated" });
  return {
    title: t("exclusive.metaTitle"),
    description: t("exclusive.metaDescription"),
    alternates: { canonical: "/exclusive" },
  };
}

export default async function ExclusivePage({ params }: Params) {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "pages.curated" });
  const rows = await listExclusiveProperties({ limit: 24 });
  return (
    <CuratedGrid
      eyebrow={t("exclusive.eyebrow")}
      title={t("exclusive.title")}
      intro={t("exclusive.intro")}
      rows={rows}
      browseAllHref="/buy/search"
      browseAllLabel={t("browseAll")}
      fallbackArea={t("fallbackArea")}
    />
  );
}
