import { asLocale } from "@/lib/i18n/locales";
import { localeAlternates } from "@/lib/i18n/metadata";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSeedServiceBySlug } from "@/lib/seeds/services";
import { ServicePage } from "../_components/service-page";

/**
 * Hourly, because the page-FAQ at the foot is a database document
 * (/admin/pages/sub/faq). A save revalidates on demand; this catches writes
 * that bypass the editor.
 */
export const revalidate = 3600;

const service = getSeedServiceBySlug("sales-leasing");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  return {
    title: service ? service.name : "Sales & leasing",
    description: service?.one_liner,
    alternates: localeAlternates("/services/sales-leasing", locale),
  };
}

export default async function ServicesSalesLeasingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // `ServicePage` reads its copy through `getTranslations`, which needs the
  // request locale set. Without it the route drops out of the CDN — which is
  // exactly what `check:routes` caught.
  setRequestLocale(asLocale((await params).locale));

  if (!service) notFound();
  return <ServicePage service={service} />;
}
