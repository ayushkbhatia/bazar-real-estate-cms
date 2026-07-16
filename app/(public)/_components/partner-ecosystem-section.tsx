import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHead } from "./marketing/section-head";
import { PartnerMarquee } from "./partner-marquee";

/**
 * "Our Partner Ecosystem" — the banking + regulatory logo marquee with its
 * section header and "All partners" CTA. Shared verbatim by /about and the
 * home page so the two stay identical; edit here to change both.
 */
export function PartnerEcosystemSection() {
  return (
    <section className="px-4 md:px-12 py-14 md:py-18 border-t border-bz-border bg-bz-surface-2">
      <div className="flex flex-wrap justify-between items-end gap-4 mb-9">
        <SectionHead
          // The default muted eyebrow (bz-muted) only hits 4.2:1 on this
          // bz-surface-2 panel — below WCAG AA. Darken it to bz-ink-2 (the
          // same token the sub-copy uses here, which passes) for this section.
          className="[&_.eyebrow]:text-bz-ink-2"
          eyebrow="Our Partner Ecosystem"
          title="The banks and regulators behind every deal."
          sub="Direct relationships with the UAE's leading financial institutions and real-estate authorities."
          size={40}
        />
        <Button asChild variant="outline">
          <Link href="/partners">
            All partners
            <ArrowRight size={15} strokeWidth={1.7} />
          </Link>
        </Button>
      </div>
      <PartnerMarquee />
    </section>
  );
}
