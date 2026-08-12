import { Eyebrow } from "@/components/brand/eyebrow";
import {
  AreaUnitText,
  CurrencySymbolText,
  PricePerAreaValueText,
} from "../../../_components/area-text";

/**
 * Sprint 5b (backfilled): 24-month area trend chart for the valuation
 * wizard. Pure inline SVG — no chart library dep. Sprint 9 swaps the
 * seed series for real DLD area aggregates.
 *
 * Only the three footer figures follow the visitor's preferences; the SVG
 * geometry does not change. AED→USD and ft²→m² are each a single linear
 * factor, so the curve's shape is unit-independent — the same argument
 * `market-reports/_components/trend-chart.tsx` makes for its axis.
 */
export function AreaTrendChart({
  area = "Saadiyat Island",
  series = SEED_SERIES,
}: {
  area?: string;
  series?: { month: string; aedPerFt2: number }[];
}) {
  if (series.length === 0) return null;

  const w = 480;
  const h = 140;
  const padX = 20;
  const padY = 16;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;

  const values = series.map((s) => s.aedPerFt2);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = Math.max(1, maxV - minV);

  const points = series.map((s, i) => {
    const x = padX + (i / (series.length - 1)) * innerW;
    const y = padY + (1 - (s.aedPerFt2 - minV) / range) * innerH;
    return { x, y, ...s };
  });

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const fill = `${path} L ${padX + innerW} ${padY + innerH} L ${padX} ${padY + innerH} Z`;

  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const totalChangePct =
    firstPoint.aedPerFt2 > 0
      ? ((lastPoint.aedPerFt2 - firstPoint.aedPerFt2) / firstPoint.aedPerFt2) *
        100
      : 0;

  return (
    <div className="rounded-md border border-bz-border bg-bz-surface p-4">
      <div className="flex items-baseline justify-between mb-3">
        <Eyebrow>24-month trend · {area}</Eyebrow>
        <span
          className={
            totalChangePct >= 0
              ? "mono text-[11px] text-bz-accent"
              : "mono text-[11px] text-bz-danger"
          }
        >
          {totalChangePct >= 0 ? "+" : ""}
          {totalChangePct.toFixed(1)}%
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        {/* Baseline grid */}
        <line
          x1={padX}
          x2={padX + innerW}
          y1={padY + innerH}
          y2={padY + innerH}
          stroke="var(--bz-border, #e5e2dc)"
        />
        {/* Filled area */}
        <path d={fill} fill="var(--bz-accent-soft, #def1f8)" />
        {/* Line */}
        <path
          d={path}
          fill="none"
          stroke="var(--bz-accent, #005777)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* End point */}
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="3"
          fill="var(--bz-accent, #005777)"
        />
        {/* Axis labels */}
        <text
          x={padX}
          y={padY + innerH + 12}
          fontSize="9"
          fill="var(--bz-muted, #8b857a)"
          fontFamily="var(--bz-font-mono, ui-monospace)"
        >
          {firstPoint.month}
        </text>
        <text
          x={padX + innerW}
          y={padY + innerH + 12}
          textAnchor="end"
          fontSize="9"
          fill="var(--bz-muted, #8b857a)"
          fontFamily="var(--bz-font-mono, ui-monospace)"
        >
          {lastPoint.month}
        </text>
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-bz-muted">
        <span>
          Low{" "}
          <span className="mono text-bz-ink-2">
            <PricePerAreaValueText aedPerFt2={minV} />
          </span>
        </span>
        <span>
          High{" "}
          <span className="mono text-bz-ink-2">
            <PricePerAreaValueText aedPerFt2={maxV} />
          </span>
        </span>
        <span>
          Latest{" "}
          <span className="mono text-bz-ink-2">
            <PricePerAreaValueText aedPerFt2={lastPoint.aedPerFt2} />
          </span>{" "}
          <CurrencySymbolText />/<AreaUnitText />
        </span>
      </div>
    </div>
  );
}

const SEED_SERIES = [
  { month: "May 24", aedPerFt2: 1740 },
  { month: "Jul 24", aedPerFt2: 1760 },
  { month: "Sep 24", aedPerFt2: 1790 },
  { month: "Nov 24", aedPerFt2: 1820 },
  { month: "Jan 25", aedPerFt2: 1810 },
  { month: "Mar 25", aedPerFt2: 1860 },
  { month: "May 25", aedPerFt2: 1900 },
  { month: "Jul 25", aedPerFt2: 1940 },
  { month: "Sep 25", aedPerFt2: 1960 },
  { month: "Nov 25", aedPerFt2: 1990 },
  { month: "Jan 26", aedPerFt2: 2010 },
  { month: "Mar 26", aedPerFt2: 2040 },
  { month: "May 26", aedPerFt2: 2080 },
];
