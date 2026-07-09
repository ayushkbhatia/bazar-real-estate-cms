import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listPublishedDevelopments } from "@/lib/queries/developments";
import { listAreasWithCounts } from "@/lib/queries/areas-guide";
import { searchRedirectTarget } from "../_components/search-redirect";
import { MHero } from "../_components/marketing/m-hero";
import { SectionHead } from "../_components/marketing/section-head";
import { PropTypeGrid } from "../_components/marketing/prop-type-grid";
import { AreaList, type AreaRow } from "../_components/marketing/area-list";
import { DevelopmentCard } from "../_components/marketing/development-card";
import { AD_AREAS, OFFPLAN_TYPES } from "../_components/marketing/ad-data";

export const metadata: Metadata = {
  title: "New Projects · Off-plan in Abu Dhabi",
  description:
    "Explore the latest off-plan developments across Abu Dhabi's top communities — from waterfront apartments to branded residences.",
  alternates: { canonical: "/off-plan" },
};

export const revalidate = 300;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const OFFPLAN_TYPE_HREF: Record<string, string> = {
  Apartments: "/off-plan/search?type=apartment",
  Villas: "/off-plan/search?type=villa",
  Townhouses: "/off-plan/search?type=townhouse",
  Penthouses: "/off-plan/search?type=penthouse",
  "Branded Residences": "/off-plan/search",
};

const SECTION = "px-4 md:px-12 py-14 md:py-20 border-t border-bz-border";

export default async function NewProjectsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const target = searchRedirectTarget("/off-plan", raw);
  if (target) redirect(target);

  const [developments, areaCounts] = await Promise.all([
    listPublishedDevelopments(),
    listAreasWithCounts(),
  ]);
  const featuredDevs = developments.slice(0, 6);
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

  return (
    <div className="bg-bz-bg">
      <MHero
        eyebrow="New Projects"
        title={
          <>
            New developments
            <br />
            in Abu Dhabi.
          </>
        }
        sub="Explore the latest off-plan projects across Abu Dhabi's top communities — from waterfront apartments to branded residences."
        image="off-plan skyline · architectural render"
        tall
        kicker={[
          ["78%", "of H1 2026 sales were off-plan"],
          ["8", "leading communities"],
          ["40/60", "flexible payment plans"],
        ]}
      />

      {/* Off-plan property types */}
      <section className={SECTION}>
        <div className="max-w-[1200px]">
          <SectionHead
            eyebrow="Property types"
            title="Off-plan, every format."
            size={40}
            className="mb-9"
          />
          <PropTypeGrid
            cols={5}
            aspect="3/4"
            items={OFFPLAN_TYPES.map(([name, desc, cta]) => ({
              name,
              desc,
              cta,
              href: OFFPLAN_TYPE_HREF[name] ?? "/off-plan/search",
            }))}
          />
        </div>
      </section>

      {/* Featured developments */}
      {featuredDevs.length > 0 ? (
        <section className={SECTION + " bg-bz-surface-2"}>
          <div className="max-w-[1200px]">
            <div className="flex flex-wrap justify-between items-end gap-4 mb-9">
              <SectionHead
                eyebrow="New launch"
                title="Abu Dhabi's latest launches."
                sub="Browse the newest and upcoming residential developments across the emirate."
                size={40}
              />
              <Button
                asChild
                className="bg-bz-ink text-bz-bg hover:bg-bz-ink/90"
              >
                <Link href="/developments">
                  View all developments
                  <ArrowRight size={15} strokeWidth={1.7} />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredDevs.map((d) => (
                <DevelopmentCard key={d.id} d={d} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Abu Dhabi locations */}
      <section className={SECTION}>
        <div className="max-w-[1200px]">
          <SectionHead
            eyebrow="Abu Dhabi locations"
            title="Explore Abu Dhabi's leading communities."
            sub="From waterfront destinations to family-friendly neighbourhoods — the areas shaping the emirate's off-plan market."
            size={40}
            className="mb-9"
          />
          <AreaList areas={areas} />
        </div>
      </section>
    </div>
  );
}
