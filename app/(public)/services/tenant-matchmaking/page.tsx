import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSeedServiceBySlug } from "@/lib/seeds/services";
import { ServicePage } from "../_components/service-page";

const service = getSeedServiceBySlug("tenant-matchmaking");

export const metadata: Metadata = {
  title: service ? service.name : "Tenant matchmaking",
  description: service?.one_liner,
};

export default function ServicesTenantMatchmakingPage() {
  if (!service) notFound();
  return <ServicePage service={service} />;
}
