import type { Metadata } from "next";
import { GuideShell } from "../_components/guide-shell";

export const metadata: Metadata = {
  title: "Required Documents for Renting in Abu Dhabi",
  description:
    "The identification, Tawtheeq, utility, and building-approval documents every Abu Dhabi tenant should prepare before signing and moving in.",
  alternates: { canonical: "/guides/required-documents" },
};

export default function RequiredDocumentsGuide() {
  return (
    <GuideShell
      eyebrow="Guide for Tenants · 6 min read"
      title="Required Documents for Renting in Abu Dhabi"
      intro="Having the right documents ready speeds up the rental process and avoids delays with Tawtheeq, utilities, and building move-in approvals. Prepare early and keep both digital and printed copies."
      body={[
        {
          heading: "1. Basic tenant documents",
          copy: "Most landlords, agencies, and property managers will ask tenants to provide identification and residency documents before finalising the agreement. Commonly required:",
          bullets: [
            "Passport copy",
            "UAE residence visa copy, if applicable",
            "Emirates ID copy",
            "Contact number and email address",
            "Salary certificate or employment letter, if requested",
            "Recent bank statement, if requested",
            "Marriage certificate, if applicable for family occupancy",
          ],
        },
        {
          heading: "2. Documents for Tawtheeq registration",
          copy: "In Abu Dhabi, rental contracts are registered through Tawtheeq. On DARI, the lessor registers the tenancy by entering the contract type, tenant type, premise ID, and tenant information. For individual tenants, DARI requires the tenant's Emirates ID number or Unified Number.",
          bullets: [
            "Signed tenancy contract",
            "Tenant Emirates ID or UID",
            "Tenant passport copy",
            "Tenant contact details",
            "Property premise ID",
            "Landlord or authorised representative details",
            "Property ownership or unit information",
          ],
        },
        {
          heading: "3. Documents for utility connection",
          copy: "For tenants registered with Tawtheeq, TAQA Distribution/ADDC usually creates the water and electricity account automatically under the name on the tenancy contract. If a separate move-in application is required, you may need a passport, Emirates ID, tenancy contract, and the previous account closing letter (formerly known as a clearance certificate).",
        },
        {
          heading: "4. Documents for building or community move-in approval",
          copy: "Some buildings require move-in approval before bringing furniture or using the service elevator. Management may request the tenancy contract, Emirates ID and passport copies, Tawtheeq certificate (if available), move-in date and time, moving company details, vehicle details, and landlord approval.",
        },
        {
          heading: "5. Payment documents and receipts",
          checklist: [
            "Security deposit receipt",
            "Agency commission receipt",
            "Rent payment proof",
            "Cheque copies, if rent is paid by cheque",
            "Utility deposit or activation confirmation",
            "Any maintenance or move-in fee receipts",
          ],
        },
        {
          heading: "6. Documents for company tenants",
          copy: "Company tenants may be registered using the trade licence number, along with business contact and representative information — typically a trade licence copy, representative Emirates ID and passport, an authorisation letter or power of attorney, company contact details, and the signed tenancy contract.",
        },
        {
          heading: "Abu Dhabi tenant document checklist",
          checklist: [
            "Passport copy",
            "Emirates ID copy",
            "UAE visa copy, if applicable",
            "Signed tenancy contract",
            "Tawtheeq registration confirmation, if available",
            "Salary certificate or employment letter, if requested",
            "Security deposit and payment receipts",
            "Utility account details",
            "Previous account closing letter, if required",
            "Move-in approval documents",
            "Parking or access card application documents",
          ],
        },
        {
          heading: "Final tip",
          copy: "Prepare your documents early and keep both digital and printed copies — it makes completing the contract, registering Tawtheeq, and moving in far smoother.",
        },
      ]}
    />
  );
}
