import type { Metadata } from "next";
import { GuideShell } from "../_components/guide-shell";

export const metadata: Metadata = {
  title: "How to Rent Out Your Property in Abu Dhabi",
  description:
    "Prepare, price, list, screen tenants, agree terms, sign, register Tawtheeq, and hand over — the complete Abu Dhabi landlord journey.",
  alternates: { canonical: "/guides/how-to-rent-out" },
};

const STEPS: [string, string][] = [
  [
    "Prepare your property for rent",
    "Make sure it is clean, well maintained, and ready for viewings. Check air conditioning, plumbing, electrical fittings, appliances, bathroom fixtures, doors and locks, paint, flooring, lighting, and access cards. A well-presented property attracts better enquiries.",
  ],
  [
    "Set the right rental price",
    "Price too high and it sits vacant; too low and you lose income. Compare similar properties, building quality, size and layout, view and floor level, furnishing, parking, and recent rental activity in the area.",
  ],
  [
    "List the property professionally",
    "A strong listing is clear, accurate and attractive — property type, location, bedrooms and bathrooms, size, price, payment terms, availability, furnishing, parking, amenities, features, high-quality photos, and a floor plan where available.",
  ],
  [
    "Work with a licensed agent",
    "A licensed agent markets the property, arranges viewings, qualifies tenants, negotiates offers, and prepares documentation. If not otherwise agreed, lease brokerage commission may not exceed 5% of annual rent, and the broker cannot collect from both parties.",
  ],
  [
    "Screen and qualify tenants",
    "Confirm the tenant is serious, financially prepared, and able to provide documents — passport, Emirates ID, visa copy (if applicable), contact details, plus company details and trade licence for corporate tenants, and the agreed payment method.",
  ],
  [
    "Agree on rental terms",
    "Confirm annual rent, number of payments, security deposit, start and end dates, maintenance responsibility, furnishing, parking allocation, renewal terms, move-in date, and any special conditions before signing.",
  ],
  [
    "Sign and register the tenancy contract",
    "Contracts are registered through Tawtheeq. Via DARI, lessors start the online lease registration by selecting the property and entering contract, tenant, and premise details. A new lease registration costs AED 50; contracts over four years are charged at 1%.",
  ],
  [
    "Understand municipality fees",
    "TAQA Distribution collects the municipality fee on behalf of the DMT — 5% of the rental value or index, whichever is higher, billed monthly. Usually paid via the tenant's utility bill, but landlords should understand it as part of the tenant's cost.",
  ],
  [
    "Complete handover",
    "Provide keys, access and parking cards, remotes, community rules, maintenance contacts, utility information, move-in permit instructions, and a handover condition report. Photograph the condition before the tenant moves in.",
  ],
  [
    "Manage the tenancy",
    "Track rent payment dates, cheque status, maintenance requests, expiry date, renewal discussions, tenant communication, property condition, and required documents.",
  ],
  [
    "Renewing or ending the tenancy",
    "Renew through DARI (currently at a 0% increase under ADREC's 3 June 2026 measure). To close an expired tenancy, the landlord submits a close-tenancy request via DARI, which the tenant accepts, returns feedback on, or rejects.",
  ],
];

export default function HowToRentOutGuide() {
  return (
    <GuideShell
      eyebrow="Guide for Landlords · 9 min read"
      title="How to Rent Out Your Property in Abu Dhabi"
      intro="Renting out a property can provide stable income and long-term value. To do it successfully, prepare the unit, price it correctly, find the right tenant, and register the tenancy properly. A well-prepared property, accurate listing, qualified tenant, registered contract, and organised handover protect your investment and reduce future issues."
      body={[
        ...STEPS.map(([t, d], i) => ({
          heading: `${i + 1}. ${t}`,
          copy: d,
        })),
        {
          heading: "Landlord checklist",
          checklist: [
            "Prepare and inspect the property",
            "Complete maintenance before listing",
            "Set the right rental price",
            "Take professional photos",
            "Create an accurate listing",
            "Work with a licensed agent",
            "Screen tenant documents",
            "Agree on rent, terms, and deposit",
            "Sign the tenancy contract",
            "Register through Tawtheeq / DARI",
            "Complete key and access card handover",
            "Keep payment receipts and records",
            "Track rent payments and renewal dates",
          ],
        },
        {
          heading: "What documents are required to list a property?",
          copy: "Usually a title deed or proof of ownership, Emirates ID or passport copy, contact details, property details, and any existing tenancy contract if the unit is rented. You can list a property that is currently rented — clearly mention that it's tenanted, along with the lease expiry date, current rent, and whether notice has been served.",
        },
        {
          heading: "Final tip",
          copy: "Renting out a property in Abu Dhabi is easier when you follow a clear process — preparation, accurate listing, a qualified tenant, a registered contract, and an organised handover.",
        },
      ]}
    />
  );
}
