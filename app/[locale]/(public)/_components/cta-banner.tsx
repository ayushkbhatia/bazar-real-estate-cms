import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { ValuationLeadGate } from "../tools/valuation/_components/lead-gate";

/**
 * Home-page CTA banner.
 *
 * T1-E cleanup: now surfaces the valuation lead-gate as a parallel CTA
 * next to the "Book an advisory call" link. Most people coming to the
 * home page are price-curious before they're advisor-curious; giving
 * them the report path is the higher-intent option.
 */
export function CtaBanner() {
  return (
    <section className="px-4 md:px-12 py-12 md:py-16">
      <div className="bg-bz-accent text-bz-accent-fg rounded-lg p-6 md:p-12 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-10 items-center">
        <div>
          <Eyebrow className="text-bz-accent-fg/70">Get in touch</Eyebrow>
          <h2
            className="serif text-[28px] md:text-[40px] mt-2 leading-tight max-w-[24ch]"
            style={{ letterSpacing: "-0.02em" }}
          >
            Two ways to start.
          </h2>
          <p className="mt-4 text-[15px] opacity-90 max-w-[56ch]">
            Curious what your property might be worth? Get an advisor-prepared
            valuation report within 24 hours. Or book a 30-minute call to talk
            through what you&apos;re solving for.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <ValuationLeadGate triggerLabel="Get a free valuation report" />
          <Button asChild size="lg" variant="secondary">
            <Link href="/contact">Talk to an advisor</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
