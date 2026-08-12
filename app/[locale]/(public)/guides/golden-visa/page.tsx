import type { Metadata } from "next";
import { GuideShell } from "../_components/guide-shell";
import { GoldenVisaChecker } from "./_checker";

export const metadata: Metadata = {
  title: "UAE Golden Visa via property — 2026 guide",
  description:
    "A plain-English walk-through of the 10-year UAE Golden Visa for property buyers: thresholds, qualifying assets, dependants, the application timeline, and what Bazar's visa desk handles end-to-end.",
  alternates: { canonical: "/guides/golden-visa" },
};

export default function GoldenVisaPage() {
  return (
    <GuideShell
      eyebrow="Residency · Golden Visa"
      title="The 10-year Golden Visa, via property."
      intro="A plain-English walk-through of the 10-year UAE Golden Visa for property buyers — who qualifies, what counts as a qualifying asset, how dependants work, and the realistic timeline from application to Emirates ID."
      body={[
        {
          heading: "Who it's for",
          copy: "The Golden Visa was designed to anchor investors, founders, and senior professionals in the UAE for the long term. The property route is one of the cleanest paths: own AED 2M+ of qualifying real estate in your personal name and you're eligible for a 10-year residency, renewable, that covers your spouse and dependent children.",
        },
        {
          heading: "Qualifying property",
          copy: "Ready, titled property at AED 2M+ qualifies straight away. Off-plan property qualifies once the developer has issued the 50%-paid certificate. Multiple properties can be combined towards the threshold provided each is in your personal name and the cumulative AED value clears AED 2M. Company-held property doesn't qualify directly — ICP grants the visa to the beneficial owner of record, so you'd need to restructure to personal title.",
        },
        {
          heading: "Dependants",
          copy: "Spouse and dependent children (typically up to 21, or 25 for unmarried daughters in full-time education) are covered under your sponsorship. The visa is renewable as long as the property is held. If you sell below the threshold, the residency lapses on the next renewal cycle.",
        },
        {
          heading: "Timeline",
          copy: "End-to-end, expect 4–6 weeks from full-pack submission to Emirates ID issuance. The bottleneck is usually the medical + biometrics slots rather than ICP processing itself. Bazar's visa desk pre-compiles every document so the submission lands clean on day one.",
        },
      ]}
    >
      <GoldenVisaChecker />
    </GuideShell>
  );
}
