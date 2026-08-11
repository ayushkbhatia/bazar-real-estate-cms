import type { Metadata } from "next";
import { listNewThisWeek } from "@/lib/queries/curated-listings";
import { BuyRentLanding } from "../_components/marketing/buy-rent-landing";
import { RentAreaMap } from "../_components/marketing/rent-area-map";
import { LeadBand } from "../_components/marketing/lead-band";
import { FormRenderer } from "../_components/forms/form-renderer";
import { getForms } from "@/lib/queries/forms";
import { listingRowToCard } from "../_components/marketing/map-listing";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { str } from "@/lib/master-pages";
import { buyRentContent } from "../_components/marketing/master-content";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Rent a Property in Abu Dhabi",
  description:
    "Residential and commercial rentals across Abu Dhabi's most connected communities — matched to your budget, lifestyle, and move-in date.",
  alternates: { canonical: "/rent" },
};

// Old deep-links (/rent?beds=2) are redirected to /rent/search by proxy.ts.
// No `searchParams` here — reading it would make the route fully dynamic and
// discard the `revalidate` above. See lib/filters/search-redirect.ts.
export default async function RentPage() {
  const [content, rows] = await Promise.all([
    getMasterPageContent("rent"),
    listNewThisWeek({ limit: 4 }),
  ]);
  const featured = rows.slice(0, 4).map(listingRowToCard);

  // Copy, links, images and section order come from /admin/pages/master/rent.
  const c = buyRentContent(content);

  // The two lead forms on this page. Fields, order, button and confirmation
  // come from /admin/forms; a form switched off there drops its card rather
  // than leaving a heading over an empty box.
  const resolved = await getForms(["rent_hero_enquiry", "rent_lead_band"]);
  const forms = { hero: resolved["rent_hero_enquiry"]!, band: resolved["rent_lead_band"]! };

  // Map section copy — blank fields fall through to RentAreaMap's own defaults,
  // which are this section's original strings.
  const map = content.section("map")?.values ?? {};

  return (
    <BuyRentLanding
      eyebrow={c.eyebrow}
      title={c.title}
      sub={c.sub}
      heroImageUrl={c.heroImageUrl}
      heroImageAlt={c.heroImageAlt}
      wide
      chips={c.chips}
      chipHrefs={c.chipHrefs}
      stats={c.stats}
      heroForm={
        forms.hero.enabled ? (
          <FormRenderer
            form={forms.hero}
            className="mt-5"
            successStyle="soft"
            allowAnother
          />
        ) : null
      }
      formTitle={c.formTitle}
      formSub={c.formSub}
      featured={featured}
      featuredTitle={c.featuredTitle}
      featuredCta={c.featuredCta}
      featuredCtaHref={c.featuredCtaHref}
      sectionOrder={c.sectionOrder}
      mapSlot={
        <RentAreaMap
          eyebrow={str(map, "eyebrow") ?? undefined}
          heading={str(map, "heading") ?? undefined}
          body={str(map, "body")}
        />
      }
      mapAbove
      leadBand={
        <LeadBand
          form={
            forms.band.enabled ? (
              <FormRenderer
                form={forms.band}
                successStyle="soft"
                allowAnother
              />
            ) : null
          }
          eyebrow={c.lead.eyebrow}
          title={c.lead.title}
          sub={c.lead.sub}
          image={c.lead.image.label}
          imageUrl={c.lead.image.url}
          imageAlt={c.lead.image.alt}
        />
      }
      waysEyebrow={c.waysEyebrow}
      waysTitle={c.waysTitle}
      categoryTiles={c.categoryTiles}
      propTypesTitle={c.propTypesTitle}
      propTypes={c.propTypes}
      communitiesEyebrow={c.communitiesEyebrow}
      communitiesTitle={c.communitiesTitle}
      communitiesSub={c.communitiesSub}
      communityChips={c.communityChips}
      communitiesCta={c.communitiesCta}
      communitiesCtaHref={c.communitiesCtaHref}
      why={c.why}
      faqEyebrow={c.faqEyebrow}
      faqTitle={c.faqTitle}
      faqs={c.faqs}
    />
  );
}
