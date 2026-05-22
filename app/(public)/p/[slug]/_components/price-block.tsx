import { Eyebrow } from "@/components/brand/eyebrow";

/**
 * Sprint 4c: price block — AED headline, AED/ft² + USD equivalent below,
 * "Listed Xd ago" pill alongside. `listedDays` is pre-computed by the
 * server page so this component stays pure.
 */
export function PriceBlock({
  priceAed,
  aedPerFt2,
  listedDays,
  formattedAed,
}: {
  priceAed: number;
  aedPerFt2: number | null;
  listedDays: number | null;
  formattedAed: string;
}) {
  // Fallback static rate (1 AED ≈ 0.272 USD). Sprint 12 wires a daily FX
  // sync; until then the static rate is shown with a `~` to flag it.
  const usd = priceAed * 0.272;
  const usdLabel =
    usd >= 1_000_000
      ? `~ USD ${(usd / 1_000_000).toFixed(2)}M`
      : usd >= 1000
        ? `~ USD ${(usd / 1000).toFixed(0)}k`
        : `~ USD ${Math.round(usd)}`;

  return (
    <div className="flex items-baseline gap-4 flex-wrap">
      <span
        className="serif text-[56px] font-normal leading-none"
        style={{ letterSpacing: "-0.025em" }}
      >
        {formattedAed}
      </span>
      <div className="flex flex-col gap-1">
        {aedPerFt2 ? (
          <span className="mono text-[13px] text-bz-muted">
            {aedPerFt2.toLocaleString()} AED/ft² · {usdLabel}
          </span>
        ) : (
          <span className="mono text-[13px] text-bz-muted">{usdLabel}</span>
        )}
        {listedDays != null ? (
          <Eyebrow className="text-bz-accent">
            Listed{" "}
            {listedDays === 0
              ? "today"
              : listedDays === 1
                ? "1 day ago"
                : `${listedDays} days ago`}
          </Eyebrow>
        ) : null}
      </div>
    </div>
  );
}
