import { asLocale } from "@/lib/i18n/locales";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSeedServiceBySlug } from "@/lib/seeds/services";
import { ServicePage } from "../_components/service-page";

const service = getSeedServiceBySlug("rental-finance");

export const metadata: Metadata = {
  title: service ? service.name : "Rental finance management",
  description: service?.one_liner,
};

export default async function ServicesRentalFinancePage({
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
