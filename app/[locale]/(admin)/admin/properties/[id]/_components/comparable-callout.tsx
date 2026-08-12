import { TrendingDown, TrendingUp } from "lucide-react";

/**
 * Sprint 7c (backfilled): pricing-tab callout that compares the asking
 * price to a recent DLD median for the same building / area. Sprint 12
 * wires real DLD comparables; today the parent passes a static delta.
 */
export function PricingComparableCallout({
  askingAedPerFt2,
  comparableAedPerFt2,
  source = "Recent DLD closes · same building",
}: {
  askingAedPerFt2: number;
  comparableAedPerFt2: number;
  source?: string;
}) {
  if (askingAedPerFt2 <= 0 || comparableAedPerFt2 <= 0) return null;
  const deltaPct =
    ((askingAedPerFt2 - comparableAedPerFt2) / comparableAedPerFt2) * 100;
  const under = deltaPct < 0;
  return (
    <div
      className="mt-3 rounded-md border px-4 py-3 flex items-start gap-3 text-[12.5px]"
      style={{
        background: under
          ? "var(--bz-accent-soft, oklch(0.945 0.022 222))"
          : "var(--bz-surface-2, oklch(0.95 0.005 80))",
        borderColor: under
          ? "var(--bz-accent, #005777)"
          : "var(--bz-border, oklch(0.9 0.005 80))",
        color: under
          ? "var(--bz-accent, #005777)"
          : "var(--bz-ink-2, oklch(0.3 0.005 80))",
      }}
    >
      {under ? (
        <TrendingDown size={14} strokeWidth={1.8} className="flex-shrink-0 mt-0.5" />
      ) : (
        <TrendingUp size={14} strokeWidth={1.8} className="flex-shrink-0 mt-0.5" />
      )}
      <div>
        <div className="font-medium">
          Priced{" "}
          <span className="mono">
            {Math.abs(deltaPct).toFixed(1)}%
          </span>{" "}
          {under ? "under" : "above"} the comparable median (
          {comparableAedPerFt2.toLocaleString()} AED/ft²)
        </div>
        <div className="text-[11px] mt-0.5 opacity-80">{source}</div>
      </div>
    </div>
  );
}
