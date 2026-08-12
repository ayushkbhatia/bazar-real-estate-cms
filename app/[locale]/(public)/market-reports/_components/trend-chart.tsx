import { Eyebrow } from "@/components/brand/eyebrow";
import {
  quarterLabel,
  type TrendPoint,
} from "@/lib/queries/market-reports";
import { PriceText } from "../../_components/area-text";

type Props = {
  trend: TrendPoint[];
};

/**
 * Minimal SVG line chart for the median-price trend. We deliberately avoid a
 * charting library — the chart is small, the data set is small, and inline
 * SVG keeps the page render cost low.
 *
 * Values stay in AED through scale calculations and only the axis *labels*
 * convert, via the client `PriceText` leaf. AED→USD is a single linear factor,
 * so the curve geometry is currency-independent and the plotted line is
 * pixel-identical either way — swapping label text after hydration cannot move
 * it. Reading the currency from a server cookie instead would make this whole
 * route dynamic and discard its `revalidate`.
 */
export function TrendChart({ trend }: Props) {
  const validValues = trend.filter(
    (p): p is TrendPoint & { median_price_aed: number } =>
      p.median_price_aed != null && p.median_price_aed > 0,
  );
  const hasData = validValues.length >= 2;

  const width = 720;
  const height = 220;
  const paddingL = 64;
  const paddingR = 16;
  const paddingT = 24;
  const paddingB = 32;
  const innerW = width - paddingL - paddingR;
  const innerH = height - paddingT - paddingB;

  if (!hasData) {
    return (
      <section className="px-4 md:px-12 py-12 border-b border-bz-border">
        <Eyebrow>Trend</Eyebrow>
        <h2
          className="serif text-[28px] mt-2"
          style={{ letterSpacing: "-0.018em" }}
        >
          Insufficient data to plot a trend
        </h2>
        <p className="mt-3 text-[14px] text-bz-muted">
          We need at least two quarters of closed transactions to draw the
          median-price line. Check back after the next quarter closes.
        </p>
      </section>
    );
  }

  const maxAed = Math.max(...validValues.map((v) => v.median_price_aed));
  const minAed = Math.min(...validValues.map((v) => v.median_price_aed));
  const span = maxAed - minAed || 1;

  const xStep = innerW / Math.max(trend.length - 1, 1);
  const yScale = (aed: number) =>
    paddingT + innerH - ((aed - minAed) / span) * innerH;

  // Split into segments around missing values
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  trend.forEach((p, i) => {
    if (p.median_price_aed == null) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    const x = paddingL + i * xStep;
    const y = yScale(p.median_price_aed);
    current.push({ x, y });
  });
  if (current.length) segments.push(current);

  const yTicks = [minAed, minAed + span / 2, maxAed];

  return (
    <section className="px-4 md:px-12 py-12 border-b border-bz-border">
      <Eyebrow>Trend · {trend.length} quarters</Eyebrow>
      <h2
        className="serif text-[28px] mt-2"
        style={{ letterSpacing: "-0.018em" }}
      >
        {/* Unit-neutral on purpose: the currency lives on the axis labels,
            which swap after hydration. A currency in the heading would make
            that swap the most conspicuous thing on the page. */}
        Median price
      </h2>

      <div className="mt-6 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-[720px]"
          aria-label={`Median price trend across ${trend.length} quarters`}
          role="img"
        >
          {yTicks.map((aed, i) => (
            <line
              key={i}
              x1={paddingL}
              x2={width - paddingR}
              y1={yScale(aed)}
              y2={yScale(aed)}
              stroke="var(--bz-border)"
              strokeWidth={0.5}
            />
          ))}

          {yTicks.map((aed, i) => (
            <text
              key={`yl-${i}`}
              x={paddingL - 10}
              y={yScale(aed) + 4}
              textAnchor="end"
              className="text-[10px] fill-bz-muted"
            >
              <PriceText aed={aed} />
            </text>
          ))}

          {trend.map((p, i) =>
            i % 2 === 0 ? (
              <text
                key={`xl-${i}`}
                x={paddingL + i * xStep}
                y={height - 10}
                textAnchor="middle"
                className="text-[10px] fill-bz-muted"
              >
                {quarterLabel(p.quarter)}
              </text>
            ) : null,
          )}

          {segments.map((seg, si) => (
            <polyline
              key={`seg-${si}`}
              fill="none"
              stroke="var(--bz-accent, #005777)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
            />
          ))}
          {segments
            .flatMap((seg) => seg)
            .map((p, i) => (
              <circle
                key={`d-${i}`}
                cx={p.x}
                cy={p.y}
                r={3}
                fill="var(--bz-accent, #005777)"
              />
            ))}
        </svg>
      </div>
    </section>
  );
}
