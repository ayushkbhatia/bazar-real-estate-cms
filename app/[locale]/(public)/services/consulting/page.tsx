import { asLocale } from "@/lib/i18n/locales";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServicePage } from "../_components/service-page";
import { getSeedServiceBySlug } from "@/lib/seeds/services";

const slug = "consulting" as const;

export async function generateMetadata(): Promise<Metadata> {
  const s = getSeedServiceBySlug(slug);
  if (!s) return { title: "Service not found" };
  return {
    title: s.name,
    description: s.one_liner,
    alternates: { canonical: `/services/${slug}` },
  };
}

export default async function ConsultingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // `ServicePage` reads its copy through `getTranslations`, which needs the
  // request locale set. Without it the route drops out of the CDN — which is
  // exactly what `check:routes` caught.
  setRequestLocale(asLocale((await params).locale));

  const service = getSeedServiceBySlug(slug);
  if (!service) notFound();
  return <ServicePage service={service} />;
}
