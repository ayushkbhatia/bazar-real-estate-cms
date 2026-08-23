"use client";

/**
 * Sprint 5b: investment metrics row for the compare page — gross yield,
 * 10-year area growth, DLD foreign-buyer eligibility. Sprint 12 swaps the
 * placeholder yields for real DLD-comparable-driven figures.
 */

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

type Metric = {
  ref: string;
  yieldPct: number;
  yoyGrowthPct: number;
  foreignEligible: boolean;
  mortgageableNow: boolean;
};

/** Up is the brand accent, down is the danger token — shared by both trees. */
function growthColor(pct: number): string {
  return pct > 0
    ? "var(--bz-accent, #005777)"
    : "var(--bz-danger, oklch(0.5 0.18 25))";
}

/** One label/value pair inside a narrow-viewport metrics card. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wider text-bz-muted">
        {label}
      </dt>
      <dd className="mt-0.5 text-bz-ink-2">{children}</dd>
    </div>
  );
}

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

      {/* ── Narrow: a card per reference ───────────────────────────────
          Five columns whose narrowest possible layout still needs ~440px:
          "Mortgageable" and the `mono` reference are single unbreakable
          tokens, and the padding alone is 136px. A 390px phone gives the
          section 358px after its `px-4`, so `table-layout: auto` wraps every
          header to one word a line and *still* runs past the wrapper's
          `overflow-hidden` — the last column is clipped away rather than
          scrolled to. Stacking below `md` is the same two-tree split
          `_payment-plan.tsx` uses for its milestone timeline. */}
      <ul className="md:hidden list-none">
        {rows.map((r) => (
          <li
            key={r.ref}
            className="px-5 py-4 border-t border-bz-border first:border-t-0"
          >
            <div className="mono text-[13px] text-bz-ink">{r.ref}</div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13.5px]">
              <Field label={t("compare.metricsYield")}>
                <span className="mono text-bz-ink">
                  {r.yieldPct.toFixed(1)}%
                </span>
              </Field>
              <Field label={t("compare.metricsGrowth")}>
                <span
                  className="mono"
                  style={{ color: growthColor(r.yoyGrowthPct) }}
                >
                  {r.yoyGrowthPct > 0 ? "+" : ""}
                  {r.yoyGrowthPct.toFixed(1)}%
                </span>
              </Field>
              <Field label={t("compare.metricsForeign")}>
                {t(
                  r.foreignEligible
                    ? "compare.foreignYes"
                    : "compare.foreignRestricted",
                )}
              </Field>
              <Field label={t("compare.metricsMortgageable")}>
                {t(
                  r.mortgageableNow ? "compare.yes" : "compare.mortgageableCash",
                )}
              </Field>
            </dl>
          </li>
        ))}
      </ul>

      {/* ── `md` and up: the five-column table, unchanged ─────────────── */}
      <table className="hidden md:table w-full text-[13.5px]">
        <thead className="text-start text-[11.5px] uppercase tracking-wider text-bz-muted">
          <tr>
            <th className="px-5 py-3 font-medium">
              {t("compare.metricsReference")}
            </th>
            <th className="px-3 py-3 font-medium">
              {t("compare.metricsYield")}
            </th>
            <th className="px-3 py-3 font-medium">
              {t("compare.metricsGrowth")}
            </th>
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
                <span className="mono text-bz-ink">
                  {r.yieldPct.toFixed(1)}%
                </span>
              </td>
              <td className="px-3 py-3">
                <span
                  className="mono"
                  style={{ color: growthColor(r.yoyGrowthPct) }}
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
                {t(
                  r.mortgageableNow ? "compare.yes" : "compare.mortgageableCash",
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
