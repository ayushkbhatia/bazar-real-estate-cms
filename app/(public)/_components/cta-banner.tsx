import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";

/**
 * Sprint 4a: moss-accent CTA banner at end of home page.
 */
export function CtaBanner() {
  return (
    <section className="px-12 py-16">
      <div className="bg-bz-accent text-bz-accent-fg rounded-lg p-12 grid grid-cols-[1fr_auto] gap-10 items-center">
        <div>
          <Eyebrow className="text-bz-accent-fg/70">Get in touch</Eyebrow>
          <h2
            className="serif text-[40px] mt-2 leading-tight max-w-[24ch]"
            style={{ letterSpacing: "-0.02em" }}
          >
            Book a 30-minute advisory call.
          </h2>
          <p className="mt-4 text-[15px] opacity-90 max-w-[56ch]">
            We&apos;ll ask what you&apos;re solving for. If we&apos;re the right firm, we&apos;ll
            tell you. If we&apos;re not, we&apos;ll point you to who is.
          </p>
        </div>
        <Button asChild size="lg" variant="secondary">
          <Link href="/contact">Talk to an advisor</Link>
        </Button>
      </div>
    </section>
  );
}
