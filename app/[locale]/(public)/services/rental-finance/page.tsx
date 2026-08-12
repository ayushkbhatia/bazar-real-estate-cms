import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSeedServiceBySlug } from "@/lib/seeds/services";
import { ServicePage } from "../_components/service-page";

const service = getSeedServiceBySlug("rental-finance");

export const metadata: Metadata = {
  title: service ? service.name : "Rental finance management",
  description: service?.one_liner,
};

export default function ServicesRentalFinancePage() {
  if (!service) notFound();
  return <ServicePage service={service} />;
}
