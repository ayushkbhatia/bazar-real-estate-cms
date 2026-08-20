import Link from "@/components/i18n/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHead } from "./marketing/section-head";
import { PartnerMarquee } from "./partner-marquee";

/**
 * "Our Partner Ecosystem" — the banking + regulatory logo marquee with its
 * section header and "All partners" CTA. Rendered by both /about and the home
 * page, each passing its own master-page copy: the logos are shared, the words
 * are the page's own.
 *
 * The literals below are the designed English fallback (ADR-0007 §5), not a
 * second writable copy — they are what renders when a field is blank, and they
 * match `PARTNER_BAND_DEFAULTS` exactly.
 */
export function PartnerEcosystemSection({
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
    <section className="px-4 md:px-12 py-14 md:py-18 border-t border-bz-border bg-bz-surface-2">
      <div className="flex flex-wrap justify-between items-end gap-4 mb-9">
        <SectionHead
          eyebrow={eyebrow ?? "Our Partner Ecosystem"}
          title={heading ?? "The banks and regulators behind every deal."}
          sub={
            body ??
            "Direct relationships with the UAE's leading financial institutions and real-estate authorities."
          }
          size={40}
        />
        <Button asChild variant="outline">
          <Link href="/partners">
            {ctaLabel ?? "All partners"}
            <ArrowRight size={15} strokeWidth={1.7} />
          </Link>
        </Button>
      </div>
      <PartnerMarquee />
    </section>
  );
}
