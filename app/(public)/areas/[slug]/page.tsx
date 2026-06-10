import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Button } from "@/components/ui/button";
import { getSeedAreaGuideBySlug } from "@/lib/seeds/areas";
import { listSeedAgentsByArea } from "@/lib/seeds/agents";
import {
  getAreaGuide,
  listAreasWithCounts,
} from "@/lib/queries/areas-guide";
import { placeJsonLd, breadcrumbListJsonLd } from "@/lib/jsonld";
import { env } from "@/lib/env";
import { LifestyleDossier } from "./_components/lifestyle-dossier";
import { AreaReportsRail } from "../../_components/market-context-link";
import { ValuationLeadGate } from "../../tools/valuation/_components/lead-gate";

export async function generateStaticParams() {
  const entries = await listAreasWithCounts();
  return entries.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getAreaGuide(slug);
  if (!guide) return { title: "Area not found" };
  return {
    title: `${guide.name} — Bazar area guide`,
    description: guide.intro_md || undefined,
  };
}

export default async function AreaProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Existence check via the DB-or-seed lookup; rich editorial fields
  // (vibe, position, hero_label, etc.) remain seed-driven until the DB
  // covers them. When a DB-only area exists, the seed lookup returns
  // null and we surface neutral fallbacks.
  const guide = await getAreaGuide(slug);
  if (!guide) notFound();
  const area = getSeedAreaGuideBySlug(slug);
  if (!area) notFound();

  const advisors = listSeedAgentsByArea(area.slug);
  const similar = area.similar_areas
    .map((s) => getSeedAreaGuideBySlug(s))
    .filter((a) => a != null);

  const siteBase = (
    env.NEXT_PUBLIC_SITE_URL ?? "https://bazar-real-estate-cms.vercel.app"
  ).replace(/\/+$/, "");
  const placeLd = placeJsonLd({
    slug: area.slug,
    name: area.name,
    intro_md: guide.intro_md || area.intro || null,
  });
  const breadcrumbsLd = breadcrumbListJsonLd([
    { name: "Home", url: siteBase },
    { name: "Areas", url: `${siteBase}/areas` },
    { name: area.name, url: `${siteBase}/areas/${area.slug}` },
  ]);

  return (
    <div className="bg-bz-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsLd) }}
      />
      {/* Crumb */}
      <div className="px-4 md:px-12 pt-10 max-w-[1280px]">
        <Link
          href="/areas"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink-2 transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={1.8} />
          All areas
        </Link>
      </div>

      {/* Hero */}
      <section className="px-4 md:px-12 pt-8 pb-12 max-w-[1280px]">
        <Eyebrow>Area guide · {area.vibe}</Eyebrow>
        <h1
          className="serif text-[40px] md:text-[80px] mt-3 font-normal leading-[0.98] max-w-[14ch]"
          style={{ letterSpacing: "-0.03em" }}
        >
          {area.name}
        </h1>
        <p className="mt-6 text-[17px] text-bz-ink-2 leading-relaxed max-w-[64ch]">
          {area.intro}
        </p>
        <p className="mt-4 mono text-[12.5px] text-bz-muted">
          {area.position}
        </p>
      </section>

      {/* Hero image */}
      <section className="px-4 md:px-12 pb-14 max-w-[1280px]">
        <PlaceholderImage
          label={area.hero_label}
          className="w-full aspect-[21/9] rounded-md"
        />
      </section>

      {/* Stats */}
      <section className="border-y border-bz-border bg-bz-surface">
        <div className="px-4 md:px-12 py-10 max-w-[1280px]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            <div>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                Median apt / ft²
              </div>
              <div
                className="serif text-[36px] mt-1 leading-none"
                style={{ letterSpacing: "-0.018em" }}
              >
                {area.stats.median_apt_aed_per_ft2.toLocaleString()}
                <span className="mono text-[14px] text-bz-muted ml-1.5">AED</span>
              </div>
            </div>
            <div>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                Median villa / ft²
              </div>
              <div
                className="serif text-[36px] mt-1 leading-none"
                style={{ letterSpacing: "-0.018em" }}
              >
                {area.stats.median_villa_aed_per_ft2 > 0
                  ? `${area.stats.median_villa_aed_per_ft2.toLocaleString()}`
                  : "—"}
                {area.stats.median_villa_aed_per_ft2 > 0 ? (
                  <span className="mono text-[14px] text-bz-muted ml-1.5">
                    AED
                  </span>
                ) : null}
              </div>
            </div>
            <div>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                Avg days on market
              </div>
              <div
                className="serif text-[36px] mt-1 leading-none"
                style={{ letterSpacing: "-0.018em" }}
              >
                {area.stats.avg_dom_days}
              </div>
            </div>
            <div>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                YoY change
              </div>
              <div
                className="serif text-[36px] mt-1 leading-none"
                style={{
                  letterSpacing: "-0.018em",
                  color:
                    area.stats.yoy_change_pct > 0
                      ? "var(--bz-success, oklch(0.55 0.14 145))"
                      : area.stats.yoy_change_pct < 0
                        ? "var(--bz-danger, oklch(0.5 0.18 25))"
                        : undefined,
                }}
              >
                {area.stats.yoy_change_pct > 0 ? "+" : ""}
                {area.stats.yoy_change_pct}%
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Schools + amenities */}
      <section className="px-4 md:px-12 py-16 max-w-[1280px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          <div>
            <Eyebrow>Schools nearby</Eyebrow>
            <ul className="mt-5 flex flex-col gap-3">
              {area.schools.map((s) => (
                <li
                  key={s.name}
                  className="flex items-baseline justify-between gap-4 border-b border-bz-border pb-3"
                >
                  <div>
                    <div className="text-[15px] text-bz-ink">{s.name}</div>
                    <div className="text-[12px] text-bz-ink-2">
                      {s.curriculum}
                      {s.rating ? (
                        <>
                          {" · "}
                          <span
                            className={
                              s.rating === "Outstanding"
                                ? "text-bz-accent font-medium"
                                : "text-bz-ink-2"
                            }
                          >
                            ADEK / KHDA · {s.rating}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="mono text-[12px] text-bz-ink-2">
                    {s.distance_km} km
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Eyebrow>Amenities</Eyebrow>
            <ul className="mt-5 grid grid-cols-1 gap-2">
              {area.amenities.map((a) => (
                <li key={a} className="text-[14px] text-bz-ink">
                  · {a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* T1-A cleanup: cross-link rail into the area's quarterly market
          reports.  Closes the moat-orphan gap — visitors browsing the
          area can pivot directly into the data. */}
      <AreaReportsRail area_slug={area.slug} area_name={area.name} />

      {/* T1-E cleanup: lead-gate surfaced on the area page — owners of
          property in this community are the highest-intent valuation
          lead source. */}
      <section className="px-4 md:px-12 py-12 max-w-[1280px] border-t border-bz-border bg-bz-surface-2">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <Eyebrow>Own property in {area.name}?</Eyebrow>
            <h2
              className="serif text-[28px] mt-2 leading-tight max-w-[36ch]"
              style={{ letterSpacing: "-0.018em" }}
            >
              See what an advisor would price it at, free.
            </h2>
            <p className="mt-3 text-[14px] text-bz-ink-2 max-w-[58ch]">
              Instant data-backed range from our model, then a senior
              advisor reviews and sends a refined valuation within 24
              hours.
            </p>
          </div>
          <ValuationLeadGate triggerLabel={`Value my ${area.name} property`} />
        </div>
      </section>

      {/* T3-E: lifestyle dossier — commute chips, prose, dining picks.
          Self-hides if the seed for this area hasn't been editorially
          enriched yet. */}
      <LifestyleDossier area={area} />

      {/* Listings teaser */}
      <section className="border-t border-bz-border bg-bz-surface">
        <div className="px-4 md:px-12 py-16 max-w-[1280px]">
          <div className="flex items-end justify-between gap-8 flex-wrap">
            <div>
              <Eyebrow>Available now</Eyebrow>
              <h2
                className="serif text-[32px] mt-2 leading-tight"
                style={{ letterSpacing: "-0.015em" }}
              >
                Listings in {area.name}.
              </h2>
            </div>
            <Button asChild variant="outline">
              <Link href={`/buy?area=${area.slug}`}>View all listings</Link>
            </Button>
          </div>
          <div className="mt-8 py-12 text-center text-[14px] text-bz-muted border border-dashed border-bz-border rounded-md">
            Area → listings linking lands in Sprint 9.
          </div>
        </div>
      </section>

      {/* Advisors who cover this area */}
      <section className="px-4 md:px-12 py-16 max-w-[1280px]">
        <Eyebrow>Advisors who cover this area</Eyebrow>
        <h2
          className="serif text-[32px] mt-2 leading-tight"
          style={{ letterSpacing: "-0.015em" }}
        >
          Who to talk to about {area.name}.
        </h2>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-8">
          {advisors.map((a) => (
            <Link
              key={a.slug}
              href={`/agents/${a.slug}`}
              className="group block"
            >
              <PlaceholderImage
                label={a.slug}
                className="w-full aspect-[4/5] rounded-md"
              />
              <div className="mt-3">
                <div className="text-[15px] text-bz-ink group-hover:text-bz-accent transition-colors">
                  {a.display_name}
                </div>
                <div className="text-[12px] text-bz-muted mt-0.5">
                  {a.title}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Similar areas */}
      {similar.length > 0 ? (
        <section className="border-t border-bz-border bg-bz-surface">
          <div className="px-4 md:px-12 py-12 max-w-[1280px]">
            <Eyebrow>Similar areas</Eyebrow>
            <div className="mt-5 flex flex-wrap gap-3">
              {similar.map((s) =>
                s ? (
                  <Link
                    key={s.slug}
                    href={`/areas/${s.slug}`}
                    className="inline-flex items-center h-9 px-3 rounded border border-bz-border bg-bz-bg text-[13px] text-bz-ink-2 hover:border-bz-border-strong hover:text-bz-ink transition-colors"
                  >
                    {s.name}
                  </Link>
                ) : null,
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
