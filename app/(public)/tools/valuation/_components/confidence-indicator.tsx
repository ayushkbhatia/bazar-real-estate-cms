/**
 * Sprint 5b (backfilled): confidence indicator on the valuation review pane.
 * Maps the model's range fraction to a 3-step ladder (low / medium / high)
 * with a visual bar so the buyer/seller can read uncertainty at a glance.
 */
export function ConfidenceIndicator({
  rangeFraction,
}: {
  /** 0–1, the model's spread / midpoint. */
  rangeFraction: number;
}) {
  const tier =
    rangeFraction <= 0.08
      ? "high"
      : rangeFraction <= 0.18
        ? "medium"
        : "low";

  const TIER = {
    high: { label: "High confidence", value: 3, color: "var(--bz-accent, #4a6c4a)" },
    medium: { label: "Medium confidence", value: 2, color: "var(--bz-warning, #b58a30)" },
    low: { label: "Low confidence", value: 1, color: "var(--bz-danger, #8c2b2b)" },
  } as const;
  const meta = TIER[tier];

  return (
    <div className="rounded-md border border-bz-border bg-bz-surface p-4">
      <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
        Confidence
      </div>
      <div
        className="text-[16px] font-medium mt-1"
        style={{ color: meta.color }}
      >
        {meta.label}
      </div>
      <div className="mt-3 flex gap-1.5">
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className="h-1.5 flex-1 rounded-full"
            style={{
              background:
                step <= meta.value
                  ? meta.color
                  : "var(--bz-border, #e5e2dc)",
            }}
          />
        ))}
      </div>
      <p className="mt-3 text-[11.5px] text-bz-muted leading-relaxed">
        Range spread: ±{(rangeFraction * 100).toFixed(1)}% of the midpoint.
        Lower spread = higher confidence. The advisor will narrow this in
        the manual review step.
      </p>
    </div>
  );
}
