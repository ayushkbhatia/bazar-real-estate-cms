import Link from "next/link";
import { ArrowUpRight, BarChart3 } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import {
  PROPERTY_TYPES,
  currentReportQuarter,
  propertyTypeLabel,
  quarterLabel,
  reportPath,
  type PropertyTypeSlug,
} from "@/lib/queries/market-reports";

/**
 * Map the canonical `property_type` enum onto the four reportable types.
 * Returns null when the type doesn't have a market-report counterpart
 * (commercial, land, hotel_apartment) — the calling component then falls
 * back to the area-level report index.
 */
export function reportableType(
  t: string | null | undefined,
): PropertyTypeSlug | null {
  if (!t) return null;
  if (
    t === "villa" ||
    t === "apartment" ||
    t === "townhouse" ||
    t === "penthouse"
  ) {
    return t;
  }
  return null;
}

/**
 * T1-A cleanup: per-area quarterly reports rail. Surfaced on /areas/[slug]
 * so visitors can pivot directly into the data moat for the area they're
 * browsing.
 */
export function AreaReportsRail({
  area_slug,
  area_name,
}: {
  area_slug: string;
  area_name: string;
}) {
  const quarter = currentReportQuarter();
  return (
    <section className="px-12 py-12 max-w-[1280px] border-t border-bz-border">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <Eyebrow>Quarterly reports · {area_name}</Eyebrow>
          <h2
            className="serif text-[28px] mt-2 leading-tight"
            style={{ letterSpacing: "-0.018em" }}
          >
            What the numbers say.
          </h2>
        </div>
        <span className="text-[12px] text-bz-ink-2">
          {quarterLabel(quarter)} · closed-book
        </span>
      </div>
      <ul className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {PROPERTY_TYPES.map((t) => (
          <li key={t}>
            <Link
              href={reportPath({
                area_slug,
                property_type: t,
                quarter,
              })}
              className="group flex items-center justify-between gap-2 px-4 py-3 rounded-md border border-bz-border bg-bz-surface hover:bg-bz-surface-2 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <BarChart3
                  size={13}
                  strokeWidth={1.7}
                  className="text-bz-ink-2 shrink-0"
                />
                <span className="text-[14px] text-bz-ink truncate">
                  {propertyTypeLabel(t)}s
                </span>
              </div>
              <ArrowUpRight
                size={13}
                strokeWidth={1.7}
                className="text-bz-ink-2 group-hover:text-bz-ink transition-colors shrink-0"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * T1-A cleanup: compact market-context block for property + development
 * detail pages. Links directly to the report for this property's area +
 * type so the data moat informs every listing.
 */
export function MarketContextBlock({
  area_slug,
  area_name,
  property_type,
  variant = "card",
}: {
  area_slug: string;
  area_name: string;
  property_type: PropertyTypeSlug | null;
  variant?: "card" | "inline";
}) {
  // Property type may be null (e.g. land / hotel apartment / commercial)
  // — surface the area-level report index instead of a typed deep-link.
  const quarter = currentReportQuarter();
  const href = property_type
    ? reportPath({ area_slug, property_type, quarter })
    : `/market-reports#${area_slug}`;
  const label = property_type
    ? `${propertyTypeLabel(property_type)} resale in ${area_name}`
    : `Market reports for ${area_name}`;

  if (variant === "inline") {
    return (
      <div className="rounded-lg border border-bz-border bg-bz-surface-2 p-5 my-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <Eyebrow>Market context</Eyebrow>
            <p className="mt-1.5 text-[14px] text-bz-ink leading-relaxed max-w-[52ch]">
              See what {label.toLowerCase()} actually closed for in{" "}
              {quarterLabel(quarter)} — median, AED/ft², and the 10 most recent
              DLD-recorded transactions.
            </p>
          </div>
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-bz-ink text-bz-bg text-[12.5px] hover:bg-bz-ink/90 transition-colors whitespace-nowrap"
          >
            Read the report
            <ArrowUpRight size={13} strokeWidth={1.7} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group block rounded-lg border border-bz-border bg-bz-surface p-5 hover:border-bz-ink transition-colors"
    >
      <div className="flex items-center gap-2 text-bz-ink-2">
        <BarChart3 size={13} strokeWidth={1.7} />
        <span className="text-[11px] uppercase tracking-wider">
          Market context
        </span>
      </div>
      <div
        className="serif text-[18px] mt-2 leading-tight group-hover:text-bz-accent transition-colors"
        style={{ letterSpacing: "-0.012em" }}
      >
        {label}
      </div>
      <div className="mt-1 text-[12px] text-bz-ink-2">
        {quarterLabel(quarter)} closed-book ›
      </div>
    </Link>
  );
}
