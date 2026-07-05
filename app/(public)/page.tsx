import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import {
  formatPriceAED,
  listPublishedProperties,
  propertyUrl,
  type ListingRow,
} from "@/lib/queries/properties";
import { mediaPublicUrl } from "@/lib/media";
import { getPublicSiteSettings } from "@/lib/queries/site-settings";
import {
  HeroForVariant,
  type HeroVariant,
} from "./_components/hero-variants";
import { MarketStatsStrip } from "./_components/market-stats-strip";
import { AreasMosaic } from "./_components/areas-mosaic";
import { OffPlanStrip } from "./_components/off-plan-strip";
import { ServicesBand } from "./_components/services-band";
import { InsightsTeaser } from "./_components/insights-teaser";
import { CtaBanner } from "./_components/cta-banner";
import { SavedIdsProvider } from "./_components/saved-ids-provider";
import { ListingCardSaveable } from "./_components/listing-card-saveable";
import { TrustStrip } from "./_components/trust-strip";
import { ClientWords } from "./_components/client-words";
import { AdvisorOfMonth } from "./_components/advisor-of-month";
import { CarouselGrid } from "@/components/brand/mobile";

export const revalidate = 60;

const VALID_VARIANTS: HeroVariant[] = [
  "fullbleed",
  "editorial",
  "map",
  "concierge",
];

function badgeFor(row: ListingRow):
  | { label: string; kind: "ink" | "accent" }
  | undefined {
  if (row.flags?.exclusive) return { label: "Exclusive", kind: "ink" };
  if (row.flags?.vacant_on_transfer)
    return { label: "Vacant on transfer", kind: "accent" };
  return undefined;
}

export default async function HomePage() {
  const [{ rows: featured }, settings] = await Promise.all([
    listPublishedProperties({ mode: "buy", limit: 6 }),
    getPublicSiteSettings(),
  ]);

  // Hero variant is driven entirely by site_settings now — the page used to
  // also accept a `?hero=` querystring override, but reading `searchParams`
  // (even just to await it) forces Next.js to treat the whole route as fully
  // dynamic, which silently discards the `revalidate = 60` above and disables
  // static/ISR caching for the home page. That meant every single visitor
  // triggered a fresh server render + fresh Supabase queries — the main cause
  // of the slow home page. To preview a different hero, change it in
  // /admin/settings/brand instead.
  const settingsVariant = settings.display?.hero_variant;
  const variant: HeroVariant = VALID_VARIANTS.includes(
    settingsVariant as HeroVariant,
  )
    ? (settingsVariant as HeroVariant)
    : "fullbleed";

  return (
    <div className="bg-bz-bg">
      <HeroForVariant variant={variant} />

      <MarketStatsStrip />

      {/* T1-D — Trust signals strip between market stats and featured listings */}
      <TrustStrip />

      {/* Featured listings — 6 cards */}
      <section className="px-4 md:px-12 py-12 md:py-20">
        <div className="flex justify-between items-end mb-7 md:mb-10 gap-8 flex-wrap">
          <div>
            <Eyebrow>Featured this week</Eyebrow>
            <h2
              className="serif text-[28px] md:text-[40px] font-normal mt-2 leading-tight"
              style={{ letterSpacing: "-0.022em" }}
            >
              Hand-picked by our advisors.
            </h2>
          </div>
          <Button asChild variant="outline">
            <Link href="/buy">View all properties</Link>
          </Button>
        </div>
        {featured.length > 0 ? (
          <SavedIdsProvider>
            <CarouselGrid cols={3}>
              {featured.map((row, index) => {
                const badge = badgeFor(row);
                return (
                  <Link
                    key={row.reference}
                    href={propertyUrl(row)}
                    className="block"
                  >
                    <ListingCardSaveable
                      price={formatPriceAED(row.price_aed)}
                      priceAed={row.price_aed}
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
                      priority={index === 0}
                      propertyId={row.id}
                    />
                  </Link>
                );
              })}
            </CarouselGrid>
          </SavedIdsProvider>
        ) : (
          <p className="text-bz-muted text-[14px]">
            Listings appear here once published. Seed the database to see real
            entries.
          </p>
        )}
      </section>

      <AreasMosaic />
      <OffPlanStrip />
      <ServicesBand />

      {/* T3-A: editorial spotlight rotating monthly through the advisor roster. */}
      <AdvisorOfMonth />

      <ClientWords limit={3} />
      <InsightsTeaser />
      <CtaBanner />
    </div>
  );
}
