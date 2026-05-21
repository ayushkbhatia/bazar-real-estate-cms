import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { ListingCard } from "@/components/brand/listing-card";
import { Button } from "@/components/ui/button";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";

export const revalidate = 60; // 1-minute ISR for the home

type FeaturedListing = {
  reference: string;
  slug: string;
  title: string;
  price_aed: number;
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  flags: { exclusive?: boolean; vacant_on_transfer?: boolean } | null;
  areas: { name: string } | null;
};

async function fetchFeatured(): Promise<FeaturedListing[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("properties")
      .select(
        "reference, slug, title, price_aed, beds, baths, built_up_ft2, flags, areas:area_id(name)",
      )
      .eq("status", "published")
      .is("deleted_at", null)
      .eq("mode", "buy")
      .order("published_at", { ascending: false })
      .limit(3);
    if (error) {
      console.error("[home] featured fetch error", error);
      return [];
    }
    return (data ?? []) as unknown as FeaturedListing[];
  } catch (err) {
    console.error("[home] featured fetch threw", err);
    return [];
  }
}

function formatPrice(aed: number) {
  if (aed >= 1_000_000) return `AED ${(aed / 1_000_000).toFixed(1)}M`;
  if (aed >= 1_000) return `AED ${(aed / 1_000).toFixed(0)}K`;
  return `AED ${aed.toLocaleString()}`;
}

function badgeFromFlags(flags: FeaturedListing["flags"]):
  | { label: string; kind: "ink" | "accent" }
  | undefined {
  if (!flags) return undefined;
  if (flags.exclusive) return { label: "Exclusive", kind: "ink" };
  if (flags.vacant_on_transfer)
    return { label: "Vacant on transfer", kind: "accent" };
  return undefined;
}

export default async function HomePage() {
  const featured = await fetchFeatured();

  return (
    <div className="bg-bz-bg">
      {/* Hero — full-bleed variant A (placeholder until photography lands) */}
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

      {/* Featured strip — real data from Supabase */}
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
        {featured.length > 0 ? (
          <div className="grid grid-cols-3 gap-6">
            {featured.map((p) => {
              const badge = badgeFromFlags(p.flags);
              return (
                <ListingCard
                  key={p.reference}
                  price={formatPrice(p.price_aed)}
                  title={p.title}
                  location={p.areas?.name ?? "United Arab Emirates"}
                  beds={p.beds}
                  baths={p.baths}
                  area={p.built_up_ft2 ?? 0}
                  badge={badge?.label}
                  badgeKind={badge?.kind}
                  imgLabel={p.reference}
                />
              );
            })}
          </div>
        ) : (
          <p className="text-bz-muted">
            Listings coming soon. Set Supabase env vars and seed the database to
            see real properties here.
          </p>
        )}
      </section>

      {/* Phase callout */}
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
