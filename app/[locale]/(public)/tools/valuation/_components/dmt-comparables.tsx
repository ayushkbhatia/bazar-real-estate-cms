import { Eyebrow } from "@/components/brand/eyebrow";
import {
  AreaUnitText,
  CurrencySymbolText,
  PriceText,
  PricePerAreaValueText,
} from "../../../_components/area-text";

type Comp = {
  ref: string;
  date: string;
  unit: string;
  price_aed: number;
  ft2: number;
};

const SEED_COMPS: Comp[] = [
  { ref: "DLD-04412", date: "2026-04-09", unit: "Mamsha 3-bed", price_aed: 4_180_000, ft2: 2820 },
  { ref: "DLD-04395", date: "2026-03-28", unit: "Mamsha 3-bed", price_aed: 4_320_000, ft2: 2840 },
  { ref: "DLD-04361", date: "2026-03-12", unit: "Mamsha 3-bed (corner)", price_aed: 4_450_000, ft2: 2920 },
  { ref: "DLD-04278", date: "2026-01-30", unit: "Mamsha 2-bed", price_aed: 3_180_000, ft2: 1980 },
];

/**
 * Sprint 5b (backfilled): DMT/DLD comparables table for the valuation
 * wizard. Sprint 12 swaps the seed array for the DLD CSV import pipeline.
 */
export function DmtComparables({
  comps = SEED_COMPS,
}: {
  comps?: Comp[];
}) {
  return (
    <div className="rounded-md border border-bz-border bg-bz-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-bz-border flex items-baseline justify-between">
        <Eyebrow>Recent DLD comparables</Eyebrow>
        <span className="mono text-[11px] text-bz-muted">
          {comps.length} transactions · 90 days
        </span>
      </div>
      <table className="w-full text-[12.5px]">
        <thead className="text-start text-[10.5px] uppercase tracking-wider text-bz-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Ref</th>
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Unit</th>
            <th className="px-3 py-2 font-medium text-end">Price</th>
            <th className="px-3 py-2 font-medium text-end">
              <CurrencySymbolText />/<AreaUnitText />
            </th>
          </tr>
        </thead>
        <tbody>
          {comps.map((c) => (
            <tr key={c.ref} className="border-t border-bz-border">
              <td className="px-4 py-2 mono text-bz-muted">{c.ref}</td>
              <td className="px-3 py-2 mono text-bz-ink-2">
                {new Date(c.date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "2-digit",
                })}
              </td>
              <td className="px-3 py-2 text-bz-ink-2">{c.unit}</td>
              <td className="px-3 py-2 mono text-bz-ink text-end">
                <PriceText aed={c.price_aed} />
              </td>
              <td className="px-3 py-2 mono text-bz-ink-2 text-end">
                <PricePerAreaValueText
                  aedPerFt2={Math.round(c.price_aed / c.ft2)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 text-[10.5px] text-bz-muted border-t border-bz-border">
        Sample DLD record. Sprint 12 swaps to live DLD CSV import.
      </div>
    </div>
  );
}
