import Link from "next/link";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ref: string }>;
}): Promise<Metadata> {
  const { ref } = await params;
  return {
    title: `${ref.toUpperCase()} — sold`,
    robots: { index: false, follow: true },
  };
}

/**
 * Sprint 4c: 410 Gone landing for sold/withdrawn listings.
 *
 * Next's App Router can't set status codes directly from a page component,
 * but the route exists at `/sold/[ref]` so old URLs can redirect here.
 * Sprint 11 wires the real status:'sold' detection + 410 response via
 * the middleware (`lib/supabase/proxy.ts`) — until then this page returns 200
 * but the noindex meta keeps it out of search.
 */
export default async function SoldListingPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  return (
    <div className="bg-bz-bg">
      <section className="px-12 py-20 max-w-[640px] mx-auto text-center">
        <Eyebrow>410 · Sold</Eyebrow>
        <h1
          className="serif text-[56px] mt-3 leading-[1.05] font-normal"
          style={{ letterSpacing: "-0.025em" }}
        >
          This listing has sold.
        </h1>
        <p className="mt-5 text-[15.5px] text-bz-ink-2 leading-relaxed">
          The property referenced{" "}
          <span className="mono text-bz-ink">{ref.toUpperCase()}</span> is no
          longer on the market. You can browse similar listings or send us a
          brief and we&apos;ll surface comparable off-market stock.
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <Button asChild>
            <Link href="/buy">Browse the marketplace</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/concierge">Tell us what you&apos;re looking for</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
