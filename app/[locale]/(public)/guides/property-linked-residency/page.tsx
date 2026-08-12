import type { Metadata } from "next";
import { GuideShell } from "../_components/guide-shell";
import { PropertyResidencyChecker } from "./_checker";

export const metadata: Metadata = {
  title: "Property-linked UAE residency — 2-year visa guide",
  description:
    "The AED 750K+ property route to a 2-year renewable UAE residency. Who qualifies, what the asset has to look like, and the realistic timeline.",
  alternates: { canonical: "/guides/property-linked-residency" },
};

export default function PropertyLinkedResidencyPage() {
  return (
    <GuideShell
      eyebrow="Residency · 2-year visa"
      title="Property-linked residency, simplified."
      intro="The AED 750K+ property route to a 2-year renewable UAE residency — who qualifies, what the asset needs to look like, and the realistic timeline."
      body={[
        {
          heading: "When the 2-year visa is the right fit",
          copy: "If you don't yet have AED 2M+ to deploy for the Golden Visa but want a real UAE residency, the 2-year property-linked visa is the cleaner path. It's renewable indefinitely while you hold the property and covers spouse + dependent children.",
        },
        {
          heading: "What it doesn't cover",
          copy: "It's a residency, not a citizenship pathway. You can't sponsor extended family beyond spouse and minors. You'll still need to maintain UAE-side tax residency rules (typically 90+ days in country) if you want the Tax Residency Certificate.",
        },
        {
          heading: "Mortgage rules",
          copy: "Mortgaged property qualifies as long as the lender issues an NOC. If your outstanding loan exceeds 50% of the property value, ICP will additionally want 12 months of repayment history on file. None of this is a blocker — just timing.",
        },
      ]}
    >
      <PropertyResidencyChecker />
    </GuideShell>
  );
}
