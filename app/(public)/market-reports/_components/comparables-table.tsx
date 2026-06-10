import { Eyebrow } from "@/components/brand/eyebrow";
import type { Comparable } from "@/lib/queries/market-reports";
import {
  formatPrice,
  formatArea,
  convertFromAed,
  currencySymbol,
  type Preferences,
} from "@/lib/preferences";

type Props = {
  rows: Comparable[];
  prefs: Preferences;
};

const FT2_PER_M2 = 10.7639;

function fmtDate(s: string): string {
  // YYYY-MM-DD → "12 Mar 2026"
  const d = new Date(s + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtPerArea(
  aedPerFt2: number | null,
  prefs: Preferences,
): string {
  if (aedPerFt2 == null || !Number.isFinite(aedPerFt2)) return "—";
  const inCurrency = convertFromAed(aedPerFt2, prefs.currency);
  const final = prefs.area_unit === "m2" ? inCurrency * FT2_PER_M2 : inCurrency;
  return `${currencySymbol(prefs.currency)} ${Math.round(final).toLocaleString()}`;
}

export function ComparablesTable({ rows, prefs }: Props) {
  return (
    <section className="px-4 md:px-12 py-12 border-b border-bz-border">
      <Eyebrow>What&apos;s selling · DLD recorded</Eyebrow>
      <h2
        className="serif text-[28px] mt-2"
        style={{ letterSpacing: "-0.018em" }}
      >
        Recent transactions
      </h2>
      <p className="mt-3 text-[13.5px] text-bz-muted max-w-[60ch]">
        Top {rows.length} closed transactions in the quarter, by transaction
        date (most recent first). Addresses are anonymised per DLD open-data
        rules.
      </p>
      {rows.length === 0 ? (
        <div className="mt-6 rounded-lg border border-bz-border bg-bz-surface p-6 text-[14px] text-bz-muted">
          No transactions on file for this quarter yet.
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-bz-border bg-bz-surface overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead className="bg-bz-surface-2 text-left">
              <tr className="text-bz-muted text-[11px] uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Closed</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Beds</th>
                <th className="px-4 py-3 font-medium">Area</th>
                <th className="px-4 py-3 font-medium text-right">Price</th>
                <th className="px-4 py-3 font-medium text-right">
                  Per {prefs.area_unit === "m2" ? "m²" : "ft²"}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const perFt2 =
                  r.built_up_ft2 && r.built_up_ft2 > 0
                    ? r.price_aed / r.built_up_ft2
                    : null;
                return (
                  <tr key={i} className="border-t border-bz-border">
                    <td className="px-4 py-3 mono text-[12px] text-bz-ink-2">
                      {fmtDate(r.transaction_date)}
                    </td>
                    <td className="px-4 py-3">{r.property_type}</td>
                    <td className="px-4 py-3">
                      {r.bedrooms != null ? r.bedrooms : "—"}
                    </td>
                    <td className="px-4 py-3 mono text-[12px]">
                      {formatArea(r.built_up_ft2, prefs.area_unit)}
                    </td>
                    <td className="px-4 py-3 text-right mono">
                      {formatPrice(r.price_aed, prefs)}
                    </td>
                    <td className="px-4 py-3 text-right mono text-bz-muted">
                      {fmtPerArea(perFt2, prefs)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </section>
  );
}
