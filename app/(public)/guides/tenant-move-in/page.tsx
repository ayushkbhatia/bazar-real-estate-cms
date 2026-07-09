import type { Metadata } from "next";
import { GuideShell } from "../_components/guide-shell";

export const metadata: Metadata = {
  title: "Abu Dhabi Tenant Move-In Guide",
  description:
    "From signing your tenancy contract to setting up utilities and completing your move-in checklist — prepare for a smooth move into your Abu Dhabi rental.",
  alternates: { canonical: "/guides/tenant-move-in" },
};

export default function TenantMoveInGuide() {
  return (
    <GuideShell
      eyebrow="Guide for Tenants · 7 min read"
      title="Abu Dhabi Tenant Move-In Guide"
      intro="Moving into a rental in Abu Dhabi is a straightforward process when you know the right steps — from signing your contract to setting up utilities and completing your move-in checklist. A successful move-in starts with proper documentation: get the contract, payments, and property condition recorded before you settle in."
      body={[
        {
          heading: "1. Confirm your tenancy contract",
          copy: "Before moving in, make sure your tenancy contract is signed by both landlord and tenant. In Abu Dhabi, tenancy contracts are registered through Tawtheeq, the official tenancy registration system. Lease registration can be managed online through the DARI platform, where the lessor enters the property details, tenant details, contract type, and premise information.",
        },
        {
          heading: "2. Check the property before handover",
          copy: "Before collecting the keys, inspect the property carefully — walls, flooring, doors, windows, kitchen, bathrooms, air conditioning, lighting, and water connections. It is also recommended to take photos or videos before moving in. This protects both tenant and landlord by clearly recording the property's condition at the start of the tenancy.",
        },
        {
          heading: "3. Confirm utilities and TAQA/ADDC account setup",
          copy: "For most tenants registered through Tawtheeq, the water and electricity account is set up automatically under the same name shown on the tenancy contract, with the first bill typically arriving within around one month. If the property is not covered by Tawtheeq or ADGM, you may need a separate move-in application — usually requiring a passport, Emirates ID, tenancy contract, and the previous account closing letter.",
        },
        {
          heading: "4. Understand Abu Dhabi municipality fees",
          copy: "Tenants renting in Abu Dhabi pay municipality fees in addition to water and electricity. When a contract is registered with Tawtheeq, the tenant is usually enrolled automatically. The fee is calculated at 5% of the rental value or rental index, whichever is higher, and is billed monthly through the utility bill. UAE Nationals are exempt for residential contracts intended for their own use.",
        },
        {
          heading: "5. Prepare move-in essentials",
          checklist: [
            "Signed tenancy contract",
            "Tawtheeq registration confirmation, if available",
            "Emirates ID and passport copy",
            "Utility account details",
            "Building or community access cards",
            "Parking access, if included",
            "Move-in permit, if required",
            "Maintenance contact details",
            "Key handover confirmation",
          ],
        },
        {
          heading: "6. Check building and community rules",
          copy: "Some buildings and communities require move-in approval before bringing furniture or using the service elevator. Check with building or community management before scheduling movers — you may need to provide the tenancy contract, Emirates ID, mover details, and preferred move-in date.",
        },
        {
          heading: "7. After moving in",
          copy: "Keep a copy of all important documents: tenancy contract, payment receipts, Tawtheeq certificate, and utility account details. Confirm your name and contact details are correct on the tenancy record and utility account, and save emergency maintenance, security, and landlord or property-manager contacts.",
        },
        {
          heading: "Move-in checklist for Abu Dhabi tenants",
          checklist: [
            "Sign the tenancy contract",
            "Confirm Tawtheeq registration",
            "Pay rent, deposit, and agency fees as agreed",
            "Inspect the property before handover",
            "Take photos of the property condition",
            "Confirm utility account setup",
            "Check municipality fee charges",
            "Collect keys, access cards, and parking cards",
            "Arrange internet connection",
            "Confirm maintenance contacts",
            "Schedule movers with building approval",
            "Keep all receipts and documents safely",
          ],
        },
        {
          heading: "Final tip",
          copy: "Make sure your tenancy contract is clear, your payments are recorded, and your move-in condition is documented before you fully settle into your new Abu Dhabi home.",
        },
      ]}
    />
  );
}
