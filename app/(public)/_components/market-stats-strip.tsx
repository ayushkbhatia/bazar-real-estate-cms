import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";

type Stat = {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
};

const STATS: Stat[] = [
  { label: "Median apartment AED/ft²", value: "1,640", delta: "+6.2% YoY", positive: true },
  { label: "Median villa AED/ft²", value: "1,980", delta: "+9.1% YoY", positive: true },
  { label: "Active listings", value: "12,420", delta: "+412 wk/wk", positive: true },
  { label: "Avg days on market", value: "42", delta: "−5 vs Q4", positive: true },
];

/**
 * Sprint 4a: market-stats strip with quarterly-report CTA.
 * Numbers are seeded; Sprint 9 wires getMarketStatsSnapshot() against
 * a real aggregate query.
 */
export function MarketStatsStrip() {
  return (
    <section className="border-y border-bz-border bg-bz-surface">
      <div className="px-12 py-12">
        <div className="flex items-end justify-between gap-8 flex-wrap mb-8">
          <div>
            <Eyebrow>Q2 2026 · Abu Dhabi snapshot</Eyebrow>
            <h2
              className="serif text-[28px] mt-2 leading-tight max-w-[28ch]"
              style={{ letterSpacing: "-0.015em" }}
            >
              Where the market sits this quarter.
            </h2>
          </div>
          <Link
            href="/insights/category/market-report"
            className="inline-flex items-center gap-1.5 text-[13px] text-bz-ink-2 hover:text-bz-accent transition-colors"
          >
            Read the full report
            <ArrowRight size={13} strokeWidth={1.7} />
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                {s.label}
              </div>
              <div
                className="serif text-[40px] mt-1 leading-none"
                style={{ letterSpacing: "-0.02em" }}
              >
                {s.value}
              </div>
              <div
                className={
                  s.positive
                    ? "mt-2 text-[12px] mono text-bz-accent"
                    : "mt-2 text-[12px] mono text-bz-danger"
                }
              >
                {s.delta}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
