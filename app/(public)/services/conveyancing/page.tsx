import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSeedServiceBySlug } from "@/lib/seeds/services";
import { ServicePage } from "../_components/service-page";

const service = getSeedServiceBySlug("conveyancing");

export const metadata: Metadata = {
  title: service ? service.name : "Conveyancing",
  description: service?.one_liner,
};

export default function ServicesConveyancingPage() {
  if (!service) notFound();
  return <ServicePage service={service} />;
}
