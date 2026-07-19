import { Eyebrow } from "@/components/brand/eyebrow";

/**
 * Sprint 5b (backfilled): rent + gross-yield estimate tile for the
 * valuation wizard. Sprint 12 swaps the placeholder calc for a real
 * DLD rental-yield lookup.
 */
export function YieldTile({
  priceAed,
  annualRentAedPerFt2 = 95,
  builtUpFt2,
}: {
  priceAed: number;
  /** Average yearly rent per ft² for the unit type/area. */
  annualRentAedPerFt2?: number;
  builtUpFt2: number;
}) {
  const annualRent = annualRentAedPerFt2 * builtUpFt2;
  const grossYield = priceAed > 0 ? (annualRent / priceAed) * 100 : 0;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-md border border-bz-border bg-bz-surface p-4">
        <Eyebrow>Est. annual rent</Eyebrow>
        <div
          className="serif text-[28px] mt-1 leading-none text-bz-navy"
          style={{ letterSpacing: "-0.015em" }}
        >
          AED {(annualRent / 1000).toFixed(0)}k
        </div>
        <div className="mono text-[10.5px] text-bz-muted mt-1.5">
          ~ {annualRentAedPerFt2.toLocaleString()} AED/ft² · area median
        </div>
      </div>
      <div className="rounded-md border border-bz-border bg-bz-surface p-4">
        <Eyebrow>Gross yield</Eyebrow>
        <div
          className="serif text-[28px] mt-1 leading-none text-bz-navy"
          style={{ letterSpacing: "-0.015em" }}
        >
          {grossYield.toFixed(1)}%
        </div>
        <div className="mono text-[10.5px] text-bz-muted mt-1.5">
          Annual rent ÷ asking price · before service charge
        </div>
      </div>
    </div>
  );
}
