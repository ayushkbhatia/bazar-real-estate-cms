import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listPublishedDevelopments } from "@/lib/queries/developments";
import { listAreasWithCounts } from "@/lib/queries/areas-guide";
import { buildOffplanMap } from "@/lib/queries/offplan-map";
import { searchRedirectTarget } from "../_components/search-redirect";
import { MHero } from "../_components/marketing/m-hero";
import { SectionHead } from "../_components/marketing/section-head";
import { PropTypeGrid } from "../_components/marketing/prop-type-grid";
import { AreaList, type AreaRow } from "../_components/marketing/area-list";
import { DevelopmentCard } from "../_components/marketing/development-card";
import { WhyBand } from "../_components/marketing/why-band";
import { Faq } from "../_components/marketing/faq";
import { AD_AREAS, OFFPLAN_TYPES } from "../_components/marketing/ad-data";
import { OffplanMapExplorer } from "../_components/off-plan/offplan-map-explorer";
import { ProjectInterestForm } from "../_components/off-plan/project-interest-form";

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

const OFFPLAN_FAQS: [string, string][] = [
  [
    "What does buying off-plan mean?",
    "You reserve a home before (or during) construction, directly from the developer. You typically pay in staged instalments through the build and take handover once the project completes — often at a lower entry price than a comparable ready home.",
  ],
  [
    "How do payment plans work?",
    "Most Abu Dhabi launches spread the price across construction milestones — a common structure is 40% during the build and 60% on handover, though plans vary by developer and project. We break down each plan alongside the numbers before you commit.",
  ],
  [
    "Is my money protected before handover?",
    "Yes. Off-plan payments are made into a developer's project escrow account, which is regulated so funds are released against verified construction progress rather than paid out up front. We confirm the escrow arrangement on every project we advise on.",
  ],
  [
    "Can non-residents and foreigners buy off-plan?",
    "Yes — foreign buyers can own freehold in Abu Dhabi's designated investment zones, which cover most of the island communities where new projects launch. We'll confirm the ownership status of any project you're considering.",
  ],
  [
    "Can I resell before handover?",
    "Often, yes. Many developers allow you to assign the contract to another buyer once you've paid a minimum share of the price, subject to their approval and a transfer fee. Terms differ per project, so we check the resale rules before you buy.",
  ],
  [
    "What fees should I budget for?",
    "Alongside the purchase price, budget for the government registration fee, any developer administration or oqood fees, and — if you're financing — mortgage arrangement costs. We give you an all-in figure so there are no surprises.",
  ],
  [
    "Can I get a mortgage on an off-plan home?",
    "Several UAE banks lend against off-plan purchases, usually releasing funds in step with construction. The loan-to-value and terms depend on the developer and your profile — our mortgage advisors can model your options before you reserve.",
  ],
  [
    "What happens at handover?",
    "Once the project completes you settle the final payment, the unit is inspected and snagged, and ownership is registered in your name. From there it's yours to move into, rent out, or sell.",
  ],
];

export default async function NewProjectsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const target = searchRedirectTarget("/off-plan", raw);
  if (target) redirect(target);

  const [developments, areaCounts] = await Promise.all([
    listPublishedDevelopments(),
    listAreasWithCounts(),
  ]);
  const featuredDevs = developments.slice(0, 6);
  const { pins, dots, groups, options } = buildOffplanMap(developments);
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
      </section>

      {/* Explore projects on the map */}
      {groups.length > 0 ? (
        <OffplanMapExplorer
          areas={pins}
          dots={dots}
          groups={groups.map((g) => ({
            slug: g.slug,
            name: g.name,
            count: g.count,
            cards: (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {g.projects.map((d) => (
                  <DevelopmentCard key={d.id} d={d} />
                ))}
              </div>
            ),
          }))}
        />
      ) : null}

      {/* Featured developments */}
      {featuredDevs.length > 0 ? (
        <section className={SECTION + " bg-bz-surface-2"}>
          <div className="flex flex-wrap justify-between items-end gap-4 mb-9">
            <SectionHead
              eyebrow="New launch"
              title="Abu Dhabi's latest launches."
              sub="Browse the newest and upcoming residential developments across the emirate."
              size={40}
            />
            <Button asChild className="bg-bz-ink text-bz-bg hover:bg-bz-ink/90">
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
        </section>
      ) : null}

      {/* Abu Dhabi locations */}
      <section className={SECTION}>
        <SectionHead
          eyebrow="Abu Dhabi locations"
          title="Explore Abu Dhabi's leading communities."
          sub="From waterfront destinations to family-friendly neighbourhoods — the areas shaping the emirate's off-plan market."
          size={40}
          className="mb-9"
        />
        <AreaList areas={areas} />
      </section>

      {/* Why Bazar */}
      <WhyBand
        title="Off-plan, handled end to end."
        body="From first render to handover, Bazar advises on the launches worth your capital — payment plans, escrow protection, developer track record, and resale timing. One team, from reservation to keys."
        stats={[
          ["78%", "H1 2026 sales off-plan"],
          ["40/60", "typical payment plans"],
          ["8", "leading communities"],
          ["2h", "advisor response"],
        ]}
      />

      {/* Register interest — project-specific lead form */}
      {options.length > 0 ? (
        <ProjectInterestForm projects={options} />
      ) : null}

      {/* FAQ */}
      <section className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border">
        <SectionHead
          eyebrow="FAQ"
          title="Off-plan questions, answered."
          size={40}
          className="mb-8"
        />
        <Faq items={OFFPLAN_FAQS} />
      </section>
    </div>
  );
}
