import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSeedServiceBySlug } from "@/lib/seeds/services";
import { ServicePage } from "../_components/service-page";

const service = getSeedServiceBySlug("invest");

export const metadata: Metadata = {
  title: service ? service.name : "Investment advisory",
  description: service?.one_liner,
};

export default function ServicesInvestPage() {
  if (!service) notFound();
  return <ServicePage service={service} />;
}
