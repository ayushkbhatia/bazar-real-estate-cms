import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listPublishedDevelopments } from "@/lib/queries/developments";
import { listAreasWithCounts } from "@/lib/queries/areas-guide";
import { buildOffplanMap, parseGroupLimit } from "@/lib/queries/offplan-map";
import { getDevelopmentCoordsBulk } from "@/lib/queries/development-extras";
import { MHero } from "../_components/marketing/m-hero";
import { SectionHead } from "../_components/marketing/section-head";
import { PropTypeGrid } from "../_components/marketing/prop-type-grid";
import { AreaList, type AreaRow } from "../_components/marketing/area-list";
import { DevelopmentCard } from "../_components/marketing/development-card";
import { WhyBand } from "../_components/marketing/why-band";
import { Faq } from "../_components/marketing/faq";
import { AD_AREAS } from "../_components/marketing/ad-data";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { OFFPLAN_LAUNCH_COUNT } from "../_components/marketing/counts";
import {
  faqPairs,
  img,
  list,
  statPairs,
  str,
} from "@/lib/master-pages";
import { OffplanMapExplorer } from "../_components/off-plan/offplan-map-explorer";
import { ProjectInterestForm } from "../_components/off-plan/project-interest-form";

export const metadata: Metadata = {
  title: "New Projects · Off-plan in Abu Dhabi",
  description:
    "Explore the latest off-plan developments across Abu Dhabi's top communities — from waterfront apartments to branded residences.",
  alternates: { canonical: "/off-plan" },
};

export const revalidate = 300;

const SECTION = "px-4 md:px-12 py-14 md:py-20 border-t border-bz-border";

