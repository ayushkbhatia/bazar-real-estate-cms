import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { listFeaturedByType } from "@/lib/queries/curated-listings";
import { BuyRentLanding } from "../_components/marketing/buy-rent-landing";
import { RentAreaMap } from "../_components/marketing/rent-area-map";
import { LeadBand } from "../_components/marketing/lead-band";
import { FormRenderer } from "../_components/forms/form-renderer";
import { getForms } from "@/lib/queries/forms";
import { listingRowToCard } from "../_components/marketing/map-listing";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { str } from "@/lib/master-pages";
import { buyRentContent } from "../_components/marketing/master-content";
import { masterPageMetadata } from "@/lib/queries/search-appearance";
import { asLocale } from "@/lib/i18n/locales";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // Title and description are CMS-owned: Pages & blocks → this page →
  // Search appearance. Unedited, they fall back to the strings that used
  // to be the literal here, now in MASTER_PAGE_SEO_DEFAULTS.
  return masterPageMetadata("commercial", asLocale((await params).locale),
  {
    alternates: { canonical: "/commercial" },
  });
}

// Old deep-links (/commercial?type=office) are redirected to /buy/search
// by proxy.ts. Deliberately no `searchParams` here: reading it — even just to
// await it — makes the route fully dynamic and discards the `revalidate` above.
// This page was landing-and-search in one file, which is why it was the last
// marketing route that could never be cached.
export default async function CommercialPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Before any other await. `getMasterPageContent` resolves its locale from
  // the request, and without this `getLocale()` has nothing to resolve — the
  // page renders English content under `lang="ar"` in an RTL layout, which is
  // the failure `lib/i18n/current.ts` describes: it looks finished.
  setRequestLocale(asLocale((await params).locale));

  const [content, rows] = await Promise.all([
    getMasterPageContent("commercial"),
    listFeaturedByType({ segment: "commercial", limit: 4 }),
  ]);
  const featured = rows.slice(0, 4).map(listingRowToCard);

  // Copy, links, images and section order come from
  // /admin/pages/master/commercial. Untouched fields fall back to the defaults
  // in lib/master-pages, which are this page's original copy.
  const c = buyRentContent(content);

  // The two lead forms on this page. Fields, order, button and confirmation
  // come from /admin/forms; a form switched off there drops its card rather
  // than leaving a heading over an empty box.
  const resolved = await getForms(["commercial_hero_enquiry", "commercial_lead_band"]);
  const forms = { hero: resolved["commercial_hero_enquiry"]!, band: resolved["commercial_lead_band"]! };

  // Map section copy — blank fields fall through to RentAreaMap's own defaults.
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
          // Dots, per-area counts and the "all" link all belong to commercial
          // inventory. The section defaults to rent (its first caller), and
          // taking those defaults here is what put rental dots and an
          // emirate-wide published count on this page.
          // `segment`, not `mode`: commercial stopped being a transaction in
          // 0121, and scoping this to the retired mode value would print zero
          // beside a rail that had just rendered the segment's inventory.
          mode={null}
          segment="commercial"
          allHref="/buy/search?segment=commercial"
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
