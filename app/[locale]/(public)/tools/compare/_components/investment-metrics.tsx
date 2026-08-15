"use client";

/**
 * Sprint 5b: investment metrics row for the compare page — gross yield,
 * 10-year area growth, DLD foreign-buyer eligibility. Sprint 12 swaps the
 * placeholder yields for real DLD-comparable-driven figures.
 */


import { useTranslations } from "next-intl";

type Metric = {
  ref: string;
  yieldPct: number;
  yoyGrowthPct: number;
  foreignEligible: boolean;
  mortgageableNow: boolean;
};

export function InvestmentMetrics({ rows }: { rows: Metric[] }) {
  const t = useTranslations("tools");
  if (rows.length === 0) return null;
  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-bz-border bg-bz-surface-2">
        <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
          {t("compare.metricsHeading")}
        </div>
      </div>
      <table className="w-full text-[13.5px]">
        <thead className="text-start text-[11.5px] uppercase tracking-wider text-bz-muted">
          <tr>
            <th className="px-5 py-3 font-medium">
              {t("compare.metricsReference")}
            </th>
            <th className="px-3 py-3 font-medium">{t("compare.metricsYield")}</th>
            <th className="px-3 py-3 font-medium">{t("compare.metricsGrowth")}</th>
            <th className="px-3 py-3 font-medium">
              {t("compare.metricsForeign")}
            </th>
            <th className="px-3 py-3 font-medium">
              {t("compare.metricsMortgageable")}
            </th>
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
                {t(
                  r.foreignEligible
                    ? "compare.foreignYes"
                    : "compare.foreignRestricted",
                )}
              </td>
              <td className="px-3 py-3 text-bz-ink-2">
                {t(r.mortgageableNow ? "compare.yes" : "compare.mortgageableCash")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
