import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { asLocale } from "@/lib/i18n/locales";
import { listNewThisWeek } from "@/lib/queries/curated-listings";
import { CuratedGrid } from "../_components/curated-grid";

export const revalidate = 60;

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "pages.curated" });
  return {
    title: t("newThisWeek.metaTitle"),
    description: t("newThisWeek.metaDescription"),
    alternates: { canonical: "/new-this-week" },
  };
}

export default async function NewThisWeekPage({ params }: Params) {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "pages.curated" });
  const rows = await listNewThisWeek({ limit: 24 });
  return (
    <CuratedGrid
      eyebrow={t("newThisWeek.eyebrow")}
      title={t("newThisWeek.title")}
      intro={t("newThisWeek.intro")}
      rows={rows}
      browseAllHref="/buy/search"
      browseAllLabel={t("browseAll")}
      fallbackArea={t("fallbackArea")}
    />
  );
}
