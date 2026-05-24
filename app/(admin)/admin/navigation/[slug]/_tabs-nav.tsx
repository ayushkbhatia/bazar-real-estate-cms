"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { MegamenuTabListRow } from "@/lib/queries/megamenu";

/**
 * Horizontal pill nav for switching between the 10 megamenu tabs.
 * Active tab is highlighted; draft tabs get a small "draft" dot.
 */
type Props = {
  tabs: MegamenuTabListRow[];
  activeSlug: string;
};

export function MegamenuTabsNav({ tabs, activeSlug }: Props) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 py-1 border-b border-bz-border">
      {tabs.map((tab) => {
        const isActive = tab.slug === activeSlug;
        const isDraft = tab.status === "draft";
        return (
          <Link
            key={tab.id}
            href={`/admin/navigation/${tab.slug}`}
            className={cn(
              "shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] transition-colors",
              isActive
                ? "bg-bz-ink text-bz-bg"
                : "text-bz-ink-2 hover:bg-bz-surface-2",
            )}
          >
            {tab.label}
            {isDraft ? (
              <span
                aria-label="Draft"
                title="Draft"
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isActive ? "bg-bz-bg/70" : "bg-bz-warning",
                )}
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
