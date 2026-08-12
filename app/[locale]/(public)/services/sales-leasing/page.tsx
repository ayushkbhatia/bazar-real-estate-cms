import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSeedServiceBySlug } from "@/lib/seeds/services";
import { ServicePage } from "../_components/service-page";

const service = getSeedServiceBySlug("sales-leasing");

export const metadata: Metadata = {
  title: service ? service.name : "Sales & leasing",
  description: service?.one_liner,
};

export default function ServicesSalesLeasingPage() {
  if (!service) notFound();
  return <ServicePage service={service} />;
}
