import { Eyebrow } from "@/components/brand/eyebrow";
import { ListingCard } from "@/components/brand/listing-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const FEATURED_PLACEHOLDERS = [
  {
    price: "AED 4.2M",
    title: "Mamsha · 3-bed beachfront",
    location: "Saadiyat Island",
    beds: 3,
    baths: 4,
    area: 2840,
    badge: "Exclusive",
    badgeKind: "ink" as const,
  },
  {
    price: "AED 12.5M",
    title: "Nudra · 5-bed villa with pool",
    location: "Saadiyat Beach",
    beds: 5,
    baths: 6,
    area: 6200,
    badge: "Vacant on transfer",
    badgeKind: "accent" as const,
  },
  {
    price: "AED 2.8M",
    title: "Reflection · Skyline penthouse",
    location: "Al Reem Island",
    beds: 2,
    baths: 3,
    area: 1980,
  },
];

export default function HomePage() {
  return (
    <div className="bg-bz-bg">
      {/* Hero — variant A (full-bleed placeholder) */}
      <section className="relative h-[640px] bg-bz-ink overflow-hidden">
        <div className="absolute inset-0 bz-img-dark opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-bz-ink/95 via-bz-ink/30 to-bz-ink/40" />
        <div className="relative h-full px-12 flex flex-col justify-end pb-20 text-white">
          <Eyebrow className="text-white/60 mb-4">Bazar · Abu Dhabi</Eyebrow>
          <h1
            className="serif text-[88px] leading-[0.98] font-normal max-w-[12ch]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Find a home worth keeping.
          </h1>
          <p className="mt-6 max-w-[60ch] text-[17px] leading-relaxed text-white/80">
            Curated marketplace and bespoke advisory for buyers, sellers, and
            investors across the United Arab Emirates.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg">
              <Link href="/buy">Browse the marketplace</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <Link href="/concierge">Talk to an advisor</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured strip — placeholder content */}
      <section className="px-12 py-20">
        <div className="flex justify-between items-end mb-10">
          <div>
            <Eyebrow>Featured this week</Eyebrow>
            <h2
              className="serif text-[40px] font-normal mt-2"
              style={{ letterSpacing: "-0.025em" }}
            >
              Hand-picked by our advisors
            </h2>
          </div>
          <Button asChild variant="outline">
            <Link href="/buy">View all properties</Link>
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {FEATURED_PLACEHOLDERS.map((p, i) => (
            <ListingCard key={i} {...p} imgLabel={`${p.location} · ${i + 1}`} />
          ))}
        </div>
      </section>

      {/* Coming-soon callout */}
      <section className="px-12 pb-24">
        <div className="bg-bz-accent-soft rounded-xl p-10 flex items-center justify-between gap-8">
          <div>
            <Eyebrow>Phase 0 · Foundations</Eyebrow>
            <h3
              className="serif text-[32px] mt-2 max-w-[24ch]"
              style={{ letterSpacing: "-0.02em" }}
            >
              The marketplace is under construction. Search, valuation, and the
              AI concierge land in coming sprints.
            </h3>
          </div>
          <Button asChild>
            <Link href="/contact">Get notified</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
