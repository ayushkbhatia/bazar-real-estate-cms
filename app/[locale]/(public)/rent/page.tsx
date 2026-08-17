import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { listNewThisWeek } from "@/lib/queries/curated-listings";
import { BuyRentLanding } from "../_components/marketing/buy-rent-landing";
import { RentAreaMap } from "../_components/marketing/rent-area-map";
import { LeadBand } from "../_components/marketing/lead-band";
import { FormRenderer } from "../_components/forms/form-renderer";
import { getForms } from "@/lib/queries/forms";
import { listAreaOptions } from "@/lib/queries/areas";
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
  return masterPageMetadata("rent", asLocale((await params).locale),
  {
    alternates: { canonical: "/rent" },
  });
}

// Old deep-links (/rent?beds=2) are redirected to /rent/search by proxy.ts.
// No `searchParams` here — reading it would make the route fully dynamic and
// discard the `revalidate` above. See lib/filters/search-redirect.ts.
export default async function RentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Before any other await. `getMasterPageContent` resolves its locale from
  // the request, and without this `getLocale()` has nothing to resolve — the
  // page renders English content under `lang="ar"` in an RTL layout, which is
  // the failure `lib/i18n/current.ts` describes: it looks finished.
  setRequestLocale(asLocale((await params).locale));

  const [content, rows, areas] = await Promise.all([
    getMasterPageContent("rent"),
    listNewThisWeek({ limit: 4 }),
    listAreaOptions(),
  ]);
  const featured = rows.slice(0, 4).map(listingRowToCard);

  // Copy, links, images and section order come from /admin/pages/master/rent.
  const c = buyRentContent(content);

  // The two lead forms on this page. Fields, order, button and confirmation
  // come from /admin/forms; a form switched off there drops its card rather
  // than leaving a heading over an empty box.
  const resolved = await getForms(["rent_hero_enquiry", "rent_lead_band"]);
  const forms = { hero: resolved["rent_hero_enquiry"]!, band: resolved["rent_lead_band"]! };

  // The location box suggests communities on file and accepts anything typed.
  // The label is what the visitor reads and what the advisor gets; the slug is
  // what the search redirect filters on when the two match. Keyed off the
  // field's `optionSource` rather than its name, so renaming the field in
  // /admin/forms doesn't quietly empty its suggestions.
  const areaOptions = areas.map((a) => ({ label: a.name, value: a.slug }));
  const heroOptions = Object.fromEntries(
    forms.hero.fields
      .filter((f) => f.optionSource === "areas")
      .map((f) => [f.key, areaOptions]),
  );

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
            dynamicOptions={heroOptions}
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
