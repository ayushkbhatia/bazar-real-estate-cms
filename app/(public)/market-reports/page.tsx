import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import {
  PROPERTY_TYPES,
  currentReportQuarter,
  listReportableAreas,
  propertyTypeLabel,
  quarterLabel,
  reportPath,
} from "@/lib/queries/market-reports";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Market reports · Abu Dhabi quarterly",
  description:
    "Per-area quarterly resale market reports for Abu Dhabi residential property. Median prices, AED/ft², YoY change, and recent closed transactions.",
  alternates: { canonical: "/market-reports" },
};

export default async function MarketReportsIndexPage() {
  const quarter = currentReportQuarter();
  const areas = await listReportableAreas({ quarter });

  return (
    <article className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-12 md:pt-24 pb-12 border-b border-bz-border">
        <Eyebrow>Market reports · {quarterLabel(quarter)}</Eyebrow>
        <h1
          className="serif text-[38px] md:text-[72px] mt-3 leading-[1.0]"
          style={{ letterSpacing: "-0.028em" }}
        >
          Abu Dhabi, by community
        </h1>
        <p className="mt-6 text-[17px] text-bz-ink-2 leading-relaxed max-w-[52ch]">
          Closed-book residential resale, distilled per community and asset
          type. Sourced from DLD open-data records — published one quarter in
          arrears so every number is final.
        </p>
      </section>

      <section className="px-4 md:px-12 py-16">
        {areas.length === 0 ? (
          <div className="rounded-lg border border-bz-border bg-bz-surface p-9 text-[15px] text-bz-muted">
            No closed transactions surfaced for {quarterLabel(quarter)} yet.
            The dataset refreshes weekly — check back shortly.
          </div>
        ) : (
          <div className="space-y-12">
            {areas.map((a) => (
              <div key={a.slug}>
                <div className="flex items-baseline justify-between border-b border-bz-border pb-3 mb-4">
                  <h2
                    className="serif text-[28px]"
                    style={{ letterSpacing: "-0.018em" }}
                  >
                    {a.name}
                  </h2>
                  <Link
                    href={`/communities/${a.slug}`}
                    className="text-[12.5px] text-bz-muted hover:text-bz-ink"
                  >
                    Community guide →
                  </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {PROPERTY_TYPES.map((t) => {
                    const href = reportPath({
                      area_slug: a.slug,
                      property_type: t,
                      quarter,
                    });
                    return (
                      <Link
                        key={t}
                        href={href}
                        className="group flex items-center justify-between gap-2 px-4 py-3 rounded-md border border-bz-border bg-bz-surface hover:bg-bz-surface-2 transition-colors"
                      >
                        <span className="text-[14px] text-bz-ink">
                          {propertyTypeLabel(t)}s
                        </span>
                        <ArrowRight
                          size={14}
                          strokeWidth={1.6}
                          className="text-bz-muted group-hover:text-bz-ink transition-colors"
                        />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
