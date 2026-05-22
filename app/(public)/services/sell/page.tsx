import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSeedServiceBySlug } from "@/lib/seeds/services";
import { ServicePage } from "../_components/service-page";

const service = getSeedServiceBySlug("sell");

export const metadata: Metadata = {
  title: service ? service.name : "Sell with Bazar",
  description: service?.one_liner,
};

export default function ServicesSellPage() {
  if (!service) notFound();
  return <ServicePage service={service} />;
}
