/**
 * Sprint 5b: DBR (debt-burden ratio) gauge. UAE central-bank guideline is
 * <= 50%; mortgage stress tests typically aim <= 35%. This is a static SVG
 * arc — no client interactivity needed.
 */
export function DbrGauge({
  monthlyPaymentAed,
  monthlyIncomeAed,
}: {
  monthlyPaymentAed: number;
  monthlyIncomeAed: number;
}) {
  const dbr =
    monthlyIncomeAed > 0
      ? Math.min(1.5, monthlyPaymentAed / monthlyIncomeAed)
      : 0;
  const pct = Math.round(dbr * 100);

  // Half-circle gauge. SVG coords: 200 wide, 100 tall, arc from (10, 100) → (190, 100).
  const radius = 90;
  const cx = 100;
  const cy = 100;
  // The fraction we sweep maps 0% → 0deg, 50% → 90deg, 100% → 180deg (capped).
  const angle = Math.min(180, dbr * 180);
  const rad = (angle - 180) * (Math.PI / 180);
  const endX = cx + radius * Math.cos(rad);
  const endY = cy + radius * Math.sin(rad);
  const largeArc = angle > 180 ? 1 : 0;

  const band =
    dbr <= 0.35
      ? { label: "Comfortable", color: "var(--bz-success, oklch(0.55 0.14 145))" }
      : dbr <= 0.5
        ? { label: "Within limit", color: "var(--bz-warning, oklch(0.7 0.13 65))" }
        : { label: "Over UAE limit", color: "var(--bz-danger, oklch(0.5 0.18 25))" };

  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-6">
      <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
        Debt-burden ratio (DBR)
      </div>
      <div className="mt-4 grid grid-cols-[200px_1fr] gap-6 items-center">
        <svg
          viewBox="0 0 200 110"
          aria-label={`Debt-burden ratio ${pct}%`}
          className="w-full"
        >
          {/* Track */}
          <path
            d="M 10 100 A 90 90 0 0 1 190 100"
            stroke="var(--bz-border, oklch(0.9 0.005 80))"
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d={`M 10 100 A 90 90 0 ${largeArc} 1 ${endX} ${endY}`}
            stroke={band.color}
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
          />
          {/* Center label */}
          <text
            x={100}
            y={85}
            textAnchor="middle"
            fontSize="28"
            fontWeight="500"
            fill="var(--bz-ink, #13110f)"
            style={{ fontFamily: "var(--bz-font-mono, ui-monospace)" }}
          >
            {pct}%
          </text>
        </svg>
        <div>
          <div
            className="text-[13px] font-medium"
            style={{ color: band.color }}
          >
            {band.label}
          </div>
          <p className="mt-2 text-[12.5px] text-bz-muted leading-relaxed">
            UAE central bank caps DBR at <span className="mono text-bz-ink-2">50%</span>.
            Stress-tested banks underwrite to{" "}
            <span className="mono text-bz-ink-2">35%</span> with a 2% rate
            buffer. Adjust the income field above to recalculate.
          </p>
        </div>
      </div>
    </div>
  );
}
