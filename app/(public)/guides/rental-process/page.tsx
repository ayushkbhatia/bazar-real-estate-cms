import type { Metadata } from "next";
import { GuideShell } from "../_components/guide-shell";

export const metadata: Metadata = {
  title: "The Abu Dhabi Rental Process, Step by Step",
  description:
    "From searching for the right home to signing the contract, registering Tawtheeq, and moving in — the complete Abu Dhabi tenant journey explained.",
  alternates: { canonical: "/guides/rental-process" },
};

const STEPS: [string, string][] = [
  [
    "Set your budget",
    "Consider more than rent: annual rent, security deposit, agency commission, utility charges, municipality fees, internet, moving costs, and any building move-in fees. Municipality fees are 5% of the rental value or index, whichever is higher.",
  ],
  [
    "Choose the right location",
    "Abu Dhabi offers waterfront apartments, family villas, gated communities, and city-centre options. Popular areas include Al Reem, Saadiyat, Yas, Al Raha Beach, Khalifa City, Al Bateen, Al Mushrif, Al Reef, Al Muroor, and the Corniche.",
  ],
  [
    "View and compare properties",
    "Arrange viewings with a licensed agent. Check size, layout, natural light, finishing, parking, facilities, and condition. Ask about availability, payment count, maintenance, chiller charges, pets, and move-in restrictions.",
  ],
  [
    "Make an offer",
    "Your offer usually includes the annual rent, number of payments, contract start date, security deposit, and any special terms. Once accepted, you'll provide documents and make the required payments to proceed.",
  ],
  [
    "Sign the tenancy contract",
    "The contract should state tenant and landlord details, property details, annual rent, number of payments, start and end dates, deposit, maintenance responsibilities, payment terms, renewal terms, and any agreed conditions. Read carefully and keep a copy.",
  ],
  [
    "Register with Tawtheeq",
    "Contracts are registered through Tawtheeq. DARI lets the lessor register online, creating an official tenancy record linked to utility registration and municipality fees.",
  ],
  [
    "Set up utilities",
    "For Tawtheeq-registered tenants, TAQA/ADDC creates the account under the contract name, with the first bill within about a month. A separate application may need a passport, Emirates ID, contract, and previous closing letter.",
  ],
  [
    "Arrange move-in approval",
    "Check whether your building requires move-in approval. Some require booking the service elevator and submitting mover details with copies of the contract and Emirates ID — especially in towers and gated communities.",
  ],
  [
    "Move in and document condition",
    "Collect keys, access cards, and parking cards. Inspect again and photograph the condition before placing furniture. Report any maintenance issues immediately.",
  ],
  [
    "Understand renewal & end-of-tenancy",
    "Renewals are submitted through DARI; the tenant can accept or reject. The lessor cannot raise rent by more than 5% at renewal. To close a tenancy after expiry, DARI provides a close-tenancy service the tenant reviews and approves.",
  ],
];

export default function RentalProcessGuide() {
  return (
    <GuideShell
      eyebrow="Guide for Tenants · 8 min read"
      title="The Abu Dhabi Rental Process, Step by Step"
      intro="Renting in Abu Dhabi involves several important steps. Understanding Tawtheeq, utility registration, municipality fees, and move-in approvals makes the whole process easier."
      body={[
        ...STEPS.map(([t, d], i) => ({
          heading: `Step ${i + 1}: ${t}`,
          copy: d,
        })),
        {
          heading: "Rental process checklist",
          checklist: [
            "Set your rental budget",
            "Choose your preferred community",
            "View and compare properties",
            "Confirm rent, payment terms, and availability",
            "Submit tenant documents",
            "Sign the tenancy contract",
            "Complete Tawtheeq registration",
            "Confirm water and electricity setup",
            "Check municipality fee billing",
            "Arrange move-in approval",
            "Inspect the property before moving in",
            "Keep all contracts, receipts, and documents",
          ],
        },
        {
          heading: "Final tip",
          copy: "Before signing any rental agreement, always confirm the contract terms, payment schedule, property condition, and all required documents.",
        },
      ]}
    />
  );
}
