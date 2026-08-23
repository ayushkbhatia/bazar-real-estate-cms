import { useTranslations } from "next-intl";
import { Eyebrow } from "@/components/brand/eyebrow";
import { quarterLabel, type TrendPoint } from "@/lib/queries/market-reports";
import { PriceText } from "../../_components/area-text";

type Props = {
  trend: TrendPoint[];
};

/** The plot box, in SVG user units. See `Plot` for why there are two. */
type Dims = {
  width: number;
  height: number;
  paddingL: number;
  paddingR: number;
  paddingT: number;
  paddingB: number;
};

const WIDE: Dims = {
  width: 720,
  height: 220,
  paddingL: 64,
  paddingR: 16,
  paddingT: 24,
  paddingB: 32,
};

/**
 * `paddingL` stays at the wide plot's 64 even though everything else shrinks:
 * the y-labels are `PriceText`, i.e. "AED 2.40M" at 10px — about 50 units —
 * and they hang leftward from `paddingL - 10`. A gutter scaled down with the
 * rest of the box would clip them.
 */
const NARROW: Dims = {
  width: 380,
  height: 200,
  paddingL: 64,
  paddingR: 12,
  paddingT: 20,
  paddingB: 28,
};

/**
 * One rendering of the line at one geometry.
 *
 * The chart is drawn twice — WIDE for `md` and up, NARROW below it — because
 * an SVG's text scales with its viewBox. A 720-unit plot inside the 358px
 * column a 390px phone leaves after the section's `px-4` renders at 0.497×,
 * which puts the `text-[10px]` axis labels on screen at 5 effective CSS
 * pixels. Bumping the font size alone cannot fix that: the scale factor
 * slides continuously from 0.50 at a 390px viewport to 1.00 at ~752px — still
 * below `md` — so any single bumped size is illegible at one end of the range
 * and spills the y-labels out of `paddingL` at the other. Sizing the viewBox
 * to the column is the only version where the label keeps its authored 10px
 * at every width, and it beats the alternative of scrolling a 720px chart
 * through a 358px window, where you never see the shape of the trend at once.
 */
function Plot({
  trend,
  minAed,
  maxAed,
  dims,
  labelEvery,
  className,
}: {
  trend: TrendPoint[];
  minAed: number;
  maxAed: number;
  dims: Dims;
  labelEvery: number;
  className: string;
}) {
  const { width, height, paddingL, paddingR, paddingT, paddingB } = dims;
  const innerW = width - paddingL - paddingR;
  const innerH = height - paddingT - paddingB;
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
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
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
        i % labelEvery === 0 ? (
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
  );
}

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
  const t = useTranslations("editorial");
  const validValues = trend.filter(
    (p): p is TrendPoint & { median_price_aed: number } =>
      p.median_price_aed != null && p.median_price_aed > 0,
  );
  const hasData = validValues.length >= 2;

  if (!hasData) {
    return (
      <section className="px-4 md:px-12 py-12 border-b border-bz-border">
        <Eyebrow>{t("eyebrow.trend")}</Eyebrow>
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

  // The narrow plot has less than half the wide one's inner width, so it
  // thins the x-axis to at most five labels rather than the fixed every-other
  // the wide one has always used — at twelve quarters they would otherwise
  // sit 28 units apart with 34 units of "Q1 '24" to fit in.
  const narrowLabelEvery = Math.max(1, Math.ceil(trend.length / 5));

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
        <Plot
          trend={trend}
          minAed={minAed}
          maxAed={maxAed}
          dims={NARROW}
          labelEvery={narrowLabelEvery}
          className="md:hidden w-full max-w-[380px]"
        />
        <Plot
          trend={trend}
          minAed={minAed}
          maxAed={maxAed}
          dims={WIDE}
          labelEvery={2}
          /* `md:inline`, not `md:block`: an SVG's default display is inline,
             and switching it to block would drop the baseline descender gap
             under the chart — a few pixels of desktop layout this pass has no
             business moving. */
          className="hidden md:inline w-full max-w-[720px]"
        />
      </div>
    </section>
  );
}
