import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type KeyValueItem = {
  key: ReactNode;
  value: ReactNode;
};

/**
 * Key-value spec list (handoff `.bzm-kv`) — property facts, deal
 * details, settings summaries. Label left (muted), value right
 * (emphasised), divider between rows.
 */
export function KeyValueList({
  items,
  className,
}: {
  items: KeyValueItem[];
  className?: string;
}) {
  return (
    <dl className={cn("divide-y divide-bz-border", className)}>
      {items.map((it, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-3">
          <dt className="text-[13px] text-bz-muted">{it.key}</dt>
          <dd className="text-right text-[13px] font-medium text-bz-ink">
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
