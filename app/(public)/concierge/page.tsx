import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";
import { isAnthropicConfigured } from "@/lib/concierge/env";
import { ConciergeChat } from "./_chat";

export const metadata: Metadata = {
  title: "The Concierge · your brief, in plain English",
  description:
    "Bazar's AI concierge — a natural-language interface to our Abu Dhabi catalogue. Curated matches, deterministic scoring, and one-click hand-off to a human advisor.",
  alternates: { canonical: "/concierge" },
};

export const dynamic = "force-dynamic";

export default function ConciergePage() {
  if (!isAnthropicConfigured) {
    return (
      <div className="px-4 md:px-12 py-12 md:py-24 max-w-[64ch]">
        <Eyebrow>Coming soon</Eyebrow>
        <h1
          className="serif text-[32px] md:text-[56px] font-normal mt-2 leading-tight"
          style={{ letterSpacing: "-0.025em" }}
        >
          The Concierge
        </h1>
        <p className="mt-5 text-[16px] text-bz-muted leading-[1.65]">
          The AI concierge is built but not active in this environment —
          ANTHROPIC_API_KEY hasn&apos;t been configured. Set it in the Vercel
          project and reload to enable.
        </p>
      </div>
    );
  }
  return <ConciergeChat />;
}
