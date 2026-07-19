/**
 * Sprint 5b: investment metrics row for the compare page — gross yield,
 * 10-year area growth, DLD foreign-buyer eligibility. Sprint 12 swaps the
 * placeholder yields for real DLD-comparable-driven figures.
 */

type Metric = {
  ref: string;
  yieldPct: number;
  yoyGrowthPct: number;
  foreignEligible: boolean;
  mortgageableNow: boolean;
};

export function InvestmentMetrics({ rows }: { rows: Metric[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-bz-border bg-bz-surface-2">
        <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
          Investment metrics
        </div>
      </div>
      <table className="w-full text-[13.5px]">
        <thead className="text-left text-[11.5px] uppercase tracking-wider text-bz-muted">
          <tr>
            <th className="px-5 py-3 font-medium">Reference</th>
            <th className="px-3 py-3 font-medium">Gross yield</th>
            <th className="px-3 py-3 font-medium">10-yr growth</th>
            <th className="px-3 py-3 font-medium">Foreign buyer</th>
            <th className="px-3 py-3 font-medium">Mortgageable</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ref} className="border-t border-bz-border">
              <td className="px-5 py-3 mono text-bz-ink-2">{r.ref}</td>
              <td className="px-3 py-3">
                <span className="mono text-bz-ink">{r.yieldPct.toFixed(1)}%</span>
              </td>
              <td className="px-3 py-3">
                <span
                  className="mono"
                  style={{
                    color:
                      r.yoyGrowthPct > 0
                        ? "var(--bz-accent, #005777)"
                        : "var(--bz-danger, oklch(0.5 0.18 25))",
                  }}
                >
                  {r.yoyGrowthPct > 0 ? "+" : ""}
                  {r.yoyGrowthPct.toFixed(1)}%
                </span>
              </td>
              <td className="px-3 py-3 text-bz-ink-2">
                {r.foreignEligible ? "Yes (freehold)" : "Restricted"}
              </td>
              <td className="px-3 py-3 text-bz-ink-2">
                {r.mortgageableNow ? "Yes" : "Cash only"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
