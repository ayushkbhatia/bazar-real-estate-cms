import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServicePage } from "../_components/service-page";
import { getSeedServiceBySlug } from "@/lib/seeds/services";

const slug = "snagging" as const;

export async function generateMetadata(): Promise<Metadata> {
  const s = getSeedServiceBySlug(slug);
  if (!s) return { title: "Service not found" };
  return {
    title: s.name,
    description: s.one_liner,
    alternates: { canonical: `/services/${slug}` },
  };
}

export default function SnaggingPage() {
  const service = getSeedServiceBySlug(slug);
  if (!service) notFound();
  return <ServicePage service={service} />;
}
