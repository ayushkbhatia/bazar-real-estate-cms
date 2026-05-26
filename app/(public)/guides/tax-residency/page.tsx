import type { Metadata } from "next";
import { GuideShell } from "../_components/guide-shell";
import { TaxResidencyChecker } from "./_checker";

export const metadata: Metadata = {
  title: "UAE Tax Residency Certificate — 2026 eligibility",
  description:
    "The criteria for obtaining a UAE Tax Residency Certificate — physical-presence test, primary-residence rules, and what the certificate actually does (and doesn't) cover.",
  alternates: { canonical: "/guides/tax-residency" },
};

export default function TaxResidencyPage() {
  return (
    <GuideShell
      eyebrow="Tax · UAE residency"
      title="UAE Tax Residency Certificate."
      intro="The criteria for obtaining a UAE Tax Residency Certificate, what the certificate actually does and doesn't cover, and how to think about it alongside a tax-treaty break elsewhere."
      body={[
        {
          heading: "What the certificate does",
          copy: "A Tax Residency Certificate (TRC) is a formal document issued by the UAE Federal Tax Authority confirming that you (or your company) are a tax resident of the UAE under the country's domestic rules. It's the primary instrument used to claim benefits under the UAE's 130+ double-tax treaties when you need to break tax residency elsewhere.",
        },
        {
          heading: "Two routes to qualify",
          copy: "Route 1: 183+ days of physical presence in the UAE during the tax year. Route 2: 90+ days, plus a UAE anchor (a permanent home, employment, or business). The 90-day route is the workhorse for senior executives and founders who split their time between markets — but it requires evidence, not just passport stamps.",
        },
        {
          heading: "What it doesn't fix",
          copy: "Holding a TRC doesn't automatically break your tax residency elsewhere — that depends on the other country's domestic rules and the specific treaty article. The TRC is necessary, not sufficient. A cross-border tax adviser should pressure-test the treaty break before you rely on the certificate.",
        },
      ]}
    >
      <TaxResidencyChecker />
    </GuideShell>
  );
}
