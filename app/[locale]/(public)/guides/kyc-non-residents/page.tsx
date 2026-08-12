import type { Metadata } from "next";
import { GuideShell } from "../_components/guide-shell";

export const metadata: Metadata = {
  title: "KYC for non-resident property buyers in the UAE",
  description:
    "The KYC and AML documentation non-resident buyers should expect when acquiring UAE property — source of funds, banking, and the DLD transfer process.",
  alternates: { canonical: "/guides/kyc-non-residents" },
};

export default function KycNonResidentsPage() {
  return (
    <GuideShell
      eyebrow="Compliance · KYC"
      title="KYC for non-resident buyers."
      intro="The KYC and AML documentation non-resident buyers should expect when acquiring UAE property. Nothing onerous if prepared — every blocker we've seen has been a documentation problem, not an eligibility one."
      body={[
        {
          heading: "Identity",
          copy: "Passport biographical page + entry stamp / residency visa (if any). Where the passport is recent, a second photo ID — driver's licence or national ID — closes the loop with the trustee desk faster.",
        },
        {
          heading: "Address",
          copy: "Utility bill or bank statement in your name, dated within the last three months, showing your home address. PDF statements from your online bank count provided they include name + address + statement period header.",
        },
        {
          heading: "Source of funds",
          copy: "This is the part buyers underestimate. For purchases above AED 2M, the DLD-side trustee will request documentary evidence of the funds — bank statements showing accumulation, the sale contract if you've recently sold another asset, employment / dividend statements, or a clean note from your accountant. Compile this before you reach the MoU stage; it's the most common cause of trustee-day delays.",
        },
        {
          heading: "Banking",
          copy: "You don't need a UAE bank account to buy. The 10% MoU deposit can be wire-transferred to the DLD-approved trustee from any clean source; the balance can be wired straight to the trustee on transfer day. Where a UAE account would help is post-purchase — service-charge direct debits, rental income collection, mortgage payments. Bazar can introduce you to the bank that fits your residency status.",
        },
        {
          heading: "If you'll let the property out",
          copy: "Non-resident landlords need a tax representative inside the UAE, which is a one-line appointment your property management partner handles. ADJD (Abu Dhabi Judicial Department) registers the tenancy contract; service charges are billed by the master community. Bazar's lettings desk handles the entire cycle if you'd rather not manage from abroad.",
        },
      ]}
    />
  );
}
