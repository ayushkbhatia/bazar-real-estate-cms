import { Eyebrow } from "@/components/brand/eyebrow";
import {
  quarterLabel,
  type TrendPoint,
} from "@/lib/queries/market-reports";

type Props = {
  trend: TrendPoint[];
};

/**
 * T1-A cleanup: market-velocity / transactions-per-quarter sparkline. The
 * plan called for "days-on-market trend" but the DLD comparables dataset
 * only records closed transactions (not how long listings sat). Transaction
 * count is a directionally honest proxy: rising counts → deeper market,
 * falling counts → tighter market.
 */
export function VelocityStrip({ trend }: Props) {
  const values = trend.map((t) => t.count);
  const max = Math.max(...values, 1);
  const last = values[values.length - 1] ?? 0;
  const first = values[0] ?? 0;
  const direction =
    last > first ? "deepening" : last < first ? "tightening" : "flat";

  return (
    <section className="px-4 md:px-12 py-12 border-b border-bz-border">
      <Eyebrow>Market depth · transactions per quarter</Eyebrow>
      <h2
        className="serif text-[24px] mt-2 leading-tight max-w-[40ch]"
        style={{ letterSpacing: "-0.015em" }}
      >
        Liquidity is {direction} across the {trend.length}-quarter window.
      </h2>
      <p className="mt-3 text-[13px] text-bz-ink-2 max-w-[60ch]">
        Transaction counts are a rougher signal than days-on-market but the
        same direction of travel. DLD doesn&apos;t publish listing-to-close
        intervals, so we use closed-volume momentum until that dataset
        lands.
      </p>
      <div className="mt-6 flex items-end gap-1.5 h-[80px] max-w-[720px]">
        {trend.map((t, i) => {
          const h = max > 0 ? Math.max((t.count / max) * 80, 2) : 2;
          const isLatest = i === trend.length - 1;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end gap-1.5"
            >
              <span className="mono text-[10px] text-bz-ink-2">
                {t.count}
              </span>
              <div
                className={
                  isLatest
                    ? "w-full bg-bz-ink rounded-sm"
                    : "w-full bg-bz-border rounded-sm"
                }
                style={{ height: `${h}px` }}
                aria-hidden="true"
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-end gap-1.5 max-w-[720px]">
        {trend.map((t, i) => (
          <div
            key={i}
            className="flex-1 text-center text-[10px] text-bz-ink-2"
          >
            {i === 0 || i === trend.length - 1 || i % 2 === 0
              ? quarterLabel(t.quarter)
              : ""}
          </div>
        ))}
      </div>
    </section>
  );
}
