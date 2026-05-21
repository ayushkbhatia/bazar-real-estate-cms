import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";

export const metadata: Metadata = {
  title: "Off-plan",
  description:
    "Pre-launch and on-sale developments from Abu Dhabi's leading developers.",
};

export default function OffPlanPage() {
  return (
    <div className="px-12 py-24 max-w-[80ch]">
      <Eyebrow>Coming in Phase 5</Eyebrow>
      <h1
        className="serif text-[56px] font-normal mt-2"
        style={{ letterSpacing: "-0.025em" }}
      >
        New developments
      </h1>
      <p className="mt-4 text-[15px] text-bz-muted">
        Development pages, payment plan calculators, and reservation flows
        arrive in Phase 5 alongside the AI Concierge. In the meantime, talk to
        an advisor to access pre-launch inventory.
      </p>
    </div>
  );
}
