import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Stacked section heading (handoff `MSectionHead`) — optional eyebrow,
 * serif title, trailing action (e.g. a "See all" link beside a rail).
 */
export function SectionHead({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow != null && <div className="eyebrow">{eyebrow}</div>}
        <h2 className="serif text-[24px] leading-tight text-bz-ink">{title}</h2>
      </div>
      {action != null && <div className="shrink-0">{action}</div>}
    </div>
  );
}
