import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eyebrow } from "@/components/brand/eyebrow";
import {
  PROPERTY_TYPES,
  getSnapshot,
  getTrend,
  listRecentComparables,
  propertyTypeLabel,
  quarterFromSlug,
  quarterLabel,
  reportPath,
  type PropertyTypeSlug,
} from "@/lib/queries/market-reports";
import { readPreferencesFromCookie } from "@/lib/preferences/server";
import { listLiveComparables } from "@/lib/queries/market-reports-listings";
import { ReportHero } from "../../../_components/report-hero";
import { TrendChart } from "../../../_components/trend-chart";
import { ComparablesTable } from "../../../_components/comparables-table";
import { ReportDownload } from "../../../_components/report-download";
import { VelocityStrip } from "../../../_components/velocity-strip";
import { LiveListingsRail } from "../../../_components/live-listings-rail";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ area: string; type: string; quarter: string }>;
};

function isValidType(s: string): s is PropertyTypeSlug {
  return (PROPERTY_TYPES as readonly string[]).includes(s);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { area, type, quarter: q } = await params;
  if (!isValidType(type)) return { title: "Market report" };
  const quarter = quarterFromSlug(q);
  if (!quarter) return { title: "Market report" };
  const snapshot = await getSnapshot({
    area_slug: area,
    property_type: type,
    quarter,
  });
  if (!snapshot) return { title: "Market report" };
  const title = `${snapshot.area_name} ${propertyTypeLabel(type)} resale · ${quarterLabel(quarter)}`;
  return {
    title,
    description: `Median price, AED/ft², and closed transactions for ${snapshot.area_name} ${propertyTypeLabel(type).toLowerCase()}s in ${quarterLabel(quarter)}.`,
    alternates: { canonical: reportPath({ area_slug: area, property_type: type, quarter }) },
    robots: { index: true, follow: true },
  };
}

export default async function MarketReportDetailPage({ params }: PageProps) {
  const { area, type, quarter: qSlug } = await params;
  if (!isValidType(type)) notFound();
  const quarter = quarterFromSlug(qSlug);
  if (!quarter) notFound();

  const [snapshot, prefs] = await Promise.all([
    getSnapshot({ area_slug: area, property_type: type, quarter }),
    readPreferencesFromCookie(),
  ]);
  if (!snapshot) notFound();

  const [trend, comparables, liveListings] = await Promise.all([
    getTrend({ area_slug: area, property_type: type, endQuarter: quarter, span: 8 }),
    listRecentComparables({ area_slug: area, property_type: type, quarter, limit: 10 }),
    // T1-A cleanup: live comparable resale listings rail
    listLiveComparables({ area_slug: area, property_type: type, limit: 6 }),
  ]);

  // JSON-LD for SEO. Schema.org Dataset is the right fit — Google treats this
  // as a structured dataset with provenance.
  const datasetLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${snapshot.area_name} ${propertyTypeLabel(type)} resale ${quarterLabel(quarter)}`,
    description: `Median price, AED/ft², and closed transactions for ${snapshot.area_name} ${propertyTypeLabel(type).toLowerCase()}s in ${quarterLabel(quarter)}.`,
    creator: { "@type": "Organization", name: "Bazar Real Estate" },
    license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true,
    temporalCoverage: `${quarter.year}-${String((quarter.q - 1) * 3 + 1).padStart(2, "0")}/P3M`,
    variableMeasured: ["median_price_aed", "median_aed_per_ft2", "transaction_count"],
  };

  return (
    <article className="bg-bz-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetLd) }}
      />

      {/* Breadcrumb */}
      <div className="px-4 md:px-12 pt-6 text-[12px] text-bz-muted flex flex-wrap items-center gap-2">
        <Link href="/market-reports" className="hover:text-bz-ink">
          Market reports
        </Link>
        <span>›</span>
        <Link href={`/areas/${snapshot.area_slug}`} className="hover:text-bz-ink">
          {snapshot.area_name}
        </Link>
        <span>›</span>
        <span className="text-bz-ink-2">{propertyTypeLabel(type)}s</span>
        <span>›</span>
        <span className="text-bz-ink-2">{quarterLabel(quarter)}</span>
        <div className="ml-auto">
          <ReportDownload
            area_slug={snapshot.area_slug}
            property_type={type}
            quarter={quarter}
          />
        </div>
      </div>

      <ReportHero snapshot={snapshot} prefs={prefs} />
      <TrendChart trend={trend} prefs={prefs} />
      {/* T1-A cleanup: market velocity strip (transaction count proxy
          for DOM — DLD doesn't publish listing-to-close intervals). */}
      <VelocityStrip trend={trend} />
      <ComparablesTable rows={comparables} prefs={prefs} />
      {/* T1-A cleanup: live comparables rail bridges report → marketplace. */}
      <LiveListingsRail
        area_slug={snapshot.area_slug}
        area_name={snapshot.area_name}
        property_type={type}
        rows={liveListings}
        prefs={prefs}
      />

      {/* Advisor commentary */}
      <section className="px-4 md:px-12 py-12 border-b border-bz-border">
        <Eyebrow>Advisor commentary</Eyebrow>
        <h2
          className="serif text-[28px] mt-2 max-w-[44ch]"
          style={{ letterSpacing: "-0.018em" }}
        >
          Numbers are closed-book. Interpretation is bespoke.
        </h2>
        <p className="mt-4 text-[15px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
          The median masks the distribution — and the distribution is where
          buying decisions are actually made. For a personalised reading of
          this dataset, including off-market signals, time-to-close, and the
          shape of the active buyer pool in {snapshot.area_name}, book a
          30-minute call with your Bazar advisor.
        </p>
        <div className="mt-6">
          <Link
            href={`/contact?intent=market-report&area=${encodeURIComponent(snapshot.area_slug)}`}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-bz-ink text-bz-bg text-[13.5px] hover:bg-bz-ink/90"
          >
            Book a call
          </Link>
        </div>
      </section>

      {/* Cross-link to sibling reports */}
      <section className="px-4 md:px-12 py-12">
        <Eyebrow>Sibling reports · {snapshot.area_name}</Eyebrow>
        <h2
          className="serif text-[24px] mt-2"
          style={{ letterSpacing: "-0.018em" }}
        >
          Other asset types in this community
        </h2>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {PROPERTY_TYPES.filter((t) => t !== type).map((t) => (
            <Link
              key={t}
              href={reportPath({
                area_slug: snapshot.area_slug,
                property_type: t,
                quarter,
              })}
              className="px-4 py-3 rounded-md border border-bz-border bg-bz-surface hover:bg-bz-surface-2 text-[14px] text-bz-ink"
            >
              {propertyTypeLabel(t)}s · {quarterLabel(quarter)}
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
