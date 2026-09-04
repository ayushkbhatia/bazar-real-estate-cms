import Link from "@/components/i18n/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHead } from "./marketing/section-head";
import { DeveloperMarquee } from "./developer-marquee";

/**
 * "Our Developers" — the developer logo marquee with its section header and
 * "All developers" CTA. Sits directly above `PartnerEcosystemSection` on the
 * home page: developers first, then the banks and regulators behind the deal.
 *
 * Left on the page background so the tonal step up into that section's
 * bz-surface-2 panel keeps the two carousels reading as separate sections
 * rather than one double-height block.
 */
export function DevelopersSection({
  eyebrow,
  heading,
  body,
  ctaLabel,
}: {
  eyebrow?: string | null;
  heading?: string | null;
  body?: string | null;
  ctaLabel?: string | null;
} = {}) {
  return (
    <section className="px-4 md:px-12 py-14 md:py-18 border-t border-bz-border">
      <div className="flex flex-wrap justify-between items-end gap-4 mb-9">
        <SectionHead
          eyebrow={eyebrow ?? "Our Developers"}
          title={heading ?? "The developers shaping the UAE."}
          sub={
            body ??
            "Direct relationships with the region's leading developers give our clients early access to landmark communities, new launches, and off-plan releases."
          }
          size={40}
        />
        <Button asChild>
          <Link href="/developers">
            {ctaLabel ?? "All developers"}
            <ArrowRight size={15} strokeWidth={1.7} />
          </Link>
        </Button>
      </div>
      <DeveloperMarquee />
    </section>
  );
}
