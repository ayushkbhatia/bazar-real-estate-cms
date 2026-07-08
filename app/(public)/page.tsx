import Link from "next/link";
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
import { AreaMapSection } from "./_components/area-map-section";
import { SavedIdsProvider } from "./_components/saved-ids-provider";
import { ListingCardSaveable } from "./_components/listing-card-saveable";
import { CarouselGrid } from "@/components/brand/mobile";
import { LocationBrowsing } from "./_components/home/location-browsing";
import { OffPlanProjects } from "./_components/home/off-plan-projects";
import { ListYourProperty } from "./_components/home/list-your-property";
import { MortgageCalculatorSection } from "./_components/home/mortgage-calculator-section";
import { WhoWeAre } from "./_components/home/who-we-are";
import { HomeFaqs } from "./_components/home/home-faqs";
import { HomeTestimonials } from "./_components/home/home-testimonials";

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
  // static/ISR caching for the home page. To preview a different hero, change
  // it in /admin/settings/brand instead.
  const settingsVariant = settings.display?.hero_variant;
  const variant: HeroVariant = VALID_VARIANTS.includes(
    settingsVariant as HeroVariant,
  )
    ? (settingsVariant as HeroVariant)
    : "fullbleed";

  return (
    <div className="bg-bz-bg">
      <HeroForVariant variant={variant} />

      {/* Interactive area map — mounts on scroll (kept as-is). Everything
          below here is the client-audit home restructure. */}
      <AreaMapSection />

      {/* 1 — Location-based browsing */}
      <LocationBrowsing />

      {/* 2 — Off-plan projects */}
      <OffPlanProjects />

      {/* 3 — Featured properties */}
      <section className="px-4 md:px-12 py-14 md:py-20">
        <div className="mb-8 flex flex-col gap-5 md:mb-11 md:flex-row md:items-end md:justify-between">
          <div>
            <div
              className="text-[11px] font-medium uppercase text-bz-muted"
              style={{ letterSpacing: "0.12em" }}
            >
              Featured properties for sale
            </div>
            <h2 className="serif mt-2 text-[28px] md:text-[44px] font-normal leading-[1.05] tracking-tight">
              Featured properties, handpicked for you
            </h2>
            <p className="mt-4 max-w-[56ch] text-[14.5px] md:text-[15.5px] text-bz-ink-2 leading-relaxed">
              Discover properties that bring you closer to the lifestyle you are
              looking for.
            </p>
          </div>
          <Button asChild variant="outline" className="self-start">
            <Link href="/buy">All properties</Link>
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

      {/* 4 — List your property */}
      <ListYourProperty />

      {/* 5 — Mortgage calculator */}
      <MortgageCalculatorSection />

      {/* 6 — Who we are */}
      <WhoWeAre />

      {/* 7 — FAQs */}
      <HomeFaqs />

      {/* 8 — Testimonials */}
      <HomeTestimonials />
    </div>
  );
}
