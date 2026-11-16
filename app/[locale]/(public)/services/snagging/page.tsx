import { asLocale } from "@/lib/i18n/locales";
import { localeAlternates } from "@/lib/i18n/metadata";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServicePage } from "../_components/service-page";
import { getSeedServiceBySlug } from "@/lib/seeds/services";

const slug = "snagging" as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const s = getSeedServiceBySlug(slug);
  if (!s) return { title: "Service not found" };
  return {
    title: s.name,
    description: s.one_liner,
    alternates: localeAlternates(`/services/${slug}`, locale),
  };
}

export default async function SnaggingPage({
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
