import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database } from "@/db/types";

type Status = Database["public"]["Enums"]["property_status"];

const TABS: { value: Status | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "in_review", label: "In review" },
  { value: "off_market", label: "Off-market" },
  { value: "archived", label: "Archived" },
];

/**
 * Sprint 7b: segmented status tabs above the properties table. URL
 * driven (?status=…), so dashboard deep-links like
 * /admin/properties?status=draft now route directly into the right tab.
 */
export function StatusTabs({
  active,
  counts,
}: {
  active: Status | "all";
  counts: Record<Status | "all", number>;
}) {
  return (
    <nav
      role="tablist"
      aria-label="Property status"
      className="border-b border-bz-border flex gap-5"
    >
      {TABS.map((tab) => {
        const isActive = active === tab.value;
        const href =
          tab.value === "all"
            ? "/admin/properties"
            : `/admin/properties?status=${tab.value}`;
        return (
          <Link
            key={tab.value}
            href={href}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "py-3 inline-flex items-center gap-2 text-[13.5px] border-b-2 -mb-px transition-colors",
              isActive
                ? "border-bz-teal text-bz-teal"
                : "border-transparent text-bz-muted hover:text-bz-ink-2",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "mono text-[11px] px-1.5 rounded",
                isActive
                  ? "bg-bz-teal text-bz-bg"
                  : "bg-bz-surface-2 text-bz-muted",
              )}
            >
              {counts[tab.value] ?? 0}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
