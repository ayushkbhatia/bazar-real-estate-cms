import type { Metadata } from "next";
import { GuideShell } from "../_components/guide-shell";

export const metadata: Metadata = {
  title: "Abu Dhabi Landlord Guide: Property Management",
  description:
    "What property management covers, why it matters in Abu Dhabi's regulated market, and how it protects your income and your property.",
  alternates: { canonical: "/guides/property-management" },
};

export default function PropertyManagementGuide() {
  return (
    <GuideShell
      eyebrow="Guide for Landlords · 7 min read"
      title="Abu Dhabi Landlord Guide: Property Management"
      intro="Owning a rental in Abu Dhabi is a strong long-term investment — but managing it well takes time, market knowledge, and consistent follow-up. Property management protects the landlord's asset, maintains the property's value, supports the tenant, and keeps every rental process organised."
      body={[
        {
          heading: "What is property management?",
          copy: "Property management is the ongoing management of a rental property on behalf of the owner. It can include tenant communication, rent collection, maintenance coordination, inspections, lease renewals, documentation, and support with move-in and move-out. For landlords living outside the UAE or short on time, it reduces stress and keeps the property professionally maintained.",
        },
        {
          heading: "Why property management matters in Abu Dhabi",
          copy: "Abu Dhabi's rental market is regulated, and landlords must manage contracts, tenant records, maintenance, renewals, and official lease registration correctly. Tenancy contracts are registered through Tawtheeq using the DARI digital ecosystem. A management service keeps important tasks — tenant follow-ups, rent collection, maintenance, renewals, and handover — handled on time.",
        },
        {
          heading: "Key property management services",
          copy: "Tenant management: the manager acts as the main point of contact between landlord and tenant. Rent collection: tracking payments, following up on dues, and updating the landlord. Maintenance coordination: contacting approved providers, arranging access, and following up until resolved — landlord and tenant repair responsibilities are addressed under Abu Dhabi's lease regulations, including Law No. 20 of 2006. Property inspections: monitoring condition before move-in, during the tenancy, and before move-out. Lease renewal support: tracking expiry dates and coordinating renewals through DARI — as of ADREC's announcement dated 3 June 2026, all residential, commercial, and industrial tenancy renewals are processed at a 0% increase for the duration of the temporary measure. Move-in and move-out coordination: key handover, access and parking cards, permits, and final condition reports. Documentation and compliance: organising contracts, ID copies, receipts, Tawtheeq records, and invoices — DARI also allows property management agreements to be registered, renewed, amended, or cancelled.",
        },
        {
          heading: "What landlords should prepare",
          bullets: [
            "Title deed or proof of ownership",
            "Emirates ID and passport copy",
            "Power of attorney, if applicable",
            "Existing tenancy contract, if rented",
            "Tenant contact details, if applicable",
            "Property keys and access cards",
            "Parking details and floor plan",
            "Maintenance history and service-charge information",
            "Utility and community management details",
          ],
        },
        {
          heading: "Benefits of property management",
          checklist: [
            "Save time and reduce tenant-related stress",
            "Improve communication",
            "Keep the property well maintained",
            "Track rent payments more efficiently",
            "Reduce vacancy periods",
            "Protect the condition of the property",
            "Manage renewals and documentation",
            "Support landlords living outside the UAE",
          ],
        },
        {
          heading: "Final tip",
          copy: "Property management is not only about collecting rent — it's about protecting your asset, maintaining value, supporting the tenant, and keeping every process organised.",
        },
      ]}
    />
  );
}
