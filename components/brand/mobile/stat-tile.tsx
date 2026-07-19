import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Compact KPI tile (handoff `.bzm-stat`) for the mobile CMS dashboard /
 * analytics 2-up grid. Label, large serif value, optional delta tinted
 * by direction.
 */
export function StatTile({
  label,
  value,
  delta,
  down,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  down?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-bz-border bg-bz-surface p-3.5",
        className,
      )}
    >
      <div className="eyebrow">{label}</div>
      <div className="mt-1 font-serif text-[26px] leading-none text-bz-navy">
        {value}
      </div>
      {delta != null && (
        <div
          className={cn(
            "mt-1.5 text-[12px] font-medium",
            down ? "text-bz-danger" : "text-bz-success",
          )}
        >
          {delta}
        </div>
      )}
    </div>
  );
}
