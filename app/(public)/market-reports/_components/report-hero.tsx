import { ArrowDown, ArrowUp } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import {
  propertyTypeLabel,
  quarterLabel,
  type Snapshot,
} from "@/lib/queries/market-reports";
import { formatPrice, formatPricePerArea, type Preferences } from "@/lib/preferences";

type Props = {
  snapshot: Snapshot;
  prefs: Preferences;
};

export function ReportHero({ snapshot, prefs }: Props) {
  const yoyPct = snapshot.yoy_change != null
    ? Math.round(snapshot.yoy_change * 1000) / 10 // one decimal
    : null;
  const yoyPositive = yoyPct != null && yoyPct >= 0;

  return (
    <section className="px-4 md:px-12 py-16 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-16 items-end border-b border-bz-border bg-bz-surface-2">
      <div>
        <Eyebrow>
          Market report · {quarterLabel(snapshot.quarter)} ·{" "}
          {propertyTypeLabel(snapshot.property_type)}s
        </Eyebrow>
        <h1
          className="serif text-[34px] md:text-[64px] mt-3 leading-[1.02]"
          style={{ letterSpacing: "-0.025em" }}
        >
          {snapshot.area_name}
        </h1>
        <p className="mt-5 text-[17px] text-bz-ink-2 leading-relaxed max-w-[52ch]">
          {snapshot.count > 0
            ? `${snapshot.count.toLocaleString()} closed ${snapshot.property_type} transaction${snapshot.count === 1 ? "" : "s"} on DLD record in ${quarterLabel(snapshot.quarter)}.`
            : `No closed ${snapshot.property_type} transactions surfaced for ${snapshot.area_name} in this quarter yet.`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Tile
          eyebrow="Median price"
          value={formatPrice(snapshot.median_price_aed, prefs)}
        />
        <Tile
          eyebrow={`Median ${prefs.area_unit === "m2" ? "AED/m²" : "AED/ft²"}`}
          value={formatPricePerArea(snapshot.median_aed_per_ft2, prefs)}
        />
        <Tile
          eyebrow="YoY change"
          value={
            yoyPct == null
              ? "—"
              : `${yoyPositive ? "+" : ""}${yoyPct}%`
          }
          icon={
            yoyPct == null ? null : yoyPositive ? (
              <ArrowUp size={14} strokeWidth={1.8} className="text-bz-accent" />
            ) : (
              <ArrowDown size={14} strokeWidth={1.8} className="text-red-700" />
            )
          }
        />
        <Tile
          eyebrow="Transactions"
          value={snapshot.count.toLocaleString()}
        />
      </div>
    </section>
  );
}

function Tile({
  eyebrow,
  value,
  icon,
}: {
  eyebrow: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="p-5 bg-bz-surface rounded-lg border border-bz-border">
      <div className="eyebrow">{eyebrow}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          className="serif text-[28px] leading-tight"
          style={{ letterSpacing: "-0.015em" }}
        >
          {value}
        </span>
        {icon}
      </div>
    </div>
  );
}
