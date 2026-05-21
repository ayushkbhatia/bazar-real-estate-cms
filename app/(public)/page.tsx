import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { ListingCard } from "@/components/brand/listing-card";
import { Button } from "@/components/ui/button";
import {
  formatPriceAED,
  getSavedPropertyIds,
  listPublishedProperties,
  propertyUrl,
  type ListingRow,
} from "@/lib/queries/properties";
import { mediaPublicUrl } from "@/lib/media";
import { getSessionUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function badgeFor(row: ListingRow):
  | { label: string; kind: "ink" | "accent" }
  | undefined {
  if (row.flags?.exclusive) return { label: "Exclusive", kind: "ink" };
  if (row.flags?.vacant_on_transfer)
    return { label: "Vacant on transfer", kind: "accent" };
  return undefined;
}

export default async function HomePage() {
  const [{ rows: featured }, user] = await Promise.all([
    listPublishedProperties({ mode: "buy", limit: 3 }),
    getSessionUser(),
  ]);
  const savedSet = await getSavedPropertyIds(featured.map((r) => r.id));
  const isAuthed = user !== null;

  return (
    <div className="bg-bz-bg">
      {/* Hero — full-bleed variant A (until photography lands). Brand
          gradient pulls from bz-ink through a deeper moss tone to keep
          the surface tonal but not flat; the bottom fade keeps the
          headline legible against either end. */}
      <section className="relative h-[640px] bg-bz-ink overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, var(--bz-ink) 0%, oklch(0.22 0.05 155) 55%, var(--bz-ink) 100%)",
          }}
        />
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
            {featured.map((row) => {
              const badge = badgeFor(row);
              return (
                <Link
                  key={row.reference}
                  href={propertyUrl(row)}
                  className="block"
                >
                  <ListingCard
                    price={formatPriceAED(row.price_aed)}
                    title={row.title}
                    location={row.areas?.name ?? "United Arab Emirates"}
                    beds={row.beds}
                    baths={row.baths}
                    area={row.built_up_ft2 ?? 0}
                    badge={badge?.label}
                    badgeKind={badge?.kind}
                    imgLabel={row.reference}
                    heroSrc={
                      row.hero ? mediaPublicUrl(row.hero.storage_key) : null
                    }
                    heroAlt={row.hero?.alt_text ?? row.title}
                    propertyId={row.id}
                    initialSaved={savedSet.has(row.id)}
                    isAuthed={isAuthed}
                  />
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-bz-muted">
            Listings coming soon. Set Supabase env vars and seed the database
            to see real properties here.
          </p>
        )}
      </section>

      {/* Phase callout */}
      <section className="px-12 pb-24">
        <div className="bg-bz-accent-soft rounded-xl p-10 flex items-center justify-between gap-8">
          <div>
            <Eyebrow className="text-bz-accent">Phase 0 · Foundations</Eyebrow>
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
