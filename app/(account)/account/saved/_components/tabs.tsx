"use client";

import { useQueryState } from "nuqs";
import { parseAsStringEnum } from "nuqs";
import { cn } from "@/lib/utils";

export const SAVED_TABS = ["properties", "searches", "recent", "tours"] as const;
export type SavedTab = (typeof SAVED_TABS)[number];

const LABELS: Record<SavedTab, string> = {
  properties: "Properties",
  searches: "Searches",
  recent: "Recently viewed",
  tours: "Tour requests",
};

/**
 * Sprint 6: 4-tab nav on /account/saved with URL state via nuqs.
 * Renders the tab strip + the panel content for the active tab —
 * server passes pre-rendered panels keyed by tab.
 */
export function SavedTabs({
  counts,
  panels,
}: {
  counts: Record<SavedTab, number>;
  panels: Record<SavedTab, React.ReactNode>;
}) {
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringEnum<SavedTab>([...SAVED_TABS]).withDefault("properties"),
  );

  return (
    <>
      <nav
        role="tablist"
        aria-label="Saved sections"
        className="border-b border-bz-border flex gap-5"
      >
        {SAVED_TABS.map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t === "properties" ? null : t)}
              className={cn(
                "py-3 inline-flex items-center gap-2 text-[13.5px] border-b-2 -mb-px transition-colors",
                active
                  ? "border-bz-ink text-bz-ink"
                  : "border-transparent text-bz-muted hover:text-bz-ink-2",
              )}
            >
              {LABELS[t]}
              <span
                className={cn(
                  "mono text-[11px] px-1.5 rounded",
                  active
                    ? "bg-bz-ink text-bz-bg"
                    : "bg-bz-surface-2 text-bz-muted",
                )}
              >
                {counts[t]}
              </span>
            </button>
          );
        })}
      </nav>
      <div role="tabpanel" className="mt-10">
        {panels[tab]}
      </div>
    </>
  );
}
