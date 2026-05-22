import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSeedServiceBySlug } from "@/lib/seeds/services";
import { ServicePage } from "../_components/service-page";

const service = getSeedServiceBySlug("buy");

export const metadata: Metadata = {
  title: service ? service.name : "Buy with Bazar",
  description: service?.one_liner,
};

export default function ServicesBuyPage() {
  if (!service) notFound();
  return <ServicePage service={service} />;
}