// Old deep-links (/off-plan?type=apartment) are redirected to /off-plan/search
// by proxy.ts. No `searchParams` here — reading it would make the route fully
// dynamic and discard the `revalidate = 300` above.
export default async function NewProjectsPage() {
  const [content, developments, areaCounts] = await Promise.all([
    getMasterPageContent("off-plan"),
    listPublishedDevelopments(),
    listAreasWithCounts(),
  ]);
  // Curated in the New Projects master page; a pick that no longer resolves
  // (unpublished, renamed, deleted) is dropped rather than rendered as a card
  // linking nowhere. Empty ⇒ the most recent published projects.
  const launchPicks = list<Record<string, unknown>>(
    content.section("launches")?.values ?? {},
    "projects",
  )
    .filter((p) => p.enabled !== false)
    .map((p) => (typeof p.slug === "string" ? p.slug : ""))
    .filter(Boolean);
  const bySlug = new Map(developments.map((d) => [d.slug, d]));
  const picked = launchPicks
    .map((slug) => bySlug.get(slug))
    .filter((d): d is (typeof developments)[number] => d !== undefined);
  const featuredDevs =
    picked.length > 0 ? picked : developments.slice(0, OFFPLAN_LAUNCH_COUNT);
  // Each project's own pin (Pages → Developments → <project> → Location) is
  // what puts it in the right spot on the map; an unplaced project still falls
  // back to its area centroid. Fetched here rather than folded into
  // INDEX_FIELDS so the other consumers of that list don't carry `meta`.
  const projectCoords = await getDevelopmentCoordsBulk(
    developments.map((d) => d.id),
  );
  const { pins, dots, groups, options } = buildOffplanMap(
    developments,
    projectCoords,
  );
  const countBySlug = new Map(
    areaCounts.map((a) => [a.name, { slug: a.slug, count: a.listing_count }]),
  );
  const areas: AreaRow[] = AD_AREAS.map((a) => {
    const hit = countBySlug.get(a.name);
    return {
      ...a,
      count: hit?.count,
      href: hit
        ? `/off-plan/search?area=${encodeURIComponent(hit.slug)}`
        : "/off-plan/search",
    };
  });

  // Copy, links, images and section order come from
  // /admin/pages/master/off-plan; untouched fields fall back to the defaults
  // in lib/master-pages, which are this page's original copy.
  const hero = content.section("hero")?.values ?? {};
  const types = content.section("prop_types")?.values ?? {};
  const launches = content.section("launches")?.values ?? {};
  const mapCopy = content.section("map")?.values ?? {};
  // Rail settings from the master page. A blank cap means every published
  // project in the area stays on the rail, which is what the page did before
  // the rail existed.
  const groupLimit = parseGroupLimit(str(mapCopy, "group_limit"));
  const groupCtaLabel = str(mapCopy, "group_cta_label");
  const locations = content.section("locations")?.values ?? {};
  const why = content.section("why")?.values ?? {};
  const faq = content.section("faq")?.values ?? {};
  const interest = content.section("interest_form")?.values ?? {};
  const heroImage = img(hero, "image");
  const interestImage = img(interest, "image");

  const heroTitle = (str(hero, "title") ?? "").split("\n");
  const faqs = faqPairs(faq);
  const typeItems = list<Record<string, unknown>>(types, "items").map((t) => ({
    name: String(t.name ?? ""),
    desc: String(t.desc ?? ""),
    cta: String(t.cta ?? ""),
    href: String(t.href ?? "/off-plan/search"),
    img: typeof t.img === "string" ? t.img : undefined,
    imgUrl: imageUrlOf(t.image),
    imgAlt: imageAltOf(t.image),
  }));

  const nodes: Record<string, React.ReactNode> = {
    hero: (
      <MHero
        key="hero"
        eyebrow={str(hero, "eyebrow") ?? ""}
        title={
          <>
            {heroTitle.map((line, i) => (
              <span key={i}>
                {line}
                {i < heroTitle.length - 1 ? <br /> : null}
              </span>
            ))}
          </>
        }
        sub={str(hero, "sub") ?? ""}
        image={heroImage?.label ?? ""}
        imageUrl={heroImage?.url ?? null}
        imageAlt={heroImage?.alt ?? null}
        tall
        kicker={statPairs(hero)}
      />
    ),

    prop_types:
      typeItems.length > 0 ? (
        <section key="prop_types" className={SECTION}>
          <SectionHead
            eyebrow={str(types, "eyebrow") ?? ""}
            title={str(types, "heading") ?? ""}
            sub={str(types, "body") ?? undefined}
            size={40}
            className="mb-9"
          />
          <PropTypeGrid cols={5} aspect="3/4" items={typeItems} />
        </section>
      ) : null,

    map:
      groups.length > 0 ? (
        <OffplanMapExplorer
          key="map"
          areas={pins}
          dots={dots}
          eyebrow={str(mapCopy, "eyebrow") ?? undefined}
          heading={str(mapCopy, "heading") ?? undefined}
          body={str(mapCopy, "body")}
          groups={groups.map((g) => ({
            slug: g.slug,
            name: g.name,
            // The true published total, not the number of cards on the rail —
            // it is what makes the "view all" link mean something.
            count: g.count,
            cards: (groupLimit ? g.projects.slice(0, groupLimit) : g.projects).map(
              (d) => <DevelopmentCard key={d.id} d={d} />,
            ),
            viewAllHref: `/off-plan/search?area=${encodeURIComponent(g.slug)}`,
            viewAllLabel: groupCtaLabel,
          }))}
        />
      ) : null,

    launches:
      featuredDevs.length > 0 ? (
        <section key="launches" className={SECTION + " bg-bz-surface-2"}>
          <div className="flex flex-wrap justify-between items-end gap-4 mb-9">
            <SectionHead
              eyebrow={str(launches, "eyebrow") ?? ""}
              title={str(launches, "heading") ?? ""}
              sub={str(launches, "body") ?? undefined}
              size={40}
            />
            {str(launches, "cta_label") ? (
              <Button asChild className="bg-bz-ink text-bz-bg hover:bg-bz-ink/90">
                <Link href={str(launches, "cta_href") ?? "/developments"}>
                  {str(launches, "cta_label")}
                  <ArrowRight size={15} strokeWidth={1.7} />
                </Link>
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredDevs.map((d) => (
              <DevelopmentCard key={d.id} d={d} />
            ))}
          </div>
        </section>
      ) : null,

    locations: (
      <section key="locations" className={SECTION}>
        <SectionHead
          eyebrow={str(locations, "eyebrow") ?? ""}
          title={str(locations, "heading") ?? ""}
          sub={str(locations, "body") ?? undefined}
          size={40}
          className="mb-9"
        />
        <AreaList areas={areas} />
      </section>
    ),

    why: (
      <WhyBand
        key="why"
        title={str(why, "why_title") ?? ""}
        body={str(why, "why_body") ?? ""}
        stats={statPairs(why)}
      />
    ),

    interest_form:
      options.length > 0 ? (
        <ProjectInterestForm
          key="interest_form"
          projects={options}
          imageUrl={interestImage?.url ?? null}
          imageAlt={interestImage?.alt ?? null}
          imageLabel={interestImage?.label ?? null}
        />
      ) : null,

    faq:
      faqs.length > 0 ? (
        <section
          key="faq"
          className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border"
        >
          <SectionHead
            eyebrow={str(faq, "faq_eyebrow") ?? ""}
            title={str(faq, "faq_title") ?? ""}
            size={40}
            className="mb-8"
          />
          <Faq items={faqs} />
        </section>
      ) : null,
  };

  return (
    <div className="bg-bz-bg">
      {content.order.map((key) => (
        <React.Fragment key={key}>{nodes[key] ?? null}</React.Fragment>
      ))}
    </div>
  );
}

function imageUrlOf(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const url = (value as { url?: unknown }).url;
  return typeof url === "string" && url ? url : null;
}

function imageAltOf(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const alt = (value as { alt?: unknown }).alt;
  return typeof alt === "string" && alt ? alt : null;
}
